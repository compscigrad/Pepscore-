// Shared display labels for pricing tiers/sources, used by both the admin
// product-detail page's Price Change History table and the admin pricing
// panel's global-update preview (Phase 3B item 4) -- one source of truth so
// the two surfaces never drift into calling the same tier something
// different.
export const SELL_UNIT_LABEL: Record<string, string> = {
  STANDARD_CASE: 'Standard Case',
  PRO_CASE: 'Professional Case',
  // Historical only -- 2 real ProductPriceChange rows predate the
  // 2026-08-19 Professional Access rename and still say SPA_CASE (preserved,
  // not rewritten). Kept here only so the Price Change History table
  // renders a sensible label for those two old rows instead of the raw
  // enum string; every new price change writes PRO_CASE above.
  SPA_CASE: 'Professional Case',
  BULK: 'Bulk',
  // Value is the customer/admin-facing label (2026-08-13 terminology
  // update: "Individual Vial" -> "Single Vial"); the key stays
  // INDIVIDUAL_VIAL (the stable PriceChangeSellUnit enum value) since
  // internal field/enum names are never renamed just for UI copy.
  INDIVIDUAL_VIAL: 'Single Vial',
}

export const PRICE_SOURCE_LABEL: Record<string, string> = {
  ADMIN_PRICING_PAGE: 'Admin Pricing Page',
  INVOICE_LINE_UPDATE_PRODUCT_PRICE: 'Invoice Line — Update Product Price',
  CATALOG_SEED: 'Catalog Seed',
}
