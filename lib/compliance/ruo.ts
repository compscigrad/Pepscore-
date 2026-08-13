// Versioned Research Use Only (RUO) acceptance -- 2026-08-12 homepage/
// compliance sprint. This is a functional/compliance UX architecture, not
// legal advice; RUO_TEXT below is a production-draft acknowledgment
// flagged for owner/legal review in docs/PendingOwnerActions.md, not
// claimed as legally sufficient merely because it's implemented.
//
// Versioning contract: bump RUO_VERSION whenever the acknowledgment
// wording materially changes. A signed-in customer's acceptance is
// checked against the CURRENT version only -- prior-version acceptance
// rows are never deleted (audit history), but no longer satisfy
// hasAcceptedCurrentRuo() once the version moves.
//
// v1 -> RUO-2026-01 (2026-08-12): replaced with owner-provided copy split
// into two distinct affirmative checkboxes (age + RUO/Terms/Privacy
// agreement) instead of one combined statement. Prior v1 text, preserved
// here for comparison rather than a separate document:
//   "I confirm that I am a qualified researcher purchasing these products
//   for legitimate research purposes only. I acknowledge that all
//   Pepscore Lab products are for Research Use Only (RUO). They are NOT
//   intended for human use, human consumption, diagnostic use,
//   therapeutic use, or veterinary use. Pepscore Lab does not provide
//   dosing, administration, treatment, or medical guidance of any kind,
//   and requests seeking such guidance violate this policy. I will
//   handle all products in accordance with applicable laws and
//   regulations. I understand that violations of this policy may result
//   in restriction, suspension, or termination of my account."
import { prisma } from '@/lib/prisma'

export const RUO_VERSION = 'RUO-2026-01'

export const RUO_INTRO_TEXT =
  'This website is restricted. To continue, please confirm you meet the minimum age requirement and accept the agreement below.'

export const RUO_AGE_TEXT = 'I confirm I am 21+ years of age or older.'

export const RUO_AGREEMENT_TEXT =
  'I agree that products and information on this website are provided for laboratory research use only and are not intended for use in or on humans or animals. I will not use any products or information from this website for diagnosis, treatment, cure, or prevention of any condition. I agree to follow applicable laws and regulations, and I agree to the Terms of Service and Privacy Policy.'

// Full combined text stored on every acceptance record -- both
// affirmations plus the intro, so the audit record always reflects
// exactly what the customer saw and agreed to as one unit.
export const RUO_TEXT = `${RUO_INTRO_TEXT} ${RUO_AGE_TEXT} ${RUO_AGREEMENT_TEXT}`

/**
 * Has this signed-in customer already accepted the CURRENT RUO_VERSION at
 * any point (checkout or standalone)? Guests always re-accept per
 * checkout by design -- this check only ever applies to a real User.id.
 */
export async function hasAcceptedCurrentRuo(userId: string): Promise<boolean> {
  const existing = await prisma.complianceAcknowledgment.findFirst({
    where: { userId, version: RUO_VERSION },
    select: { id: true },
  })
  return existing != null
}

interface RecordAcceptanceParams {
  // The internal User.id (a separate cuid) -- NEVER a raw Clerk user id.
  // Every call site must resolve Clerk's auth().userId to this via
  // upsertUserByClerkId()/findUserIdByClerkId() (lib/user.ts) first;
  // ComplianceAcknowledgment.userId is a real foreign key to User.id and
  // Postgres will reject a write with a Clerk-shaped id (caught 2026-08-12
  // while auditing this module for the pre-signup RUO gate -- every
  // existing write path had this exact bug, so a signed-in customer's
  // checkout previously threw a foreign-key violation the first time this
  // ran; no real customer had hit it yet, pre-launch).
  userId?: string
  orderId?: string
  sessionId?: string
  ipAddress?: string | null
  userAgent?: string | null
  source: 'checkout' | 'standalone' | 'pre_signup'
}

export async function recordRuoAcceptance(params: RecordAcceptanceParams) {
  return prisma.complianceAcknowledgment.create({
    data: {
      userId: params.userId,
      orderId: params.orderId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress ?? undefined,
      userAgent: params.userAgent ?? undefined,
      ruoText: RUO_TEXT,
      version: RUO_VERSION,
      source: params.source,
    },
  })
}

// ─── Pre-signup RUO/21+ gate (2026-08-12) ────────────────────────────────────
// A brand-new visitor accepting the gate at /sign-up has no Clerk session
// yet, so there is no userId to attribute the acceptance to. This records
// it against an opaque, short-lived token instead (carried in an HttpOnly
// cookie -- see components/storefront/RuoSignupGate.tsx and
// app/api/compliance/ruo/pending-accept/route.ts), then links that same
// row to the real User once Clerk signup actually completes
// (app/account/page.tsx's tryResolveNotLinked(), the same place every
// other post-signup identity resolution already happens).
//
// TTL bounds how long a leaked/replayed token could be linked to an
// unrelated account -- signup normally completes in well under this window.
const PENDING_RUO_TTL_MS = 30 * 60 * 1000
export const PENDING_RUO_TTL_SECONDS = PENDING_RUO_TTL_MS / 1000

// Shared between the pending-accept route (sets it), the sign-up page
// (reads it to decide whether to show the gate or <SignUp/>), and the
// account page (reads it to link the acceptance to the new User). A
// route.ts file may only export its HTTP handlers, so this constant lives
// here rather than in the API route itself.
export const RUO_PENDING_COOKIE = 'ruo_pending_token'

function pendingRuoCutoff(): Date {
  return new Date(Date.now() - PENDING_RUO_TTL_MS)
}

/** Has this pending-signup token already recorded a valid, unexpired, unlinked gate acceptance? */
export async function hasValidPendingRuoAcceptance(pendingToken: string): Promise<boolean> {
  const existing = await prisma.complianceAcknowledgment.findFirst({
    where: { sessionId: pendingToken, version: RUO_VERSION, source: 'pre_signup', userId: null, agreedAt: { gte: pendingRuoCutoff() } },
    select: { id: true },
  })
  return existing != null
}

/**
 * Links a pending (pre-account) acceptance to the real, now-created User.
 * Idempotent by construction: the `userId: null` guard in the where clause
 * means a second call for the same token (already linked, expired, or
 * never existed) updates zero rows rather than creating a duplicate or
 * re-linking to a different account. Returns whether a row was actually linked.
 */
export async function linkPendingRuoAcceptanceToUser(pendingToken: string, internalUserId: string): Promise<boolean> {
  const result = await prisma.complianceAcknowledgment.updateMany({
    where: { sessionId: pendingToken, version: RUO_VERSION, source: 'pre_signup', userId: null, agreedAt: { gte: pendingRuoCutoff() } },
    data: { userId: internalUserId },
  })
  return result.count > 0
}
