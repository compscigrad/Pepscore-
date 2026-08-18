# Stripe + Shippo — Live-Readiness Checklists

Both integrations are fully built and test-mode verified. Nothing code-side blocks either from going live — every remaining step is an owner action (account credentials, third-party dashboard configuration, or a business decision) followed by a single Vercel env var flip and redeploy.

## Stripe → live

Current state, confirmed live in Admin → Settings → Payments: `STRIPE CONFIGURED / TEST MODE / CHECKOUT DISABLED`.

1. **Request live (non-test) Stripe API keys** from the Stripe Dashboard.
2. **Confirm RUO merchant-category eligibility** — research compounds can trip card-network merchant-category or restricted-goods review at some processors; worth a direct check with Stripe support/account rep before assuming approval, not after going live and getting frozen.
3. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the live values in Vercel (Production environment) — **this is a secret paste, an owner-only action this environment cannot do.**
4. Set `STRIPE_WEBHOOK_SECRET` to the live webhook endpoint's signing secret (register `https://www.pepscorelab.com/api/webhooks/stripe` — or the current testing domain if testing before cutover — as a live-mode webhook endpoint in the Stripe Dashboard first, to get this value).
5. (Optional, Y2) Enable PayPal for the account in the Stripe Dashboard if PayPal-at-checkout is wanted at launch — app-side gate is already built.
6. (Optional, see `SalesTaxDecision.md`) Set up Stripe Tax registrations if sales tax collection applies.
7. Flip `STOREFRONT_CHECKOUT_ENABLED=true` in Vercel.
8. Redeploy.
9. Run the **Final Controlled Transaction Rehearsal** (separate document) before announcing publicly.

**Nothing else changes.** Every checkout code path (webhook handling, refund reconciliation, idempotency, RUO gating, inventory reservation) already runs identically in test and live mode — Stripe's own key determines which.

## Shippo → live (purchasing enabled)

Current state: tracking (real, verified) and the manual-tracking fallback (Pirate Ship + manual entry) are the actual production shipping workflow today. Real label **purchasing** is deliberately blocked — `SHIPPO_PURCHASING_ENABLED` is unset, and this session additionally closed a gap where the Order-side label route could have bypassed that gate.

1. **Complete Shippo's Trust & Safety business-verification review** — pending on Shippo's side, requires the owner's business identity/verification documents. This is the actual bottleneck; nothing on the engineering side is waiting on anything else.
2. Once approved, confirm the account's carrier accounts (USPS/UPS/FedEx/DHL — whichever the owner wants enabled) are connected in the Shippo Dashboard.
3. Confirm `SHIPPO_API_KEY` in Vercel is the **live** key (not `shippo_test_...` — currently a Hobby-era test key retained only so manual-tracking's provider registration doesn't regress) — **secret paste, owner-only.**
4. Flip `SHIPPO_PURCHASING_ENABLED=true` in Vercel.
5. Redeploy.
6. Purchase one real, small, internal test label (see rehearsal doc) before relying on it for real customer orders — confirms the live API key, carrier account, and return address are all correctly wired together, not just individually correct.
7. Once confident, address the 5 currently-queued "Label Needed" paid orders in the Fulfillment Command Center (oldest is 25+ days old as of this writing) — this becomes possible for the first time once step 4 is live.

**Related, independent decision** (see `CheckoutShippingOptions.md`): whether to also start charging real Shippo-calculated shipping at checkout (Option B) rather than the current $0-always behavior — that's a separate decision from purchasing being enabled, and can be built/tested in Shippo test mode at any time regardless of this timeline.

## What this environment did NOT do

Did not request, paste, or handle any live API key or webhook secret. Did not flip any of the four gating env vars mentioned above (`STOREFRONT_CHECKOUT_ENABLED`, `SHIPPO_PURCHASING_ENABLED`, the two Stripe live keys). Did not purchase any real shipping label or process any real payment.
