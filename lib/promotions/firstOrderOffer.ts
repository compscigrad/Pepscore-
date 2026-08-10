// FIRST10 offer status -- lightweight, read-only surface deliberately kept
// free of any notification-sending dependency (Resend/Twilio) so it stays
// safe to import from components/storefront/Footer.tsx, which renders on
// every storefront page load. The actual claim flow (which needs to send
// the discount email) lives in lib/promotions/firstOrderOfferClaim.ts --
// see that file's header for why the split exists: Footer.tsx is
// statically imported by the client component CheckoutForm.tsx (pre-
// existing code), and Next.js's client bundler cannot tolerate a
// Node-only dependency like the Twilio SDK anywhere in that import graph,
// even though Footer itself only ever runs on the server.
//
// Offer content (discount type/value, eligibility, expiration) now comes
// from the active default first-order PromotionCampaign
// (lib/promotions/campaigns.ts) instead of a hardcoded/config-only
// percentage. FirstOrderOfferConfig.enabled remains a separate,
// independent master switch (layered kill-switch pattern, matching every
// other feature in this app) -- the offer is only ever live when BOTH the
// master switch is on AND a campaign is actively designated the default
// first-order offer. See docs/Decisions.md for the full migration
// reasoning.
import { prisma } from '@/lib/prisma'
import { getActiveDefaultFirstOrderCampaign } from '@/lib/promotions/campaigns'
import type { PromotionCampaign } from '@prisma/client'

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

// Pure -- the master switch AND an active, unexpired default first-order
// campaign must both be true. Kept separate from getActiveFirstOrderOffer()
// so this specific rule is independently unit-testable with no database.
export function computeFirstOrderOfferLive(
  config: Pick<FirstOrderOfferConfigData, 'enabled'>,
  campaign: Pick<PromotionCampaign, 'status' | 'expiresAt'> | null
): boolean {
  if (!config.enabled) return false
  if (!campaign) return false
  if (campaign.status !== 'ACTIVE') return false
  if (campaign.expiresAt && campaign.expiresAt.getTime() <= Date.now()) return false
  return true
}

export interface ActiveFirstOrderOffer {
  live: boolean
  config: FirstOrderOfferConfigData
  campaign: PromotionCampaign | null
}

// The one read every customer-facing surface (storefront banner/modal,
// public status endpoint) and the claim flow itself should call --
// resolving live status, copy, and discount shape from the same source
// every time, never re-deriving it independently per call site.
export async function getActiveFirstOrderOffer(): Promise<ActiveFirstOrderOffer> {
  const [config, campaign] = await Promise.all([getFirstOrderOfferConfig(), getActiveDefaultFirstOrderCampaign()])
  return { live: computeFirstOrderOfferLive(config, campaign), config, campaign }
}

export interface UpdateFirstOrderOfferConfigInput {
  enabled?: boolean
  updatedBy: string
}

export class InvalidFirstOrderOfferConfigError extends Error {}

// Narrowed to just the master on/off switch -- percentage/eligibleProductSlugs/
// expiresAt/stackable now live on the active PromotionCampaign
// (Admin -> Promotions) instead of this config row. Kept the same
// upsert-on-singleton shape as before rather than introducing a new
// settings model for one boolean.
export async function updateFirstOrderOfferConfig(input: UpdateFirstOrderOfferConfigInput): Promise<FirstOrderOfferConfigData> {
  return prisma.firstOrderOfferConfig.upsert({
    where: { id: CONFIG_ID },
    update: { enabled: input.enabled, updatedBy: input.updatedBy },
    create: { id: CONFIG_ID, enabled: input.enabled, updatedBy: input.updatedBy },
  })
}
