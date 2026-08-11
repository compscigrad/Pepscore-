// Customer portal identity linking — the single, explicit, auditable path
// by which a Clerk User ever gets attached to a Customer record. Nothing
// else in the codebase may set Customer.userId; a User is never linked
// merely because a login email happens to resemble one on a Customer row.
//
// Mirrors lib/intakeLinks.ts's proven shape (token-as-boundary, state
// derived from timestamps, never a parallel status enum) with one added
// requirement specific to identity: the token alone never grants access.
// claimPortalInvite() additionally requires the caller to already be an
// authenticated Clerk user whose own *verified* email (never a client-
// supplied string) matches the invited Customer's email.
import crypto from 'crypto'
import type { CustomerPortalInvite, Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { upsertUserByClerkId } from '@/lib/user'
import { sendCategorizedEmail, sendCategorizedSms } from '@/lib/notifications/log'
import {
  portalInviteSubject,
  buildPortalInviteHtml,
  portalInviteSmsBody,
  portalAccountClaimedSubject,
  buildPortalAccountClaimedHtml,
} from '@/emails/PortalInvite'
import { getPortalInviteState, isPortalInviteUsable } from '@/lib/portalInviteState'
import { trackServerEvent } from '@/lib/analytics/serverTrack'
import { AnalyticsEvent } from '@/lib/analytics/events'
import type { PortalInviteState } from '@/lib/portalInviteState'
import type { PortalInviteChannel, PortalInviteSource } from '@prisma/client'

export { getPortalInviteState }
export type { PortalInviteState }

const INVITE_EXPIRY_HOURS = 7 * 24 // one week — a person-facing account-setup link, not a payment action
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface GeneratePortalInviteInput {
  customerId: string
  createdBy: string
  // Both default to the admin single-invite path's existing behavior
  // (EMAIL-only, ADMIN-sourced) — omitting these keeps every current call
  // site byte-for-byte unchanged. The auto-rollout audience (PR6) is the
  // first caller expected to pass channel: 'BOTH'/'SMS' and source:
  // 'AUTO_ROLLOUT'.
  channel?: PortalInviteChannel
  source?: PortalInviteSource
}

export class PortalInviteError extends Error {}

// The requirement-11-style safeguard (see lib/intakeLinks.ts's
// findActiveIntakeLinkFor): don't silently mint a second active invite for
// a customer who already has one outstanding — surface it for reuse/resend
// instead.
export async function findActivePortalInviteFor(customerId: string): Promise<CustomerPortalInvite | null> {
  const candidates = await prisma.customerPortalInvite.findMany({
    where: { customerId, revokedAt: null, claimedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return candidates.find((invite) => isPortalInviteUsable(invite)) ?? null
}

export async function generatePortalInvite(input: GeneratePortalInviteInput): Promise<CustomerPortalInvite> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } })
  if (!customer.email) {
    throw new PortalInviteError('This customer has no email on file — an email is required to verify portal-account ownership.')
  }
  if (customer.userId) {
    throw new PortalInviteError('This customer already has a linked portal account.')
  }

  const existing = await findActivePortalInviteFor(input.customerId)
  if (existing) return existing

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

  const invite = await prisma.customerPortalInvite.create({
    data: {
      customerId: input.customerId,
      token,
      createdBy: input.createdBy,
      expiresAt,
      channel: input.channel ?? 'EMAIL',
      source: input.source ?? 'ADMIN',
    },
  })

  await recordCustomerActivity({
    customerId: input.customerId,
    eventType: 'PORTAL_INVITE_GENERATED',
    source: 'MANUAL',
    userId: input.createdBy,
  })

  await sendPortalInviteEmail(customer, invite)

  return invite
}

async function sendPortalInviteEmail(customer: Customer, invite: CustomerPortalInvite): Promise<void> {
  const claimUrl = `${APP_URL}/account/claim/${invite.token}`

  if (customer.email) {
    await sendCategorizedEmail(
      {
        category: 'PORTAL_INVITE',
        to: customer.email,
        subject: portalInviteSubject(),
        html: buildPortalInviteHtml({
          customerName: `${customer.firstName} ${customer.lastName}`.trim(),
          claimUrl,
          expiresAt: invite.expiresAt,
        }),
      },
      { customerId: customer.id, actorType: 'MANUAL', actorUserId: invite.createdBy }
    )
  }

  // SMS is additive to email, never a replacement — gracefully no-ops via
  // attemptSms (lib/notifications/bestEffortSms.ts) when the customer has no
  // phone or Twilio isn't configured, exactly like every other SMS call
  // site in this codebase.
  if (invite.channel === 'SMS' || invite.channel === 'BOTH') {
    await sendCategorizedSms('PORTAL_INVITE', customer.phone, portalInviteSmsBody(claimUrl), {
      customerId: customer.id,
      actorType: 'MANUAL',
      actorUserId: invite.createdBy,
    })
  }
}

