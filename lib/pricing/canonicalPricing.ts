// THE canonical, server-side-authoritative pricing engine (2026-08-19
// Professional Access sprint). Every surface that resolves a real
// transaction price -- storefront checkout, admin-created invoices, repeat
// orders, invoice recalculation -- must call resolveCanonicalPricing()
// rather than re-implementing any part of this logic locally. There is
// exactly one pricing truth in this codebase; this file is it.
//
// Root cause this replaces: resolveCheckoutLine() (lib/storefront/
// checkoutPricing.ts) used to resolve a per-sell-unit catalog price with NO
// entitlement check at all -- it would happily return the Professional
// price for a CASE_PRO request regardless of who was asking, because
// nothing between the client-submitted sellUnit and the returned price
// verified Customer.proEligible. The audit that preceded this sprint named
// this the P0 defect. This engine closes it by requiring every caller to
// supply an already-server-resolved PricingContext -- proEligible must come
// from a real Customer row looked up by the caller (Clerk session -> User
// -> Customer, or an admin's explicit customer selection), never from
// anything the client submits. Requesting CASE_PRO without proEligible (and
// without the admin escape hatch) throws before any price is computed or
// returned -- see ProfessionalPricingUnauthorizedError below.
import type { SellUnit } from './sellUnits'
import { resolveCaseSize } from './sellUnits'

// ─── Standard-customer case-volume ladder (locked business decision,
// 2026-08-19 audit + this sprint) ───────────────────────────────────────────
// 1-2 cases: 0% · 3-4: 5% · 5-9: 8% · 10-14: 10% · 15+: 15%. Automatic,
// server-side, never a coupon code. Applies only to CASE_STANDARD lines --
// CASE_PRO, CASE_BULK, and INDIVIDUAL_VIAL never participate (Professional
// pricing never stacks with this ladder; Bulk and Individual Vial are their
// own separate pricing tiers, not "cases" for this ladder's purposes).
export interface VolumeTier {
  minCases: number
  maxCases: number | null
  rate: number
}

export const STANDARD_VOLUME_TIERS: VolumeTier[] = [
  { minCases: 1, maxCases: 2, rate: 0 },
  { minCases: 3, maxCases: 4, rate: 0.05 },
  { minCases: 5, maxCases: 9, rate: 0.08 },
  { minCases: 10, maxCases: 14, rate: 0.10 },
  { minCases: 15, maxCases: null, rate: 0.15 },
]

export function getVolumeDiscountRate(qualifyingCases: number): number {
  if (qualifyingCases <= 0) return 0
  const tier = STANDARD_VOLUME_TIERS.find((t) => qualifyingCases >= t.minCases && (t.maxCases === null || qualifyingCases <= t.maxCases))
  return tier?.rate ?? (qualifyingCases >= 15 ? 0.15 : 0)
}

// The tier a customer would move into by adding N more qualifying cases --
// powers the storefront's "add 1 more case to unlock 8%" progress messaging
// (section 8). Returns null once already at the top tier.
export function getNextVolumeTier(qualifyingCases: number): { casesNeeded: number; rate: number } | null {
  const currentRate = getVolumeDiscountRate(qualifyingCases)
  const next = STANDARD_VOLUME_TIERS.find((t) => t.rate > currentRate)
  if (!next) return null
  return { casesNeeded: next.minCases - qualifyingCases, rate: next.rate }
}

// ─── Entitlement-aware per-line pricing ────────────────────────────────────

export class ProfessionalPricingUnauthorizedError extends Error {}
export class PricingLineUnavailableError extends Error {}

export interface PricingProduct {
  activeStandardCasePrice: number | null
  activeProCasePrice: number | null
  activeBulkPrice: number | null
  activeIndividualVialPrice: number | null
  individualSalesEnabled: boolean
  unitsPerCase: number | null
}

export interface PricingContext {
  // MUST be resolved server-side by the caller from a real Customer row --
  // never pass a client-submitted value here. See this file's header.
  proEligible: boolean
  // Admin-only escape hatch (mirrors getAvailableSellUnits' adminContext) --
  // lets a trusted admin compose ANY sell-unit line on a direct-sale
  // invoice regardless of the selected customer's entitlement, for the
  // explicit, auditable manual-override cases this sprint's spec requires
  // preserving. Storefront/checkout callers must NEVER set this true.
  allowManualOverride?: boolean
}

export interface PricingLineRequest {
  product: PricingProduct
  sellUnit: SellUnit | null | undefined
  quantity: number
}

export type PricingSource = 'STANDARD' | 'STANDARD_VOLUME_DISCOUNT' | 'PROFESSIONAL' | 'BULK' | 'INDIVIDUAL'

export interface ResolvedPricingLine {
  sellUnit: SellUnit
  unitsPerSellUnit: number
  quantity: number
  // The tier's sticker price, before the standard volume ladder is applied.
  catalogUnitPrice: number
  volumeDiscountRate: number
  // Final authoritative per-unit and line prices -- the only numbers any
  // caller may charge, store, or display as the real price.
  unitPrice: number
  lineTotal: number
  pricingSource: PricingSource
}

