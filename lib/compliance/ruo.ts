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
  userId?: string
  orderId?: string
  sessionId?: string
  ipAddress?: string | null
  userAgent?: string | null
  source: 'checkout' | 'standalone'
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