// Regenerate = revoke the old one (if any) and mint a fresh token — the
// one-click "Resend Invitation" action, matching lib/intakeLinks.ts's
// regenerateIntakeLink pattern exactly.
export async function resendPortalInvite(customerId: string, actedBy: string): Promise<CustomerPortalInvite> {
  const existing = await findActivePortalInviteFor(customerId)
  if (existing) {
    await revokePortalInvite(existing.id, actedBy)
  }
  return generatePortalInvite({ customerId, createdBy: actedBy })
}

export async function revokePortalInvite(id: string, revokedBy: string): Promise<void> {
  const invite = await prisma.customerPortalInvite.update({
    where: { id },
    data: { revokedAt: new Date(), revokedBy },
  })
  await recordCustomerActivity({
    customerId: invite.customerId,
    eventType: 'PORTAL_INVITE_REVOKED',
    source: 'MANUAL',
    userId: revokedBy,
  })
}

export type PortalInviteValidation =
  | { valid: true; invite: CustomerPortalInvite; customer: Customer }
  | { valid: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_CLAIMED' }

export async function validatePortalInvite(token: string): Promise<PortalInviteValidation> {
  const invite = await prisma.customerPortalInvite.findUnique({ where: { token }, include: { customer: true } })
  if (!invite) return { valid: false, reason: 'NOT_FOUND' }

  const state = getPortalInviteState(invite)
  if (state === 'REVOKED') return { valid: false, reason: 'REVOKED' }
  if (state === 'EXPIRED') return { valid: false, reason: 'EXPIRED' }
  if (state === 'CLAIMED') return { valid: false, reason: 'ALREADY_CLAIMED' }

  return { valid: true, invite, customer: invite.customer }
}

export interface ClaimPortalInviteInput {
  token: string
  clerkUserId: string
  // The Clerk session's own *verified* primary email — the caller (the
  // claim API route) must pass this from Clerk's server-side user object,
  // never from a request body field a client could set arbitrarily.
  clerkVerifiedEmail: string
}

export type ClaimPortalInviteResult =
  | { ok: true; customer: Customer }
  | {
      ok: false
      reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_CLAIMED' | 'EMAIL_MISMATCH' | 'USER_ALREADY_LINKED' | 'CUSTOMER_ALREADY_LINKED'
    }

// The one place Customer.userId is ever set. Every guard here is a real
// rejection path (see ClaimPortalInviteResult's reason union), exercised
// against the shared production DB via a disposable rehearsal test at
// merge time rather than a permanent test file -- this module is entirely
// Prisma-backed with no pure-logic split to unit test in isolation.
//
// Customer.userId is a foreign key to User.id (Prisma's own cuid), not the
// raw Clerk user id — Clerk's id lives on User.clerkId. This resolves (or,
// on a customer's very first claim, creates) the User row the same way
// app/account/page.tsx already did for the old Order-based view, so a
// customer who claims via the portal and one who somehow arrives through
// any other Clerk-authenticated path both resolve to the same User row.
export async function claimPortalInvite(input: ClaimPortalInviteInput): Promise<ClaimPortalInviteResult> {
  const validation = await validatePortalInvite(input.token)
  if (!validation.valid) return { ok: false, reason: validation.reason }
  const { invite, customer } = validation

  // Ownership proof: Clerk itself verified this email during sign-up/sign-in
  // — never trust a request-body string here. Case-insensitive since email
  // addresses are conventionally treated that way everywhere else in Clerk.
  if (!customer.email || customer.email.toLowerCase() !== input.clerkVerifiedEmail.toLowerCase()) {
    return { ok: false, reason: 'EMAIL_MISMATCH' }
  }

  const user = await upsertUserByClerkId(input.clerkUserId, input.clerkVerifiedEmail)

  const userAlreadyLinkedElsewhere = await prisma.customer.findFirst({
    where: { userId: user.id, id: { not: customer.id } },
  })
  if (userAlreadyLinkedElsewhere) return { ok: false, reason: 'USER_ALREADY_LINKED' }

  if (customer.userId && customer.userId !== user.id) {
    return { ok: false, reason: 'CUSTOMER_ALREADY_LINKED' }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const linkedCustomer = await tx.customer.update({
      where: { id: customer.id },
      data: { userId: user.id },
    })
    await tx.customerPortalInvite.update({
      where: { id: invite.id },
      data: { claimedAt: new Date(), claimedByUserId: input.clerkUserId },
    })
    return linkedCustomer
  })

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'PORTAL_ACCOUNT_CLAIMED',
    source: 'SYSTEM',
    userId: input.clerkUserId,
  })

  await sendPortalAccountClaimedEmail(updated)
  void trackServerEvent(AnalyticsEvent.PORTAL_ACTIVATION, { source: 'INVITE' })

  return { ok: true, customer: updated }
}

async function sendPortalAccountClaimedEmail(customer: Customer): Promise<void> {
  if (!customer.email) return
  await sendCategorizedEmail(
    {
      category: 'PORTAL_ACCOUNT_CLAIMED',
      to: customer.email,
      subject: portalAccountClaimedSubject(),
      html: buildPortalAccountClaimedHtml({
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        portalUrl: `${APP_URL}/account`,
      }),
    },
    { customerId: customer.id, actorType: 'SYSTEM' }
  )
}
