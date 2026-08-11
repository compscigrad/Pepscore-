# Payment + External-Services Readiness Report

**Date:** 2026-08-08
**Scope:** PRs #107–#119, this session. Grounded in `docs/Decisions.md` entries #22–#34 (Shippo/tracking, Twilio, and the full payment-provider arc); every claim below traces to a specific decision entry, a specific file, or a specific live-verified production check performed during this session.

**Bottom line: no real money moved, no real postage was purchased, and no real bulk customer message was sent at any point this session.** Every live-activation switch remains in its safe, fail-closed default state. This report exists to give the owner a single place to see exactly what's real, what's owner-gated, and what remains to flip before any of it goes live.

---

## 1. Live switches — current state (verified, not assumed)

| Switch | Current state | Effect while off | Where |
|---|---|---|---|
| `STOREFRONT_CHECKOUT_ENABLED` | **Unset (off)** — confirmed absent from `.env.local`, and confirmed live in production at every single verification point across PRs #113–#119 (checkout page has shown "Online Ordering Is Coming Soon" every time it was checked, most recently after PR #118/#119) | Storefront checkout unreachable — `app/checkout/page.tsx` renders `CheckoutComingSoon` and never sends the client-side code to the browser; `app/api/checkout/route.ts` also independently rejects with 503 as a second, server-side gate | `lib/storefront/checkoutGate.ts` |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Test-mode keys** (`sk_test_…` / `pk_test_…`) — confirmed present and test-prefixed | Every Stripe API call this session (checkout sessions, refunds, disputes, saved payment methods, session expiry) hit Stripe's real test-mode API, never live | `lib/stripe.ts` |
| `SHIPPO_PURCHASING_ENABLED` | **Unset (off)** — pre-existing from before this session, untouched | Shipping-label purchasing (real postage spend) blocked at `lib/fulfillment/labels.ts`, independent of whether a Shippo API key is configured; manual tracking (Pirate Ship + manual entry) is unaffected and remains the actual production shipping workflow | Decision #26 |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | **Unset** — confirmed absent from `.env.local` | Every SMS send this session (and in production) resolves to `SKIPPED_NOT_CONFIGURED` — `lib/notifications/bestEffortSms.ts`'s `isSmsConfigured()` fails closed; the inbound STOP/START webhook (`/api/webhooks/twilio`) itself returns 404 with no token configured, so it can't even be reached for real today | Decision #27 |
| `PaymentSettings.paypalEnabled` | **Off by default**, admin-togglable | Even if turned on, PayPal only actually appears at checkout once PayPal is separately enabled for the Stripe account in the Stripe Dashboard (an owner action Stripe itself enforces) — turning the app-side flag on with no Dashboard-side enablement just fails session creation cleanly | Decision #32 |
| `PaymentSettings.cashAppEnabled` | **Off by default**, admin-togglable | Real Stripe Checkout method type, wired, but deliberately left off since it (unlike card/ACH) hasn't been exercised end-to-end this session | Decision #31 |

No code path this session ever charged a card, pulled an ACH debit, purchased a shipping label, or sent a real SMS. Every "real" verification described below and in `docs/Decisions.md` used Stripe's or Twilio's own test/sandbox APIs, disposable rehearsal scripts, and real production **read** operations (page loads, live data checks) — never a real-money or real-postage write.

---

## 2. Payment-provider abstraction (Decision #28)

Audited first: the pre-existing Stripe integration (`lib/stripe.ts`, hosted Checkout Sessions, a 4-value `PaymentStatus` enum) was real but entirely Stripe-shaped, and — a genuine bug found, not assumed — the webhook silently dropped `charge.refunded`, `charge.dispute.created`, and `payment_intent.canceled` entirely, leaving `Payment.status` stuck at `SUCCEEDED` forever after a real refund or dispute.

