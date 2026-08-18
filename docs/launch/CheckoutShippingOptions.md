# Checkout Shipping — Options Document

## Current behavior (confirmed by direct code read, `app/api/checkout/route.ts` lines 143-145)

```ts
const freeShipping = subtotal >= 150
const shippingCost = freeShipping ? 0 : 0 // Shippo rates fetched post-checkout
```

Both branches evaluate to `0`. **Every storefront order is charged $0 shipping at checkout today, regardless of subtotal** — the `freeShipping` variable is computed but doesn't currently change anything. The real shipping cost gets recorded later, when an admin purchases a Shippo label (`app/api/shipping/labels/route.ts` sets `Order.shippingCost` to the real label cost at that point) — but nothing charges the customer that amount after the fact; it's recorded for the business's own accounting (`Expense` ledger), not billed.

## Why this matters for launch

The homepage banner reads **"FREE SHIPPING ON ORDERS OVER $150."** Today, every order gets free shipping — an order under $150 is *more* generous than advertised, never less, so this isn't a customer-harming bug. But it does mean the $150 threshold isn't actually enforced anywhere yet, and once `SHIPPO_PURCHASING_ENABLED` clears Trust & Safety review, sub-$150 orders will keep costing the business real postage with no charge collected unless this is addressed.

## Two options

### Option A — Keep deferred shipping (no checkout-time charge), formalize it as a business decision
Storefront checkout stays exactly as-is. The business absorbs shipping cost on all orders (or continues manually invoicing shipping separately for large/international orders via the existing admin invoice flow, which already supports it). Requires: updating the homepage banner copy to accurately reflect "always free" rather than "free over $150" (or leaving it, if the $150 threshold is meant to apply to a *future* enforcement rather than today) — a copy decision, not an engineering one.

**Effort to formalize: zero code change, one copy decision.**

### Option B — Charge real Shippo-calculated shipping at checkout time for orders under $150
`GET /api/shipping/labels/rates` already exists and calls `lib/shippo.ts`'s `getRates()` — the exact function needed already works, it's just not called during storefront checkout today (only from the admin label-creation flow, post-purchase). Wiring it into checkout would mean:

1. Before creating the Stripe session, if `subtotal < 150`: call `getRates()` with the fulfillment settings' return address and the customer's shipping address (already collected in the checkout form) to get a real rate.
2. Pass that rate into the existing `shipping_options` block (already present in the Stripe session — currently dead code since `shippingCost` is always `0`).
3. Decide which Shippo rate tier to charge (cheapest/fastest — a product decision, not technical) and whether to show the calculated rate to the customer before they reach Stripe's summary (Stripe Checkout will show it either way once `shipping_options` has a non-zero amount).

This does **not** purchase a label or spend real postage at checkout time — `getRates()` is a quote-only call, completely separate from `purchaseLabel()` (which stays gated behind `SHIPPO_PURCHASING_ENABLED`, unaffected by this). The label itself is still purchased later by the admin, same as today; this option only changes what the *customer* is charged at checkout to match.

**Effort to implement: small-to-medium — one new rate-lookup call in the checkout route, a rate-tier decision, and one test pass. Not done this session** (matches the instruction to prepare options, not implement, for this specific item) — ready to build in a follow-up once the owner picks an option.

## Recommendation

If the owner is comfortable absorbing shipping cost on sub-$150 orders indefinitely (Option A), no engineering work is needed before launch — just confirm the homepage copy still says what's actually true. If real shipping charges are wanted before or at launch (Option B), this is a same-day implementation once Shippo purchasing itself is live (Option B's rate lookup depends on the same Shippo account/API access as label purchasing — no reason to build it before that account clears review, since there'd be nothing live to rate-shop against in the interim... actually `getRates()` doesn't require `SHIPPO_PURCHASING_ENABLED` to be on, it works today in test mode. So Option B *could* be built and tested now, independent of the Trust & Safety timeline, if desired).

**Owner decision needed: Option A (formalize free-for-everyone, update copy) or Option B (build real checkout-time shipping charges)?**
