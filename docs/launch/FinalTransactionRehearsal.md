# Final Controlled Transaction Rehearsal — Procedure

**Purpose**: one real, small, deliberately-reversed transaction through the fully live pipeline (live Stripe key, live checkout, real webhook, real order/invoice records) before announcing checkout publicly — confirms the whole chain works with real money moving through it, not just test-mode/synthetic verification. This is the standard "smoke test with real stakes" step between "code is live" and "customers are using it."

**This procedure is prepared, not executed, by this environment** — it requires `STOREFRONT_CHECKOUT_ENABLED=true` and live Stripe keys, both owner-only actions (see `StripeShippoLiveReadiness.md`). Run this once, right after flipping Stripe live, before any public announcement.

## Pre-conditions
- [ ] Stripe live keys set, `STOREFRONT_CHECKOUT_ENABLED=true`, deployed
- [ ] Live Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set to its live signing secret
- [ ] A real card you're willing to use for a small real charge (your own)

## Procedure

1. **Place one real order** through the actual live storefront checkout — a single, cheap product, your own real shipping address (or a clearly-marked internal one), using a real card.
2. **Verify in order**, checking each system the transaction should touch:
   - [ ] Stripe Dashboard (live mode) shows the payment as succeeded
   - [ ] `app/api/webhooks/stripe` received and processed the event (check Vercel function logs for the deployment, or Stripe's own webhook-delivery log for a 200 response)
   - [ ] Admin → Orders shows the new order with status `PAID`
   - [ ] Admin → Fulfillment Command Center shows it in the "Label Needed" bucket (confirms the fulfillment pipeline picked it up)
   - [ ] The linked Invoice record exists and shows the correct total
   - [ ] The order-confirmation email actually arrived (check the real inbox, not just that `Communication` logged it)
   - [ ] If a Customer Portal account is linked, `/account/orders` shows the order
3. **Reverse it cleanly**:
   - [ ] Issue a full refund through Stripe (live mode) for this order — confirms the refund-reconciliation webhook path (`charge.refunded` → `lib/payments/reconcile.ts`) also works live, not just the happy path
   - [ ] Verify the refund reflects correctly in Admin (Order/Payment status, Finance dashboard's refund report)
   - [ ] If a shipping label was purchased for it (only do this if Shippo purchasing is also live — otherwise skip), void/refund the label per Shippo's own process, and manually correct the `Expense` entry if needed
   - [ ] Cancel/archive the test order and its invoice via the existing admin Archive action (same reversible mechanism used to clean up the rehearsal invoices found this session) so it doesn't sit in real business reporting

## What a failure at any step means

- **Payment succeeds but webhook doesn't fire / order doesn't update**: check the live webhook endpoint URL and signing secret are correct in both Stripe and Vercel — the single most common live-cutover mistake (an easy one: the endpoint often gets registered against the wrong domain, or the test-mode signing secret gets left in place).
- **Email doesn't arrive**: check Resend's live sending status and the `pepscorelab.com` domain-verification status (`docs/PendingOwnerActions.md` #5) — a domain-verification gap means mail still sends, just from Resend's shared sandbox address, which is more likely to land in spam.
- **Refund doesn't reconcile**: check `charge.refunded` is a subscribed event type on the live webhook endpoint (not just `checkout.session.completed`).

## What this environment did NOT do

Did not place a real order, did not process a real payment, did not issue a real refund. This document is a procedure for the owner to run once, not something performed autonomously — matches the explicit instruction that real financial transactions stay owner-only.