- `lib/payments/types.ts` + `lib/payments/providers/stripe.ts` — a `PaymentProviderAdapter` interface mirroring the existing, proven `ShippingProvider` pattern (Decision #22): one interface, one real adapter today, a second provider (ACH via another processor, PayPal) is a new file implementing the same interface, not new branches scattered through checkout/webhook code.
- `PaymentProvider`/`StorefrontPaymentMethodType` enums + 6 new `PaymentStatus` values (`PROCESSING`, `AUTHORIZED`, `PARTIALLY_REFUNDED`, `RETURNED`, `CANCELLED`, `DISPUTED`) — all additive, `stripePaymentIntentId`/`stripeFee` untouched.
- The webhook now genuinely reconciles refunds/partial refunds/disputes/cancellations it previously ignored.
- **Verified**: 10 unit tests for the pure Stripe-event normalizer, plus a disposable rehearsal script that drove a seeded `Payment` through a partial refund, a full refund, and a dispute — the full refund case confirmed to move `Order.status` to `REFUNDED`; a partial refund/dispute confirmed to deliberately **not** move it (a real business decision left unmade on purpose, not defaulted silently).

---

## 3. Inventory reservation for storefront Orders (Decision #29)

A real, pre-existing gap found during the ACH audit, not part of the original ask: `app/api/checkout/route.ts` never reserved or deducted `Product` stock for a storefront Order at all, for any payment method — meaning two concurrent checkouts for the last unit of a product could both succeed. Fixed as its own prerequisite PR before ACH was built on top of it.

- New `OrderReservation` model, deliberately separate from the mature, production-active invoice-scoped `InventoryReservation` (never touched, to avoid risking a working system for a then-inactive storefront feature).
- Checkout now reserves every line item inside the same transaction as `Order` creation; a shortfall on a non-backordered item rolls the order back before Stripe is ever called. A Stripe-side failure after that commits releases the reservation and cancels the order.
- **Verified**: a real Stripe test-mode Checkout Session, reserving 2 of 3 units, rejecting a checkout that would exceed the remaining 1 unit (clean rollback, no orphaned Order, no phantom `reservedUnits`), fulfilling via a genuinely-signed `checkout.session.completed` webhook event (confirmed `physicalStockOnHand` actually drops), and releasing via a genuinely-signed `payment_intent.payment_failed` event.

---

## 4. ACH / Pay by Bank (Decision #30)

**Status: implemented, real, test-mode only.**

- `'us_bank_account'` added to Stripe Checkout's `payment_method_types` — Stripe's own hosted/embedded UI collects and verifies the bank account (Financial Connections or manual micro-deposits) and handles mandate collection itself. **This database never receives or stores a raw account/routing number** — only safe references Stripe hands back.
- New `AchAuthorization` model: mandate id, authorization version, timestamp, IP/user agent, revocation state — real evidence a specific debit was authorized, never overwritten.
- The genuinely hard part, solved correctly: ACH doesn't settle synchronously like a card. `checkout.session.completed` now branches on `session.payment_status` — `'paid'` (card) goes to the existing paid path; an async method (`'unpaid'`, i.e. ACH submitted) creates a `PROCESSING` Payment row and **leaves the order/reservation held, never marked paid**. Only `checkout.session.async_payment_succeeded` (which can fire days later, once the debit actually clears) or `checkout.session.async_payment_failed` settle it for real.
- `lib/payments/orderFulfillment.ts`'s `markOrderPaid()` is the single function both the card path and the ACH-success path call — "what happens when an order gets paid" is defined once, not duplicated per method.
- `estimateAchFee()` (0.8% capped at $5, Stripe's real published ACH pricing) used for internal cost tracking instead of the card formula.
- A new `ACH_PAYMENT_PROCESSING` customer email is sent on submission — deliberately never says "confirmed" or "paid."
- **Verified**: a disposable rehearsal test drove the real webhook route with genuinely-signed events covering the full lifecycle — an unpaid `checkout.session.completed` holds the reservation and creates `PROCESSING` (confirmed idempotent on redelivery, no duplicate row), a direct call verified the `AchAuthorization` capture path, a genuinely-signed `async_payment_succeeded` fulfilled the reservation and deducted real stock exactly like the card path, and a genuinely-signed `async_payment_failed` released the reservation and cancelled the order.
- **Honest limitation, stated in Decision #30 itself**: no real browser can complete an embedded Financial Connections bank-linking flow in this environment — verified as far as the session-creation and webhook-reconciliation contract allows, not end-to-end through a live human filling out Stripe's iframe.

---

## 5. Card (Decision #28, #32)

**Status: implemented, real, test-mode only — the most mature path, unchanged in business logic across this whole session.**

Card was already working before this session (hosted Checkout redirect); this session moved it to embedded Checkout (`ui_mode: 'embedded'`, see §7) and folded it into the same provider abstraction and reservation/fulfillment system everything else now shares. Fee: `estimateStripeFee()`, 2.9% + $0.30, unchanged.

---

## 6. Apple Pay / Google Pay / Cash App Pay / PayPal / Venmo (Decision #31, #32)

| Method | Real status |
|---|---|
| **Apple Pay** | Rides on Card automatically — Stripe's own embedded Checkout surfaces it whenever `card` is enabled and the visitor's device/browser supports it. **No separate Stripe Checkout parameter exists for it.** `PaymentSettings.applePayEnabled` is a display-only readiness flag; it is never passed to Stripe as if it were an independent toggle. |
| **Google Pay** | Identical situation to Apple Pay — rides on Card, no independent Checkout parameter, `googlePayEnabled` is readiness-only. |
| **Cash App Pay** | A genuine, distinct Stripe Checkout `payment_method_type` (`'cashapp'`), confirmed against the installed Stripe SDK's own type definitions. Fully wired — `PaymentSettings.cashAppEnabled` is a real gate. **Left off by default** specifically because, unlike card/ACH, it hasn't been exercised end-to-end this session (no rehearsal test specifically drove a Cash App session) — off is the honest default until it has been. |
| **PayPal** | A genuine, distinct Stripe Checkout `payment_method_type` (`'paypal'`), same confirmation method. Wired as a real 4th method in PR #117. **Owner-gated**: it only actually works once PayPal is separately turned on for the Stripe account in the Stripe **Dashboard** — Stripe itself enforces this, not app code. If not enabled there, session creation fails cleanly through the existing error-handling path (reservation released, clear error surfaced) — there is no broken or ambiguous state possible from turning the app-side flag on prematurely. |
| **Venmo** | **Confirmed to have no Stripe Checkout payment method type at all** — checked directly against the installed Stripe SDK's type definitions, not assumed. Venmo is PayPal-owned and only reachable through PayPal's own separate merchant checkout integration, which Stripe does not proxy. `venmoEnabled` stays a **permanent** readiness-only flag; the admin settings page explicitly says why, rather than implying it's simply unbuilt-but-possible the way Apple/Google Pay are. |

---

## 7. Checkout UI (Decision #32)

Moved from a full-page redirect to Stripe's hosted Checkout page, to Stripe's **embedded** Checkout (`ui_mode: 'embedded'`) rendered in-page via `@stripe/react-stripe-js`'s `EmbeddedCheckout` component. `app/checkout/success/page.tsx` now reads the real `Order.status` and shows an honest "Payment Processing" state (not "Order Confirmed") when an ACH order arrives there still `PENDING`.

**Explicit, stated limitation**: true "Pay by Bank — Recommended" *visual promotion* (a distinctly labeled, first-position badge in the payment-method list) is **not** achievable with Embedded Checkout as built — Stripe's own embedded UI controls its own method ordering and presentation. That would require a full rebuild on the raw Payment Element (a materially bigger UI project, not attempted here, since Embedded Checkout let this session reuse 100% of the existing session-based backend — ACH mandate collection, reservation logic, webhook handling — with zero duplication).

**Verified**: a disposable rehearsal test retrieved a real created session back from Stripe's own API and confirmed `ui_mode === 'embedded'`, `client_secret` matched what the route returned, and `url` was `null` (proof it's genuinely embedded, not hosted). No real browser completed an embedded checkout end-to-end in this environment (acknowledged limitation, same as ACH's mandate lookup) — session creation and its resulting Stripe-side object were verified as far as this environment allows.

---

## 8. Saved payment methods (Decision #33)

**Status: implemented, real, test-mode only.**

- `Customer.stripeCustomerId` (lazy — a real audit confirmed no Stripe Customer object existed anywhere in this codebase before this PR; checkout has always been guest/email-based) + `SavedPaymentMethod` (Stripe PaymentMethod id + safe display metadata only — brand/last4/expiry or bank name/last4/type — never a raw number).
- "Add a payment method" in the new Customer Portal `/account/payment-methods` page reuses the **exact same** embedded-Checkout component built for real purchases, just `mode: 'setup'` instead of `'payment'` — one UI pattern for both "pay now" and "save for later."
- Checkout now attaches a returning authenticated customer's real Stripe Customer id to their session when one exists (`customer` param, mutually exclusive with `customer_email` on Stripe's API) — Stripe's own embedded Checkout then surfaces their saved methods automatically. **No custom "choose a saved method" picker was built**; Stripe already does this once a real Customer id is present.
- Portal UI: list / set default / remove — remove genuinely calls `stripe.paymentMethods.detach()`, not just a local soft-delete.
- **Verified**: `getOrCreateStripeCustomer()` confirmed idempotent against a real retrieved Stripe Customer; a real embedded `mode: 'setup'` session created with a genuine `client_secret`; list/set-default/remove exercised against a real PaymentMethod attached via Stripe's own `tok_visa` test token, including confirming removal actually detaches on Stripe's side (verified by retrieving the PaymentMethod back from Stripe afterward).
- **Gap, found by an existing regression guard, fixed**: `app/api/account/portalAuthCoverage.test.ts` (a pre-existing test in this codebase) caught that the new `[id]` route needed an explicit ownership check at the route level, not just inside the service function — fixed to match every other `app/api/account/[id]/**` route's convention.

---

## 9. Admin Payment Settings + processing-cost analytics (Decision #31)

- `PaymentSettings` singleton — `cardEnabled`/`achEnabled`/`cashAppEnabled`/`paypalEnabled` are real gates read by the checkout route to build Stripe's `payment_method_types` array; `applePayEnabled`/`googlePayEnabled`/`venmoEnabled` are honestly-labeled readiness-only flags (see §6). `updatePaymentSettings()` refuses to save a state where every real gate is off.
- `/admin/settings/payments` — provider/test-mode status shown as **booleans only** ("Stripe Configured," "Test Mode," "Checkout Enabled") — never a secret value in the browser.
- `lib/payments/analytics.ts`'s `getPaymentCostAnalytics()` — a real `prisma.payment.groupBy()` aggregation over actual `Payment` rows (only `SUCCEEDED`/`PARTIALLY_REFUNDED`/`REFUNDED`, since a `PROCESSING`/`FAILED` row never incurred a real fee). ACH-vs-card savings uses the exact same fee formulas the estimator functions use (exported as shared named constants specifically so the two can't drift), correctly multiplying the per-transaction fixed-fee component by count rather than a rough blended rate.
- **Verified**: the at-least-one-enabled guard actually rejects an all-off write; disabling ACH was confirmed to change what a real Stripe test-mode session offers by retrieving that exact session back from Stripe's own API; analytics math checked against hand-computed expected values from seeded `Payment` rows.
- **Currently empty in production** — confirmed live: the analytics page shows "No completed payments yet," because no real transaction has ever occurred (checkout has been off this entire session). This is correct, not a bug.

