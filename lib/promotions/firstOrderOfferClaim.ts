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
import { hasAnyPriorOrder } from '@/lib/promotions/redemption'
import { logCampaignFunnelEvent } from '@/lib/promotions/funnelEvents'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { firstOrderOfferCodeSubject, buildFirstOrderOfferCodeHtml } from '@/emails/FirstOrderOfferCode'
import { Prisma } from '@prisma/client'
import type { PromotionCode, PromotionType } from '@prisma/client'
import crypto from 'crypto'

const CONFIG_ID = 'singleton'

// 2026-08-19 lead-capture/conversion engine -- versioned disclosure text
// identifier, recorded on every LeadCapture row alongside the two consent
// booleans so the exact wording a visitor agreed to remains reconstructable
// later (bump this string whenever the consent copy in FirstOrderOfferModal
// materially changes).
export const CONSENT_TEXT_VERSION = 'acquisition-v1-2026-08-19'

export interface ClaimFirstOrderOfferInput {
  name: string
  email: string
  phone: string
  emailConsent: boolean
  smsConsent: boolean
  consentIp?: string | null
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
  claim: Prisma.FirstOrderOfferClaimGetPayload<Record<string, never>> | null
  customer: Prisma.CustomerGetPayload<Record<string, never>>
  isNewCustomer: boolean
  alreadyClaimed: boolean
  // 2026-08-19 lead-capture/conversion engine (section 1/3/4/7) -- true
  // when this customer already has real, canonical purchase history
  // (Invoice/Order, ANY sales channel, via hasAnyPriorOrder()) even though
  // they'd never claimed this specific offer before. No new code is
  // issued -- an existing direct-sale customer who is only new to the
  // website/portal must never be told they're eligible for a first-order
  // discount they can't actually redeem (resolvePromotionCode() would
  // reject it anyway, but the misleading email/promise itself is the
  // problem this prevents). The caller shows "Welcome back" messaging
  // instead of a discount promise.
  existingCustomerNotEligible: boolean
  // The customer's unique redemption code -- null only in the
  // (not-currently-possible, since no pre-migration claims exist in
  // production) case of a legacy claim from before code issuance existed,
  // or when existingCustomerNotEligible is true.
  code: string | null
}

export class FirstOrderOfferNotLiveError extends Error {}

// Same name-splitting convention as lib/leads/service.ts's captureLead() --
// Customer.firstName/lastName are both required but this form only
// collects one "name" field.
export function splitName(name: string): { firstName: string; lastName: string } {
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
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const DEFAULT_CODE_PREFIX = 'FIRST'

// Sanitizes a campaign's optional admin-entered promoPrefix (section 8) to
// safe code-alphabet characters only, uppercased, capped at 12 chars --
// never trusts it verbatim (an admin-entered value must never introduce
// unexpected characters into a code that's parsed nowhere but is still
// user-facing and support-referenced). Falls back to the original
// hardcoded "FIRST" prefix when unset/empty/entirely invalid, so every
// pre-existing campaign's code shape is unchanged by default.
export function sanitizeCodePrefix(prefix: string | null | undefined): string {
  if (!prefix) return DEFAULT_CODE_PREFIX
  const cleaned = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return cleaned || DEFAULT_CODE_PREFIX
}

export function generatePromotionCodeText(prefix: string = DEFAULT_CODE_PREFIX): string {
  let code = `${prefix}-`
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  return code
}

const MAX_CODE_GENERATION_ATTEMPTS = 5

async function issueUniquePromotionCode(
  tx: Prisma.TransactionClient,
  input: { campaignId: string; customerId: string; discountType: PromotionType; discountValue: number; expiresAt: Date | null; codePrefix?: string }
): Promise<PromotionCode> {
  const { codePrefix, ...data } = input
  for (let attempt = 1; attempt <= MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await tx.promotionCode.create({ data: { code: generatePromotionCodeText(codePrefix), ...data } })
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
    return {
      claim: existingClaim,
      customer,
      isNewCustomer,
      alreadyClaimed: true,
      existingCustomerNotEligible: false,
      code: existingClaim.promotionCode?.code ?? null,
    }
  }

  // 2026-08-19 lead-capture/conversion engine (section 1/3/4/7): an
  // existing direct-sale customer with real prior purchase history on ANY
  // channel is never eligible for a first-order offer merely because
  // they're new to the website/lead-capture flow or have never claimed
  // this specific popup before. Checked here, at ISSUANCE time -- the
  // redemption-time check in lib/promotions/redemption.ts's
  // resolvePromotionCode() already existed and stays as the defense-in-
  // depth backstop, but without this issuance-time check a real customer
  // would still receive a misleading "you're eligible" code-delivery
  // email they could never actually redeem. Still records a LeadCapture
  // row (no accompanying code/claim) so the engagement shows up in the
  // admin CRM/attribution history -- this is a real signal worth keeping,
  // just never a discount promise.
  if (await hasAnyPriorOrder(customer.id)) {
    await prisma.leadCapture.create({
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
        consent: input.emailConsent,
        emailConsent: input.emailConsent,
        smsConsent: input.smsConsent,
        consentTextVersion: CONSENT_TEXT_VERSION,
        consentIp: input.consentIp ?? undefined,
      },
    })
    await recordCustomerActivity({
      customerId: customer.id,
      eventType: 'FIRST_ORDER_OFFER_INELIGIBLE_EXISTING_CUSTOMER',
      source: 'SYSTEM',
    })
    return { claim: null, customer, isNewCustomer, alreadyClaimed: false, existingCustomerNotEligible: true, code: null }
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
          consent: input.emailConsent,
          emailConsent: input.emailConsent,
          smsConsent: input.smsConsent,
          consentTextVersion: CONSENT_TEXT_VERSION,
          consentIp: input.consentIp ?? undefined,
        },
      })

      const promotionCode = await issueUniquePromotionCode(tx, {
        campaignId: campaign.id,
        customerId: customer.id,
        discountType: campaign.discountType,
        discountValue: campaign.discountValue,
        expiresAt: campaign.expiresAt,
        codePrefix: sanitizeCodePrefix(campaign.promoPrefix),
      })

      const createdClaim = await tx.firstOrderOfferClaim.create({
        data: {
          customerId: customer.id,
          configId: CONFIG_ID,
          campaignId: campaign.id,
          promotionCodeId: promotionCode.id,
          leadCaptureId: lead.id,
          consent: input.emailConsent,
          emailConsent: input.emailConsent,
          smsConsent: input.smsConsent,
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
      return {
        claim: raceClaim,
        customer,
        isNewCustomer,
        alreadyClaimed: true,
        existingCustomerNotEligible: false,
        code: raceClaim.promotionCode?.code ?? null,
      }
    }
    throw err
  }

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'FIRST_ORDER_OFFER_CLAIMED',
    newValue: code.code,
    source: 'SYSTEM',
  })

  // Best-effort funnel log for the Admin conversion dashboard (section 21)
  // -- never blocks or fails the claim itself.
  await logCampaignFunnelEvent({ campaignId: campaign.id, eventType: 'POPUP_SUBMITTED', customerId: customer.id, sourcePage: input.sourcePage })

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

  return { claim, customer, isNewCustomer, alreadyClaimed: false, existingCustomerNotEligible: false, code: code.code }
}
