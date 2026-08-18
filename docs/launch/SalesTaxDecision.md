# Sales Tax — Decision Document

**Status: no tax calculation exists anywhere in the app today.** `Invoice.tax` is a schema field that defaults to `0` and nothing ever sets it; `app/api/checkout/route.ts` never calculates or charges tax. This document exists so the owner can make one informed decision rather than the engineering environment silently guessing at a legal/tax question.

## Why this is owner-only

Whether Pepscore Lab is required to collect sales tax, in which state(s), and at what rate is a legal/tax-compliance question that depends on facts this environment cannot determine on its own: the business's registered entity state, actual nexus-triggering sales volume by state (economic nexus thresholds vary by state and change over time), and how the specific product category (research peptides, explicitly not for human use) is classified for tax purposes in each relevant state. **This document does not answer that question and should not be treated as tax advice.**

## One fact this environment *can* confirm

`FulfillmentSettings.returnAddress` (the ship-from address configured in Admin → Settings → Fulfillment) is in **Washington, DC**. A business's own ship-from location is the most common trigger for physical-presence sales tax nexus — this alone is a reasonable starting signal that DC collection likely applies, but confirming that (and any other state's economic-nexus exposure from order volume) requires the owner's own judgment or a tax advisor, not this environment.

## Recommended path: Stripe Tax

Given Stripe is already the payment processor, **Stripe Tax** is the lowest-effort correct option — it calculates the right rate per jurisdiction automatically at checkout, based on registrations the owner adds in the Stripe Dashboard, without Pepscore needing to maintain its own rate tables.

### What the owner needs to do (Stripe Dashboard, not code)
1. In the Stripe Dashboard → **Tax** → confirm/enable Stripe Tax on the account (may already default-enable on some account types — worth checking either way).
2. Add a **tax registration** for at minimum DC (the confirmed ship-from state), and any other state the owner/advisor determines has nexus.
3. Decide the product tax category — Stripe Tax lets you assign a tax code per product/price; for a research-use-only, non-consumable compound this is very likely *not* a standard taxable-goods code, but the exact classification is a business/tax-advisor call, not an engineering one.

### Exact code change once the owner decides to enable it

This is a small, contained change — one field added to the existing `stripe.checkout.sessions.create()` call in `app/api/checkout/route.ts`:

```ts
const session = await stripe.checkout.sessions.create({
  // ...existing fields (payment_method_types, mode, ui_mode, line_items, etc.)...
  automatic_tax: { enabled: true },
  // Stripe Tax needs the shipping address before it can calculate a rate;
  // Checkout already collects a shipping address today, so no new customer-
  // facing field is required.
}, { idempotencyKey: order.id })
```

Two follow-on details, not yet decided, that the actual implementation would need to settle at that time (flagging now so they aren't a surprise later):
- Whether `Invoice.tax` should be populated from the Stripe session's `total_details.amount_tax` at webhook time (so admin-side invoice totals reflect what was actually charged) — currently nothing writes this field.
- Whether the storefront cart/checkout UI should show an estimated tax line before the customer reaches Stripe's own tax-inclusive summary, or defer entirely to Stripe's page (Stripe Checkout's embedded mode already shows the calculated tax on its own summary once `automatic_tax` is on — no separate UI work is strictly required to *function* correctly, only to show an estimate earlier in the flow if the owner wants that).

## What this environment did NOT do

- Did not enable `automatic_tax` in code (that's inert until the owner has actually set up registrations in Stripe — turning it on with zero registrations would either calculate $0 tax everywhere or error, neither of which is useful, so this is deliberately left as a documented, ready-to-apply change rather than dead/half-wired code).
- Did not determine or assert any specific tax rate, taxability determination, or nexus conclusion for any state.
- Did not modify `Invoice.tax`, checkout pricing, or any financial calculation.

## Recommended owner action (single line for the consolidated checklist)

**Decide whether Pepscore needs to collect sales tax before storefront checkout goes live; if yes, set up Stripe Tax registrations in the Stripe Dashboard — the code change to turn it on is ready and documented above, roughly a 15-minute engineering task once you've decided.**
