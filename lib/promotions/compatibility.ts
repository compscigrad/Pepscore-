// Authoritative promotion-stacking compatibility engine -- the one place
// every surface (cart, checkout, invoice, Customer Portal, admin manual
// invoicing) must call rather than re-deriving combination rules
// independently. Default Pepscore Lab business rule: one promotion per
// Order. A campaign only combines with another when its own
// stackingPolicy explicitly allows it, and the combined total never
// exceeds MAX_SIMULTANEOUS_PROMOTIONS. See docs/Decisions.md and
// prisma/schema.prisma's PromotionStackingPolicy comment for the full
// reasoning.
//
// This module intentionally only answers "can these campaigns be combined
// with each other" -- it does NOT check per-campaign eligibility (active
// status, date window, product scope, per-customer usage limit, etc.).
// Each promotion in a combination must still independently pass its own
// eligibility check; stacking permission never substitutes for it.
import type { PromotionStackingPolicy } from '@prisma/client'

// Current fixed business rule (docs/Decisions.md): standard promotions
// max 1, Family & Friends may add exactly one more, absolute ceiling 2.
// Intentionally a single constant rather than a schema field for now --
// making this admin-configurable is real future work, not required by
// today's requirement.
export const MAX_SIMULTANEOUS_PROMOTIONS = 2

export interface StackableCampaign {
  id: string
  stackingPolicy: PromotionStackingPolicy
}

// Pure pairwise check.
export function canCampaignsCombine(a: StackableCampaign, b: StackableCampaign): boolean {
  if (a.id === b.id) return false
  if (a.stackingPolicy === 'NOT_STACKABLE' || b.stackingPolicy === 'NOT_STACKABLE') return false
  // Two Family & Friends-class campaigns cannot stack with each other --
  // "may combine with one OTHER eligible promotion," not with a second
  // instance of itself.
  if (a.stackingPolicy === 'PRIVILEGED_STACKABLE' && b.stackingPolicy === 'PRIVILEGED_STACKABLE') return false
  return true
}

// Whether a proposed *set* of campaigns (every campaign that would be
// simultaneously applied to one Order) is a valid combination -- enforces
// both the pairwise rule above and the absolute cap on simultaneous
// promotions. Every pair in the set must be independently compatible, not
// just each new addition against the most recent one.
export function canApplyCampaignSet(campaigns: StackableCampaign[]): boolean {
  if (campaigns.length > MAX_SIMULTANEOUS_PROMOTIONS) return false
  if (campaigns.length <= 1) return true
  for (let i = 0; i < campaigns.length; i++) {
    for (let j = i + 1; j < campaigns.length; j++) {
      if (!canCampaignsCombine(campaigns[i], campaigns[j])) return false
    }
  }
  return true
}
