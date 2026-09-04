// Customer self-service profile updates. Two distinct paths on purpose:
//
// - Direct fields (name/phone/addresses/preferences) are low-risk — they
//   never affect how a future login proves ownership of this Customer
//   record — so they're applied immediately, with an audit event.
// - Email is the one field claimPortalInvite() actually checks identity
//   against (see lib/portalInvites.ts). A customer-initiated email change
//   is never applied directly here; it's logged as a request and an admin
//   is notified, exactly like the "high-risk changes require verification /
//   admin review" requirement calls for. Applying an approved change is an
//   admin action (PATCH /api/admin/customers/[id]).
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { profileEmailChangeRequestedSubject, buildProfileEmailChangeRequestedHtml } from '@/emails/AdminBackorderAlerts'
import { validateBirthdayMonthDay } from '@/lib/pricing/birthdayPromotion'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface UpdatePortalProfileInput {
  firstName?: string
  lastName?: string
  phone?: string | null
  billingAddress?: unknown
  shippingAddress?: unknown
  preferredContactMethod?: 'SMS' | 'EMAIL' | 'PHONE' | null
  preferredPaymentMethod?: string | null
  // Pepscore's own birthday-marketing profile (month/day only, never a
  // year) -- entirely separate from Clerk age/identity verification, same
  // low-risk "applies immediately" path as name/phone/address, never the
  // requestEmailChange review path below. Both-or-neither: a half-entered
  // birthday isn't a usable one.
  birthdayMonth?: number | null
  birthdayDay?: number | null
}

export class InvalidBirthdayError extends Error {}

export function summarizeChanges(before: Record<string, unknown>, after: UpdatePortalProfileInput): string {
  const changed = Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify((after as Record<string, unknown>)[k]))
  return changed.length > 0 ? `Updated: ${changed.join(', ')}` : 'No fields changed'
}

export async function updatePortalProfile(customerId: string, input: UpdatePortalProfileInput): Promise<void> {
  const before = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })
  const summary = summarizeChanges(before, input)

  const birthdayTouched = input.birthdayMonth !== undefined || input.birthdayDay !== undefined
  if (birthdayTouched) {
    const month = input.birthdayMonth ?? null
    const day = input.birthdayDay ?? null
    if ((month === null) !== (day === null)) {
      throw new InvalidBirthdayError('Enter both a birthday month and day, or leave both blank.')
    }
    if (month !== null && day !== null) {
      const error = validateBirthdayMonthDay(month, day)
      if (error) throw new InvalidBirthdayError(error)
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: input.firstName ?? undefined,
      lastName: input.lastName ?? undefined,
      phone: input.phone !== undefined ? input.phone : undefined,
      billingAddress: input.billingAddress !== undefined ? (input.billingAddress as never) : undefined,
      shippingAddress: input.shippingAddress !== undefined ? (input.shippingAddress as never) : undefined,
      preferredContactMethod: input.preferredContactMethod !== undefined ? input.preferredContactMethod : undefined,
      preferredPaymentMethod: input.preferredPaymentMethod !== undefined ? (input.preferredPaymentMethod as never) : undefined,
      birthdayMonth: input.birthdayMonth !== undefined ? input.birthdayMonth : undefined,
      birthdayDay: input.birthdayDay !== undefined ? input.birthdayDay : undefined,
    },
  })

  await recordCustomerActivity({
    customerId,
    eventType: 'PROFILE_UPDATED',
    newValue: summary,
    source: 'MANUAL',
  })
}

export async function requestEmailChange(customerId: string, requestedEmail: string): Promise<void> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })

  await recordCustomerActivity({
    customerId,
    eventType: 'EMAIL_CHANGE_REQUESTED',
    previousValue: customer.email,
    newValue: requestedEmail,
    source: 'MANUAL',
  })

  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)
  if (emailTargets.length === 0) return

  await sendCategorizedEmail(
    {
      category: 'ADMIN_INTAKE_ALERT',
      to: emailTargets.map((r) => r.email!),
      subject: profileEmailChangeRequestedSubject(),
      html: buildProfileEmailChangeRequestedHtml({
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        customerId: customer.id,
        currentEmail: customer.email,
        requestedEmail,
        appUrl: APP_URL,
      }),
    },
    { customerId, actorType: 'MANUAL' }
  )
}