// Step 1 -- resolves ONE line's catalog tier price and enforces entitlement.
// Deliberately does not apply the volume ladder (that requires seeing every
// line in the order at once, see resolveCanonicalPricing below) -- this is
// the unit the entitlement check lives on, so it's tested in isolation from
// the aggregation logic.
export function resolvePricingLine(req: PricingLineRequest, ctx: PricingContext): Omit<ResolvedPricingLine, 'volumeDiscountRate' | 'unitPrice' | 'lineTotal' | 'pricingSource'> & { pricingSource: Exclude<PricingSource, 'STANDARD_VOLUME_DISCOUNT'> } {
  const { product } = req
  const caseSize = resolveCaseSize(product.unitsPerCase)
  const requested = req.sellUnit ?? 'CASE_STANDARD'

  if (requested === 'CASE_PRO') {
    if (!ctx.proEligible && !ctx.allowManualOverride) {
      // Never leak the Professional price in the error, never partially
      // resolve -- the caller gets a clean rejection and nothing else.
      throw new ProfessionalPricingUnauthorizedError('Professional pricing requires an active Professional Access account.')
    }
    if (product.activeProCasePrice === null) {
      throw new PricingLineUnavailableError('Professional Case pricing is not available for this product.')
    }
    return { sellUnit: 'CASE_PRO', unitsPerSellUnit: caseSize, quantity: req.quantity, catalogUnitPrice: product.activeProCasePrice, pricingSource: 'PROFESSIONAL' }
  }

  if (requested === 'CASE_BULK') {
    if (product.activeBulkPrice === null) throw new PricingLineUnavailableError('Bulk pricing is not available for this product.')
    return { sellUnit: 'CASE_BULK', unitsPerSellUnit: caseSize, quantity: req.quantity, catalogUnitPrice: product.activeBulkPrice, pricingSource: 'BULK' }
  }

  if (requested === 'INDIVIDUAL_VIAL') {
    // Professional accounts never see Individual Vial purchasing (section
    // 7) -- enforced here, not just hidden in the UI, so a crafted request
    // from an otherwise-legitimate Professional session still can't buy a
    // single vial through this path. Admin composition keeps its existing
    // bypass (see getAvailableSellUnits' own adminContext precedent).
    if (ctx.proEligible && !ctx.allowManualOverride) {
      throw new PricingLineUnavailableError('Individual Vial purchasing is not available for Professional Access accounts.')
    }
    if (!ctx.allowManualOverride && !product.individualSalesEnabled) {
      throw new PricingLineUnavailableError('Individual Vial is not currently available for this product.')
    }
    if (product.activeIndividualVialPrice === null) throw new PricingLineUnavailableError('Individual Vial pricing is not available for this product.')
    return { sellUnit: 'INDIVIDUAL_VIAL', unitsPerSellUnit: 1, quantity: req.quantity, catalogUnitPrice: product.activeIndividualVialPrice, pricingSource: 'INDIVIDUAL' }
  }

  // CASE_STANDARD -- a Professional-eligible customer buying a product that
  // itself HAS a Professional price should never land here in practice (the
  // storefront transformation removes Standard as a selectable option for
  // that product, section 7); a crafted request is still correctly priced
  // at Standard, never silently upgraded or downgraded, since nothing about
  // requesting Standard is itself unauthorized.
  if (product.activeStandardCasePrice === null) throw new PricingLineUnavailableError('Standard Case pricing is not available for this product.')
  return { sellUnit: 'CASE_STANDARD', unitsPerSellUnit: caseSize, quantity: req.quantity, catalogUnitPrice: product.activeStandardCasePrice, pricingSource: 'STANDARD' }
}

// Step 2 -- the case-volume aggregation rule (section 4): qualifying cases
// are summed across every CASE_STANDARD line in the order, regardless of
// which product they're for. CASE_PRO/CASE_BULK/INDIVIDUAL_VIAL quantities
// are never converted into "cases" merely to help reach a tier.
export function computeQualifyingCaseCount(lines: Pick<ResolvedPricingLine, 'sellUnit' | 'quantity'>[]): number {
  return lines.filter((l) => l.sellUnit === 'CASE_STANDARD').reduce((sum, l) => sum + l.quantity, 0)
}

// The one entry point every real pricing surface should call. Resolves
// every line's catalog price + entitlement (step 1), then applies the
// standard volume ladder across the whole set (step 2) -- one discount rate,
// computed from the total qualifying case count, applied uniformly to every
// CASE_STANDARD line. Throws (never silently downgrades) on an
// unauthorized or unavailable line; callers should resolve all lines inside
// one try/catch and treat any throw as "reject the whole cart/invoice
// change," matching resolveCheckoutLine's existing convention.
export function resolveCanonicalPricing(requests: PricingLineRequest[], ctx: PricingContext): ResolvedPricingLine[] {
  const step1 = requests.map((req) => resolvePricingLine(req, ctx))
  const qualifyingCases = computeQualifyingCaseCount(step1)
  const rate = getVolumeDiscountRate(qualifyingCases)

  return step1.map((line) => {
    const isStandard = line.sellUnit === 'CASE_STANDARD'
    const appliedRate = isStandard ? rate : 0
    const unitPrice = round2(line.catalogUnitPrice * (1 - appliedRate))
    return {
      ...line,
      volumeDiscountRate: appliedRate,
      unitPrice,
      lineTotal: round2(unitPrice * line.quantity),
      pricingSource: isStandard && appliedRate > 0 ? 'STANDARD_VOLUME_DISCOUNT' : line.pricingSource,
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
