// FIRST10 lead-capture claim flow: resolves the active default first-order
// PromotionCampaign, upserts the customer, issues a unique single-
// redemption PromotionCode, and sends the discount email. Deliberately
// kept in its own file, separate from lib/promotions/firstOrderOffer.ts's
// read-only status surface -- this file pulls in the full notification-
// sending pipeline (Resend, and transitively the Twilio SDK via
// lib/notifications/bestEffortSms.ts), which is server-only (uses Node's
// net/tls) and must never end up in a client bundle. firstOrderOffer.ts
// stays free of that dependency specifically so components/storefront/
// Footer.tsx (imported directly by the client component
// CheckoutForm.tsx) can keep rendering the offer banner without pulling
// Twilio into the browser bundle -- confirmed by a real `next build`
// failure when this code lived in the same file as that dependency chain.
import { prisma } from '@/lib/prisma'
import { upsertCustomerFromIntake, recordCustomerActivity } from '@/lib/customers'
import { getActiveFirstOrderOffer } from '@/lib/promotions/firstOrderOffer'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { firstOrderOfferCodeSubject, buildFirstOrderOfferCodeHtml } from '@/emails/FirstOrderOfferCode'
import { Prisma } from '@prisma/client'
import type { PromotionCode, PromotionType } from '@prisma/client'
import crypto from 'crypto'

const CONFIG_ID = 'singleton'

export interface ClaimFirstOrderOfferInput {
  name: string
  email: string
  phone: string
  consent: boolean
  sourcePage: string
  referrer?: string | null
  landingUrl?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
}

export interface ClaimFirstOrderOfferResult {
  claim: Prisma.FirstOrderOfferClaimGetPayload<Record<string, never>>
  customer: Prisma.CustomerGetPayload<Record<string, never>>
  isNewCustomer: boolean
  alreadyClaimed: boolean
  // The customer's unique redemption code -- null only in the
  // (not-currently-possible, since no pre-migration claims exist in
  // production) case of a legacy claim from before code issuance existed.
  code: string | null
}

export class FirstOrderOfferNotLiveError extends Error {}

// Same name-splitting convention as lib/leads/service.ts's captureLead() --
// Customer.firstName/lastName are both required but this form only
// collects one "name" field.
function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() }
}

// Human-readable, low-transcription-error code -- excludes visually
// ambiguous characters (0/O, 1/I/L). The format deliberately doesn't
// encode the discount value in the code text (see docs/Decisions.md) --
// redemption always resolves through the authoritative PromotionCode row,
// never by parsing the code string.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function generatePromotionCodeText(): string {
  let code = 'FIRST-'
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  return code
}

const MAX_CODE_GENERATION_ATTEMPTS = 5

async function issueUniquePromotionCode(
  tx: Prisma.TransactionClient,
  input: { campaignId: string; customerId: string; discountType: PromotionType; discountValue: number; expiresAt: Date | null }
): Promise<PromotionCode> {
  for (let attempt = 1; attempt <= MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await tx.promotionCode.create({ data: { code: generatePromotionCodeText(), ...input } })
    } catch (err) {
      const isCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
      if (!isCollision || attempt === MAX_CODE_GENERATION_ATTEMPTS) throw err
    }
  }
  throw new Error('Failed to generate a unique promotion code after multiple attempts')
}

