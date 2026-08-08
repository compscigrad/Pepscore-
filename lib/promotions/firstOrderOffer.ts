// [Roadmap] 10% first-order storefront offer ("FIRST10"). Config is a
// single-row table (fixed id 'singleton', same upsert pattern as
// lib/invoiceSettings.ts's InvoiceSettings) rather than the reusable
// Promotion catalog (lib/promotions.ts) — see prisma/schema.prisma's
// FirstOrderOfferConfig comment for why the two aren't the same thing.
import { prisma } from '@/lib/prisma'
import { upsertCustomerFromIntake, recordCustomerActivity } from '@/lib/customers'
import { Prisma } from '@prisma/client'

const CONFIG_ID = 'singleton'

export interface FirstOrderOfferConfigData {
  enabled: boolean
  percentage: number
  eligibleProductSlugs: string[]
  expiresAt: Date | null
  stackable: boolean
  updatedAt: Date
  updatedBy: string | null
}

export async function getFirstOrderOfferConfig(): Promise<FirstOrderOfferConfigData> {
  return prisma.firstOrderOfferConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  })
}

// Live means an admin has actually turned the offer on AND it hasn't
// passed its own expiration -- the single check every call site (public
// status endpoint, claim endpoint, storefront banner) should use instead
// of re-deriving `enabled && (!expiresAt || expiresAt > now)` inline.
export function isFirstOrderOfferLive(config: Pick<FirstOrderOfferConfigData, 'enabled' | 'expiresAt'>): boolean {
  if (!config.enabled) return false
  if (config.expiresAt && config.expiresAt.getTime() <= Date.now()) return false
  return true
}

export interface UpdateFirstOrderOfferConfigInput {
  enabled?: boolean
  percentage?: number
  eligibleProductSlugs?: string[]
  expiresAt?: Date | null
  stackable?: boolean
  updatedBy: string
}

export class InvalidFirstOrderOfferConfigError extends Error {}

export async function updateFirstOrderOfferConfig(
  input: UpdateFirstOrderOfferConfigInput
): Promise<FirstOrderOfferConfigData> {
  if (input.percentage !== undefined && (input.percentage <= 0 || input.percentage > 100)) {
    throw new InvalidFirstOrderOfferConfigError('Percentage must be greater than 0 and no more than 100.')
  }

  const data = {
    enabled: input.enabled,
    percentage: input.percentage,
    eligibleProductSlugs: input.eligibleProductSlugs,
    expiresAt: input.expiresAt,
    stackable: input.stackable,
    updatedBy: input.updatedBy,
  }

  return prisma.firstOrderOfferConfig.upsert({
    where: { id: CONFIG_ID },
    update: data,
    create: { id: CONFIG_ID, ...data },
  })
}

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

// Idempotent by design: a customer who somehow submits twice (double-click,
// retried request, repeat visit) gets their existing claim back rather than
// a second row or an error -- the DB-level @unique on
// FirstOrderOfferClaim.customerId is what actually guarantees this holds
// even under a genuine race (caught below via the P2002 code), not just
// the upfront findUnique check.
export async function claimFirstOrderOffer(input: ClaimFirstOrderOfferInput): Promise<ClaimFirstOrderOfferResult> {
  const config = await getFirstOrderOfferConfig()
  if (!isFirstOrderOfferLive(config)) {
    throw new FirstOrderOfferNotLiveError('The first-order offer is not currently available.')
  }

  const { firstName, lastName } = splitName(input.name)
  const { customer, isNewCustomer } = await upsertCustomerFromIntake({
    firstName,
    lastName,
    email: input.email,
    phone: input.phone,
  })

  const existingClaim = await prisma.firstOrderOfferClaim.findUnique({ where: { customerId: customer.id } })
  if (existingClaim) {
    return { claim: existingClaim, customer, isNewCustomer, alreadyClaimed: true }
  }

  try {
    const claim = await prisma.$transaction(async (tx) => {
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

      return tx.firstOrderOfferClaim.create({
        data: {
          customerId: customer.id,
          configId: CONFIG_ID,
          leadCaptureId: lead.id,
          // Snapshotted so a later admin change to the live percentage
          // never retroactively changes what this customer was promised.
          percentage: config.percentage,
          consent: input.consent,
        },
      })
    })

    await recordCustomerActivity({
      customerId: customer.id,
      eventType: 'FIRST_ORDER_OFFER_CLAIMED',
      newValue: `${config.percentage}%`,
      source: 'SYSTEM',
    })

    return { claim, customer, isNewCustomer, alreadyClaimed: false }
  } catch (err) {
    // Unique-constraint race: another request for the same customer won
    // between our findUnique check and the transaction above. Treat it
    // the same as the upfront idempotent-return path rather than a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const claim = await prisma.firstOrderOfferClaim.findUniqueOrThrow({ where: { customerId: customer.id } })
      return { claim, customer, isNewCustomer, alreadyClaimed: true }
    }
    throw err
  }
}
