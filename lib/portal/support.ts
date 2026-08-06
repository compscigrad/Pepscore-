// Customer portal support-form submission. Logs a CustomerActivityLog
// entry (visible in the admin customer timeline — the existing, already-
// built audit surface), sends the customer an acknowledgement, and alerts
// admin with a direct link to the customer (and the invoice, if one was
// selected). Spam/duplicate defense is the caller's rate-limit check
// (see app/api/account/support/route.ts), same checkRateLimit() pattern
// used by every other public-facing submission in this codebase.
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { supportRequestReceivedSubject, buildSupportRequestReceivedHtml, supportRequestAdminAlertSubject, buildSupportRequestAdminAlertHtml } from '@/emails/PortalSupport'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface SubmitSupportRequestInput {
  customerId: string
  message: string
  invoiceId?: string | null
}

export class SupportRequestError extends Error {}

export async function submitSupportRequest(input: SubmitSupportRequestInput): Promise<void> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } })

  // Ownership check: an invoice id, if supplied, must actually belong to
  // this customer — never trust a client-supplied invoice id blindly.
  let invoice: { id: string; invoiceNumber: string } | null = null
  if (input.invoiceId) {
    invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, customerId: input.customerId },
      select: { id: true, invoiceNumber: true },
    })
    if (!invoice) throw new SupportRequestError('That invoice could not be found on your account.')
  }

  const customerName = `${customer.firstName} ${customer.lastName}`.trim()

  await recordCustomerActivity({
    customerId: input.customerId,
    invoiceId: invoice?.id,
    eventType: 'SUPPORT_REQUEST_SUBMITTED',
    newValue: input.message.slice(0, 500),
    source: 'MANUAL',
  })

  if (customer.email) {
    await sendCategorizedEmail(
      {
        category: 'SUPPORT_REQUEST_RECEIVED',
        to: customer.email,
        subject: supportRequestReceivedSubject(),
        html: buildSupportRequestReceivedHtml({ customerName, message: input.message }),
      },
      { customerId: input.customerId, invoiceId: invoice?.id, actorType: 'MANUAL' }
    )
  }

  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)
  if (emailTargets.length > 0) {
    await sendCategorizedEmail(
      {
        category: 'SUPPORT_REQUEST',
        to: emailTargets.map((r) => r.email!),
        subject: supportRequestAdminAlertSubject(customerName),
        html: buildSupportRequestAdminAlertHtml({
          customerName,
          customerId: input.customerId,
          message: input.message,
          invoiceNumber: invoice?.invoiceNumber ?? null,
          invoiceId: invoice?.id ?? null,
          appUrl: APP_URL,
        }),
      },
      { customerId: input.customerId, invoiceId: invoice?.id, actorType: 'SYSTEM' }
    )
  }
}