// Idempotent by design: a customer who somehow submits twice (double-click,
// retried request, repeat visit) gets their existing claim/code back
// rather than a second one -- the DB-level @unique on
// FirstOrderOfferClaim.customerId is what actually guarantees this holds
// even under a genuine race (caught below via the P2002 code), not just
// the upfront findUnique check. This also structurally satisfies "a
// previously redeemed first-order customer does not become eligible again
// merely because the active campaign changes" -- eligibility is keyed on
// the customer, not the campaign.
export async function claimFirstOrderOffer(input: ClaimFirstOrderOfferInput): Promise<ClaimFirstOrderOfferResult> {
  const offer = await getActiveFirstOrderOffer()
  if (!offer.live || !offer.campaign) {
    throw new FirstOrderOfferNotLiveError('The first-order offer is not currently available.')
  }
  const campaign = offer.campaign

  const { firstName, lastName } = splitName(input.name)
  const { customer, isNewCustomer } = await upsertCustomerFromIntake({
    firstName,
    lastName,
    email: input.email,
    phone: input.phone,
  })

  const existingClaim = await prisma.firstOrderOfferClaim.findUnique({
    where: { customerId: customer.id },
    include: { promotionCode: true },
  })
  if (existingClaim) {
    return { claim: existingClaim, customer, isNewCustomer, alreadyClaimed: true, code: existingClaim.promotionCode?.code ?? null }
  }

  let claim: Prisma.FirstOrderOfferClaimGetPayload<Record<string, never>>
  let code: PromotionCode
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.leadCapture.create({
        data: {
          customerId: customer.id,
          interestType: 'FIRST_ORDER_OFFER',
          sourcePage: input.sourcePage,
          referrer: input.referrer ?? undefined,
          landingUrl: input.landingUrl ?? undefined,
          utmSource: input.utmSource ?? undefined,
          utmMedium: input.utmMedium ?? undefined,
          utmCampaign: input.utmCampaign ?? undefined,
          utmTerm: input.utmTerm ?? undefined,
          utmContent: input.utmContent ?? undefined,
          consent: input.consent,
        },
      })

      const promotionCode = await issueUniquePromotionCode(tx, {
        campaignId: campaign.id,
        customerId: customer.id,
        discountType: campaign.discountType,
        discountValue: campaign.discountValue,
        expiresAt: campaign.expiresAt,
      })

      const createdClaim = await tx.firstOrderOfferClaim.create({
        data: {
          customerId: customer.id,
          configId: CONFIG_ID,
          campaignId: campaign.id,
          promotionCodeId: promotionCode.id,
          leadCaptureId: lead.id,
          consent: input.consent,
        },
      })

      return { claim: createdClaim, code: promotionCode }
    })
    claim = result.claim
    code = result.code
  } catch (err) {
    // Unique-constraint race: another request for the same customer won
    // between our findUnique check and the transaction above. Treat it
    // the same as the upfront idempotent-return path rather than a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raceClaim = await prisma.firstOrderOfferClaim.findUniqueOrThrow({
        where: { customerId: customer.id },
        include: { promotionCode: true },
      })
      return { claim: raceClaim, customer, isNewCustomer, alreadyClaimed: true, code: raceClaim.promotionCode?.code ?? null }
    }
    throw err
  }

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'FIRST_ORDER_OFFER_CLAIMED',
    newValue: code.code,
    source: 'SYSTEM',
  })

  // Best-effort, never blocks the claim response -- sendCategorizedEmail
  // catches its own provider errors internally and always resolves,
  // logging SENT/FAILED to the Communication/correspondence log either
  // way (same pattern the claim route's admin notification already uses).
  if (customer.email) {
    await sendCategorizedEmail(
      {
        category: 'FIRST_ORDER_OFFER_CODE',
        to: customer.email,
        subject: firstOrderOfferCodeSubject({
          firstName: customer.firstName,
          publicTitle: campaign.publicTitle,
          publicDescription: campaign.publicDescription,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          code: code.code,
          expiresAt: code.expiresAt,
        }),
        html: buildFirstOrderOfferCodeHtml({
          firstName: customer.firstName,
          publicTitle: campaign.publicTitle,
          publicDescription: campaign.publicDescription,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          code: code.code,
          expiresAt: code.expiresAt,
        }),
      },
      { actorType: 'SYSTEM', customerId: customer.id }
    )
  }

  return { claim, customer, isNewCustomer, alreadyClaimed: false, code: code.code }
}
