// Admin-initiated early-launch Professional Access invitations (2026-08-19
// Professional Access sprint, section 12). Mirrors lib/portalInvites.ts's
// proven token-as-boundary shape closely -- same expiry/resend/revoke
// pattern, same "the token alone never grants access, the claimant must
// also be an authenticated Clerk user" rule. The one real difference:
// preApproved invites (the only kind this sprint builds an admin UI for)
// grant Professional Access immediately on claim, since an admin already
// vetted the recipient before sending it -- there is no separate
// application-review step to wait on for that path.
import crypto from 'crypto'
import type { ProfessionalAccessInvite, Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { upsertUserByClerkId } from '@/lib/user'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import {
  professionalAccessInviteSubject,
  buildProfessionalAccessInviteHtml,
  professionalAccessInviteReminderSubject,
  buildProfessionalAccessInviteReminderHtml,
  professionalAccessApprovedSubject,
  buildProfessionalAccessApprovedHtml,
} from '@/emails/ProfessionalAccess'

const INVITE_EXPIRY_HOURS = 14 * 24 // two weeks -- a business-verification invite, longer runway than the one-week portal-account-setup invite (lib/portalInvites.ts) since it may need a decision-maker's attention.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export class ProfessionalAccessInviteError extends Error {}

export interface GenerateInviteInput {
  email: string
  customerId?: string | null
  createdBy: string
}

// Never mints a second active invite for the same email -- mirrors
// findActivePortalInviteFor's exact precedent (lib/portalInvites.ts).
export async function findActiveProfessionalAccessInviteFor(email: string): Promise<ProfessionalAccessInvite | null> {
  return prisma.professionalAccessInvite.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, revokedAt: null, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function generateProfessionalAccessInvite(input: GenerateInviteInput): Promise<ProfessionalAccessInvite> {
  const existing = await findActiveProfessionalAccessInviteFor(input.email)
  if (existing) return existing

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

  const invite = await prisma.professionalAccessInvite.create({
    data: {
      email: input.email,
      customerId: input.customerId ?? undefined,
      token,
      expiresAt,
      createdBy: input.createdBy,
      status: 'SENT',
      sentAt: new Date(),
    },
  })

  if (input.customerId) {
    await recordCustomerActivity({
      customerId: input.customerId,
      eventType: 'PROFESSIONAL_ACCESS_INVITE_SENT',
      source: 'MANUAL',
      userId: input.createdBy,
    })
  }

  await sendCategorizedEmail(
    {
      category: 'PROFESSIONAL_ACCESS_INVITE',
      to: input.email,
      subject: professionalAccessInviteSubject(),
      html: buildProfessionalAccessInviteHtml({ claimUrl: `${APP_URL}/professional-access/invite/${invite.token}`, expiresAt: invite.expiresAt }),
    },
    { customerId: input.customerId ?? undefined, actorType: 'MANUAL', actorUserId: input.createdBy }
  )

  return invite
}

export async function resendProfessionalAccessInvite(id: string, actedBy: string): Promise<void> {
  const invite = await prisma.professionalAccessInvite.findUniqueOrThrow({ where: { id } })
  if (invite.acceptedAt) throw new ProfessionalAccessInviteError('This invitation has already been accepted.')
  if (invite.revokedAt) throw new ProfessionalAccessInviteError('This invitation has been revoked.')

  await sendCategorizedEmail(
    {
      category: 'PROFESSIONAL_ACCESS_INVITE_REMINDER',
      to: invite.email,
      subject: professionalAccessInviteReminderSubject(),
      html: buildProfessionalAccessInviteReminderHtml({ claimUrl: `${APP_URL}/professional-access/invite/${invite.token}`, expiresAt: invite.expiresAt }),
    },
    { customerId: invite.customerId ?? undefined, actorType: 'MANUAL', actorUserId: actedBy }
  )
}

export async function revokeProfessionalAccessInvite(id: string, revokedBy: string): Promise<void> {
  const invite = await prisma.professionalAccessInvite.update({
    where: { id },
    data: { status: 'REVOKED', revokedAt: new Date(), revokedBy },
  })
  if (invite.customerId) {
    await recordCustomerActivity({
      customerId: invite.customerId,
      eventType: 'PROFESSIONAL_ACCESS_INVITE_REVOKED',
      source: 'MANUAL',
      userId: revokedBy,
    })
  }
}

export type InviteValidation =
  | { valid: true; invite: ProfessionalAccessInvite }
  | { valid: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_ACCEPTED' }

export async function validateProfessionalAccessInvite(token: string): Promise<InviteValidation> {
  const invite = await prisma.professionalAccessInvite.findUnique({ where: { token } })
  if (!invite) return { valid: false, reason: 'NOT_FOUND' }
  if (invite.status === 'REVOKED' || invite.revokedAt) return { valid: false, reason: 'REVOKED' }
  if (invite.acceptedAt) return { valid: false, reason: 'ALREADY_ACCEPTED' }
  if (invite.expiresAt < new Date()) return { valid: false, reason: 'EXPIRED' }
  return { valid: true, invite }
}

export interface ClaimInviteInput {
  token: string
  clerkUserId: string
  // The Clerk session's own *verified* primary email -- never trusted from
  // a request body, same rule as claimPortalInvite (lib/portalInvites.ts).
  clerkVerifiedEmail: string
}

export type ClaimInviteResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_ACCEPTED' | 'EMAIL_MISMATCH' }

// Grants Professional Access immediately on claim -- this invite type is
// admin-pre-approved by construction (there is no non-preApproved invite
// creation path built this sprint; preApproved exists on the schema for a
// possible future "invite someone to apply" flow that would route through
// the application queue instead, see the model's own schema comment).
export async function claimProfessionalAccessInvite(input: ClaimInviteInput): Promise<ClaimInviteResult> {
  const validation = await validateProfessionalAccessInvite(input.token)
  if (!validation.valid) return { ok: false, reason: validation.reason }
  const { invite } = validation

  if (invite.email.toLowerCase() !== input.clerkVerifiedEmail.toLowerCase()) {
    return { ok: false, reason: 'EMAIL_MISMATCH' }
  }

  const user = await upsertUserByClerkId(input.clerkUserId, input.clerkVerifiedEmail)

  // Resolve or create the Customer this invite grants entitlement to --
  // reuses the exact find-by-userId-then-email pattern
  // resolveCustomerIdForCheckout uses (lib/promotions/redemption.ts),
  // scoped here to a Clerk-verified email so it's safe for an entitlement
  // grant, not just a loose coupon match.
  let customer = invite.customerId
    ? await prisma.customer.findUnique({ where: { id: invite.customerId } })
    : await prisma.customer.findFirst({ where: { userId: user.id } })
  if (!customer) {
    customer = await prisma.customer.findFirst({ where: { email: { equals: input.clerkVerifiedEmail, mode: 'insensitive' } } })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const resolvedCustomer = customer
      ? await tx.customer.update({ where: { id: customer.id }, data: { userId: customer.userId ?? user.id, proEligible: true } })
      : await tx.customer.create({
          data: {
            firstName: input.clerkVerifiedEmail.split('@')[0],
            lastName: '',
            email: input.clerkVerifiedEmail,
            userId: user.id,
            proEligible: true,
          },
        })
    await tx.professionalAccessInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), customerId: resolvedCustomer.id },
    })
    return resolvedCustomer
  })

  await recordCustomerActivity({
    customerId: updated.id,
    eventType: 'PROFESSIONAL_ACCESS_GRANTED',
    newValue: 'invite',
    source: 'SYSTEM',
    userId: input.clerkUserId,
  })

  await sendCategorizedEmail(
    {
      category: 'PROFESSIONAL_ACCESS_APPROVED',
      to: input.clerkVerifiedEmail,
      subject: professionalAccessApprovedSubject(),
      html: buildProfessionalAccessApprovedHtml({
        contactName: `${updated.firstName} ${updated.lastName}`.trim() || 'there',
        businessName: updated.company || 'your business',
        storefrontUrl: APP_URL,
      }),
    },
    { customerId: updated.id, actorType: 'SYSTEM' }
  )

  return { ok: true, customer: updated }
}
