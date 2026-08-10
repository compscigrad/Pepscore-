// Admin-configurable Promotion Campaign CRUD + lifecycle -- see
// prisma/schema.prisma's PromotionCampaign comment for why this is a
// separate model from Promotion, and docs/Decisions.md for the full
// reasoning. FIRST10 becomes the first configured instance of this system
// (a later, separate slice); this file has zero dependency on the
// existing FirstOrderOfferConfig/Claim flow, which is untouched here.
import { prisma } from '@/lib/prisma'
import type { PromotionCampaign, PromotionCampaignStatus, PromotionType, PromotionStackingPolicy } from '@prisma/client'

export class PromotionCampaignError extends Error {}
export class PromotionCampaignHasHistoryError extends PromotionCampaignError {}

export interface CreatePromotionCampaignInput {
  name: string
  publicTitle: string
  publicDescription?: string | null
  discountType: PromotionType
  discountValue: number
  firstOrderOnly?: boolean
  stackingPolicy?: PromotionStackingPolicy
  startsAt?: Date | null
  expiresAt?: Date | null
  eligibleProductSlugs?: string[]
  excludedProductSlugs?: string[]
  minPurchaseAmount?: number | null
  maxUses?: number | null
  usesPerCustomer?: number
  createdBy: string
}

function validateDiscount(discountType: PromotionType, discountValue: number): void {
  if (discountValue <= 0) throw new PromotionCampaignError('Discount value must be greater than 0.')
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    throw new PromotionCampaignError('A percentage discount cannot exceed 100.')
  }
}

// New campaigns always start DRAFT and never as the default -- becoming
// live is always a deliberate activate step (see activateDefaultFirstOrderCampaign),
// never implicit at creation time.
export async function createPromotionCampaign(input: CreatePromotionCampaignInput): Promise<PromotionCampaign> {
  validateDiscount(input.discountType, input.discountValue)
  return prisma.promotionCampaign.create({
    data: {
      name: input.name,
      publicTitle: input.publicTitle,
      publicDescription: input.publicDescription ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      firstOrderOnly: input.firstOrderOnly ?? true,
      // Every campaign, including a first-order acquisition offer,
      // defaults to non-stackable -- an admin must deliberately opt a
      // campaign into stacking, it's never assumed.
      stackingPolicy: input.stackingPolicy ?? 'NOT_STACKABLE',
      status: input.startsAt && input.startsAt.getTime() > Date.now() ? 'SCHEDULED' : 'DRAFT',
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      eligibleProductSlugs: input.eligibleProductSlugs ?? [],
      excludedProductSlugs: input.excludedProductSlugs ?? [],
      minPurchaseAmount: input.minPurchaseAmount ?? null,
      maxUses: input.maxUses ?? null,
      usesPerCustomer: input.usesPerCustomer ?? 1,
      createdBy: input.createdBy,
    },
  })
}

export interface UpdatePromotionCampaignInput {
  name?: string
  publicTitle?: string
  publicDescription?: string | null
  discountType?: PromotionType
  discountValue?: number
  stackingPolicy?: PromotionStackingPolicy
  startsAt?: Date | null
  expiresAt?: Date | null
  eligibleProductSlugs?: string[]
  excludedProductSlugs?: string[]
  minPurchaseAmount?: number | null
  maxUses?: number | null
  usesPerCustomer?: number
  updatedBy: string
}

// Status transitions (DRAFT/SCHEDULED -> ACTIVE, ACTIVE -> RETIRED,
// RETIRED -> ARCHIVED) deliberately do NOT go through this function --
// they go through the dedicated functions below so each has its own
// auditable, named intent rather than a generic "set any field" path.
export async function updatePromotionCampaign(id: string, input: UpdatePromotionCampaignInput): Promise<PromotionCampaign> {
  const existing = await prisma.promotionCampaign.findUniqueOrThrow({ where: { id } })
  if (existing.status === 'ARCHIVED') {
    throw new PromotionCampaignError('An archived campaign cannot be edited.')
  }
  const discountType = input.discountType ?? existing.discountType
  const discountValue = input.discountValue ?? existing.discountValue
  validateDiscount(discountType, discountValue)

  return prisma.promotionCampaign.update({
    where: { id },
    data: {
      name: input.name,
      publicTitle: input.publicTitle,
      publicDescription: input.publicDescription,
      discountType: input.discountType,
      discountValue: input.discountValue,
      stackingPolicy: input.stackingPolicy,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      eligibleProductSlugs: input.eligibleProductSlugs,
      excludedProductSlugs: input.excludedProductSlugs,
      minPurchaseAmount: input.minPurchaseAmount,
      maxUses: input.maxUses,
      usesPerCustomer: input.usesPerCustomer,
      updatedBy: input.updatedBy,
    },
  })
}

export type OutstandingCodePolicy = 'HONOR' | 'EXPIRE_NOW'

export interface ActivateCampaignInput {
  actorId: string
  outstandingCodePolicy: OutstandingCodePolicy
}

export interface ActivateCampaignResult {
  campaign: PromotionCampaign
  previousDefault: PromotionCampaign | null
  expiredCodeCount: number
}

