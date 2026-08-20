// Client-side PREVIEW of the canonical standard-customer volume-discount
// ladder (2026-08-19 Professional Access Closure Pass, section 1). Pure,
// no I/O -- safe to import into any client component. This is explicitly
// a preview, not the authoritative price: checkout always re-resolves the
// real amount server-side via lib/pricing/canonicalPricing.ts, exactly the
// same "never trust the client" discipline the pre-existing promo-code
// preview (CheckoutForm's promoDiscountAmount) already documents for
// itself. Mirrors computeQualifyingCaseCount/getVolumeDiscountRate/
// getNextVolumeTier from the canonical engine rather than reimplementing
// the ladder's numbers -- imported directly since that module is also pure
// and has no server-only dependency.
import { getVolumeDiscountRate, getNextVolumeTier } from '@/lib/pricing/canonicalPricing'
import type { CartItem } from '@/types'

export interface VolumePricingPreview {
  qualifyingCases: number
  standardSubtotal: number
  discountRate: number
  discountAmount: number
  finalSubtotal: number
  nextTier: { casesNeeded: number; rate: number } | null
}

export function computeVolumePricingPreview(items: Pick<CartItem, 'sellUnit' | 'quantity' | 'price'>[]): VolumePricingPreview {
  const standardLines = items.filter((i) => (i.sellUnit ?? 'CASE_STANDARD') === 'CASE_STANDARD')
  const qualifyingCases = standardLines.reduce((sum, i) => sum + i.quantity, 0)
  const standardSubtotal = round2(standardLines.reduce((sum, i) => sum + i.price * i.quantity, 0))
  const discountRate = getVolumeDiscountRate(qualifyingCases)
  const discountAmount = round2(standardSubtotal * discountRate)
  return {
    qualifyingCases,
    standardSubtotal,
    discountRate,
    discountAmount,
    finalSubtotal: round2(standardSubtotal - discountAmount),
    nextTier: getNextVolumeTier(qualifyingCases),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
