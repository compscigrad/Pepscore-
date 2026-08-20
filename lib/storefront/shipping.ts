// Storefront checkout shipping policy (2026-08-20 Price Match sprint --
// fixes a confirmed pre-existing defect: app/api/checkout/route.ts computed
// `const freeShipping = subtotal >= 150; const shippingCost = freeShipping ?
// 0 : 0` -- both branches evaluated to zero, so no order was ever actually
// charged shipping regardless of subtotal, even though the homepage
// announcement bar and cart sidebar both advertise "Free shipping on orders
// over $150" as if a real threshold were enforced. See
// docs/launch/CheckoutShippingOptions.md for the two options that document
// previously weighed (Option A: formalize free-for-everyone; Option B: real
// Shippo rate lookup at checkout time). Owner decision (Price Match sprint,
// 2026-08-20): a flat rate below the threshold, not a dynamic Shippo quote
// -- `getRates()` stays reserved for the admin post-purchase label-buying
// flow (app/api/shipping/labels/route.ts); checkout never calls Shippo.
export const FREE_SHIPPING_THRESHOLD = 150
export const FLAT_SHIPPING_RATE = 15.95

export function resolveShippingCost(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE
}