// Activates `id` as THE default first-order acquisition campaign.
// Transactionally demotes whichever campaign previously held that role
// (-> RETIRED, isDefaultFirstOrderCampaign -> false) and applies the
// admin's chosen outstanding-code policy to its still-ACTIVE codes. Only
// one campaign can ever hold isDefaultFirstOrderCampaign=true at a time;
// this function -- not a DB constraint -- is what enforces that, the same
// singleton-invariant-at-the-service-layer pattern PortalRolloutSettings
// already established this session.
export async function activateDefaultFirstOrderCampaign(id: string, input: ActivateCampaignInput): Promise<ActivateCampaignResult> {
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.promotionCampaign.findUniqueOrThrow({ where: { id } })
    if (campaign.status === 'ARCHIVED') {
      throw new PromotionCampaignError('An archived campaign cannot be reactivated -- create a new campaign instead.')
    }
    if (!campaign.firstOrderOnly) {
      throw new PromotionCampaignError('Only a first-order campaign can become the default first-order offer.')
    }

    const previousDefault = await tx.promotionCampaign.findFirst({
      where: { isDefaultFirstOrderCampaign: true, id: { not: id } },
    })

    let expiredCodeCount = 0
    if (previousDefault) {
      await tx.promotionCampaign.update({
        where: { id: previousDefault.id },
        data: { status: 'RETIRED', isDefaultFirstOrderCampaign: false, updatedBy: input.actorId },
      })
      if (input.outstandingCodePolicy === 'EXPIRE_NOW') {
        const result = await tx.promotionCode.updateMany({
          where: { campaignId: previousDefault.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED', revokedAt: new Date(), revokedBy: input.actorId },
        })
        expiredCodeCount = result.count
      }
      // HONOR is a genuine no-op here -- outstanding codes simply keep
      // their existing status/expiresAt and remain redeemable exactly as
      // before, which is the entire point of "honor until expiration."
    }

    const updated = await tx.promotionCampaign.update({
      where: { id },
      data: { status: 'ACTIVE', isDefaultFirstOrderCampaign: true, updatedBy: input.actorId },
    })

    return { campaign: updated, previousDefault, expiredCodeCount }
  })
}

export async function retirePromotionCampaign(id: string, actorId: string): Promise<PromotionCampaign> {
  return prisma.promotionCampaign.update({
    where: { id },
    data: { status: 'RETIRED', isDefaultFirstOrderCampaign: false, updatedBy: actorId },
  })
}

export async function archivePromotionCampaign(id: string, actorId: string): Promise<PromotionCampaign> {
  const campaign = await prisma.promotionCampaign.findUniqueOrThrow({ where: { id } })
  if (campaign.status === 'ACTIVE') {
    throw new PromotionCampaignError('Retire an active campaign before archiving it.')
  }
  return prisma.promotionCampaign.update({ where: { id }, data: { status: 'ARCHIVED', updatedBy: actorId } })
}

// Safe hard delete only -- refuses if the campaign has ever issued a code
// or has any claim referencing it. Everything with real history must go
// through archive instead, preserving financial/audit integrity.
export async function deletePromotionCampaignIfUnused(id: string): Promise<void> {
  const [codeCount, claimCount] = await Promise.all([
    prisma.promotionCode.count({ where: { campaignId: id } }),
    prisma.firstOrderOfferClaim.count({ where: { campaignId: id } }),
  ])
  if (codeCount > 0 || claimCount > 0) {
    throw new PromotionCampaignHasHistoryError(
      'This campaign has issued codes or claims and cannot be permanently deleted -- archive it instead.'
    )
  }
  await prisma.promotionCampaign.delete({ where: { id } })
}

export async function listPromotionCampaigns(filter?: { status?: PromotionCampaignStatus[] }): Promise<PromotionCampaign[]> {
  return prisma.promotionCampaign.findMany({
    where: filter?.status ? { status: { in: filter.status } } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPromotionCampaign(id: string): Promise<PromotionCampaign | null> {
  return prisma.promotionCampaign.findUnique({ where: { id } })
}

// The one authoritative "what offer is currently live" read -- every
// customer-facing surface (storefront copy, lead-capture modal,
// confirmation email, once wired) should call this rather than reading
// FirstOrderOfferConfig, once that rewiring slice lands.
export async function getActiveDefaultFirstOrderCampaign(): Promise<PromotionCampaign | null> {
  return prisma.promotionCampaign.findFirst({ where: { isDefaultFirstOrderCampaign: true, status: 'ACTIVE' } })
}

// Server-side, reliable activation for a SCHEDULED campaign whose start
// time has arrived -- meant to be called from a cron route
// (app/api/cron/promotion-campaign-schedule/route.ts) so a scheduled
// campaign switch never depends on an admin being logged in at the
// scheduled moment.
export async function activateDueScheduledCampaigns(actorId: string): Promise<ActivateCampaignResult[]> {
  const due = await prisma.promotionCampaign.findMany({
    where: { status: 'SCHEDULED', startsAt: { lte: new Date() } },
  })
  const results: ActivateCampaignResult[] = []
  for (const campaign of due) {
    // Scheduled campaigns are, by construction, meant to become the new
    // default first-order offer -- honors outstanding codes from whatever
    // they're replacing rather than force-expiring them, since an
    // unattended scheduled switch is not the moment for an irreversible
    // expire-now decision nobody explicitly made.
    results.push(await activateDefaultFirstOrderCampaign(campaign.id, { actorId, outstandingCodePolicy: 'HONOR' }))
  }
  return results
}