---

## 10. Refunds, partial refunds, disputes, webhook idempotency (Decision #28)

- All three now reconcile correctly (§2) — previously silently dropped.
- Idempotency: the original `checkout.session.completed` handler already guarded against Stripe's own webhook-redelivery behavior via a `stripePaymentIntentId` existence check; every new handler added this session (ACH's `PROCESSING` creation, `async_payment_succeeded`, `async_payment_failed`) follows the same pattern, verified via rehearsal tests that explicitly redelivered an event and confirmed no duplicate row was created.
- **Not built this session**: an admin-facing UI for *issuing* a refund on the storefront `Order`/`Payment` side (the separate admin *Invoice* module already has its own real refund workflow — `InvoiceRefund`, `completeRefund`/`failRefund`/`cancelRefund` in `lib/backorders.ts` — untouched, and not the same system). Reconciling an *externally* issued refund (e.g. from the Stripe Dashboard) into `Payment.status` is real and verified; a storefront "Order" module refund-initiation UI was not requested and was not built.

---

## 11. Order/Invoice reconciliation + inventory/reservation interaction

- Every payment-state transition (paid, failed, refunded, disputed, cancelled) now correctly drives `OrderReservation`'s fulfill/release, matching the same discipline the mature invoice-side `InventoryReservation` system already had.
- Payment-change safety (Decision #34): audited and confirmed a storefront `Order`'s total is fixed at creation and nothing mutates it afterward — except one real, narrow gap: the linked `Invoice` is created as `DRAFT` in the same transaction as the `Order`, before the Stripe session exists, so it's editable in the admin invoice system for the entire checkout window. If a backorder compensation changes that invoice's balance during that window, the now-stale Stripe session is automatically expired (`stripe.checkout.sessions.expire()`), the order cancelled, and its reservation released. **Verified against a real Stripe test-mode session**: confirmed via Stripe's own API that a session's `status` genuinely transitions from `'open'` to `'expired'` when this fires.

---

## 12. Customer Portal integration

| Area | Status |
|---|---|
| Saved payment methods | **Real, live** — `/account/payment-methods` (§8) |
| Storefront Order visibility | **Gap, explicitly flagged, not built this session** — confirmed by audit that the portal's "Orders" nav tab actually renders the *admin invoice module's* `Invoice` records under a customer-friendly label, not the storefront `Order`/`Payment`/Stripe-Checkout-Session model at all. A customer who pays via the real storefront checkout today would have **no portal page showing that specific order's payment/ACH-processing status.** This was flagged as out of scope in both the ACH PR (#115) and the embedded-checkout PR (#117) rather than built partially/inconsistently — it needs its own real design pass, not a bolt-on. |

---

## 13. Twilio A2P 10DLC readiness (Decision #27)

**Engineering: complete.** Sending side was already real (Twilio SDK, E.164 normalization, per-attempt logging) before this session; this session added the missing receiving half — a real, signature-verified inbound webhook (`/api/webhooks/twilio`) that records STOP/START into `Customer.smsOptedOut` and is checked before every customer-facing send, careful never to suppress an admin alert that merely references an opted-out customer.

**Owner checklist — the only remaining steps, all outside this codebase** (verbatim from Decision #27):
1. Register a Twilio A2P 10DLC Brand and Campaign — sample message templates can be pulled directly from the SMS bodies already in the code, which already carry "Reply STOP to opt out of texts."
2. Purchase/port a phone number, attach it to the approved Campaign, set `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_PHONE_NUMBER` in Vercel.
3. Point the number's "a message comes in" webhook at `/api/webhooks/twilio`, confirm Advanced Opt-Out is enabled at the Messaging Service level.
4. Send one real test STOP/START once configured, confirm the "SMS Opted Out" badge appears on the customer profile — the one thing that genuinely couldn't be verified without a live registered number.
5. Never send a real bulk/marketing campaign until the Campaign is fully approved — there is no bulk-SMS send path in this codebase today regardless.

---

## 14. Shippo status (Decision #22–#26) — deferred, not reopened

Real shipment tracking (carrier-agnostic, `ShippingProvider` abstraction) and printerless USPS QR-code labels are fully built and were verified against Shippo's real test API before this session. Live label **purchasing** (real postage spend) is explicitly blocked by `SHIPPO_PURCHASING_ENABLED` (unset = off), independent of whether an API key happens to be configured, while Pepscore's Shippo account awaits Trust & Safety business-registration review. Manual tracking (Pirate Ship + manual entry) is unaffected and remains the actual production shipping workflow. **Not touched this session** — correctly left deferred per standing instruction, not reopened as a blocker.

---

## 15. Exact remaining owner actions (consolidated)

1. **Stripe**: decide when to request live API keys and flip `STOREFRONT_CHECKOUT_ENABLED`. Enable PayPal for the Stripe account in the Dashboard if PayPal is wanted (§6). Confirm RUO merchant-eligibility / compliance review before any live activation (per the standing compliance boundary — not evaluated as part of this engineering work).
2. **Twilio**: the 5-step checklist in §13 — Brand/Campaign registration, number purchase, env vars, webhook registration, one live test.
3. **Shippo**: complete Trust & Safety business-registration review (§14) — unrelated to this session's work, already deferred per standing instruction.
4. **Cash App Pay**: consider a real end-to-end test (even in Stripe test mode) before turning `cashAppEnabled` on, since — unlike card/ACH — it hasn't been exercised this session.
5. **Customer Portal Order visibility** (§12): a real design/engineering decision needed on how a storefront-Order customer should see their own order — not an owner action, but flagged as the clearest remaining engineering gap in the payment arc.

## 16. Explicit confirmation

No real card was charged. No real ACH debit was pulled. No real Apple Pay/Google Pay/Cash App/PayPal/Venmo payment occurred. No real shipping label was purchased or postage spent. No real bulk (or even single, outside of Resend's existing transactional email pipeline) customer SMS was sent. Every Stripe operation this session — session creation, refunds, disputes, PaymentMethod creation/attach/detach, Customer creation, session expiry — ran against Stripe's test-mode API using `sk_test_…` credentials. Every Twilio-related check this session exercised only the receiving/signature-verification path with `TWILIO_*` left unset, which fails closed by design.

---

## 17. Phase 4M re-audit addendum (2026-08-11)

Re-verified §1's live switches directly, not assumed: `STOREFRONT_CHECKOUT_ENABLED` remains unset in this environment (confirmed via direct `.env.local` inspection this session); Stripe keys remain test-mode (`sk_test_…`/`pk_test_…`, confirmed present). No switch has changed state since this report's original date.

Real payment-adjacent work shipped since this report was written (all Stripe TEST-mode, all verified against real Postgres/a real running dev server, none touching a live switch):
- **Server-side promotion code redemption at checkout** (Decision #62) — authoritative validation/eligibility/stacking, two-phase soft-hold, proportional Stripe line-item discount scaling.
- **Reservation-hoarding guard** (Decision #69) — caps concurrent unpaid checkouts per email at 3, closing a real fraud-adjacent gap in the checkout path.
- **Checkout-created Invoice linkage/items fix** (Decision #66) — `Invoice.customerId` and `InvoiceItem` rows are now correctly populated at checkout time, which is also what makes the storefront backorder-compensation flow's `InvoiceItem` requirement satisfiable for a real online sale (previously it wasn't, for any storefront order — see `docs/ProductRoadmap.md`'s 4B status section).

§12/§15 item 5's Customer Portal Order visibility gap is **resolved** — re-verified during Phase 4B journey tracing that `/account/orders` already correctly queries real storefront `Order` data (not admin-invoice records as this report previously implied needed a design decision); see `docs/PendingOwnerActions.md`'s Resolved Items table.

No new owner action identified beyond §15's existing list. Bottom line from §1 stands unchanged: no live switch has been flipped, no real money has moved.
