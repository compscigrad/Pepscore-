// Client-safe copies of the two backorder-compensation policy numbers, for
// storefront display only (the legend, cart/checkout eligibility copy).
// Never import lib/backorders.ts or lib/invoice/backorder.ts into a
// client component to get these -- both pull in server-only dependencies
// (Prisma, Resend) that can't run in the browser. The authoritative
// values live there; these are duplicated on purpose (same convention
// this codebase already uses for round2()/formatMoney() per file) and
// must be kept in sync with BACKORDER_COMPENSATION_AMOUNT
// (lib/backorders.ts) and BACKORDER_AUTOMATIC_MINIMUM_ORDER_TOTAL
// (lib/invoice/backorder.ts).
export const STOREFRONT_BACKORDER_CREDIT_AMOUNT = 25
export const STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL = 100
