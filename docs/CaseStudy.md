# Pepscore Lab — Case Study

**A back-office operations platform built through AI-directed engineering, not manual solo development.**

This case study is written for a professional portfolio and is grounded entirely in this repository's own record: `docs/Decisions.md` (47 logged engineering decisions), `docs/ChangeLog.md`, `docs/ComponentMap.md`, `docs/ProductRoadmap.md`, `docs/PaymentReadiness.md`, `docs/Architecture.md`, `docs/InvoiceSystemSpec.md`, the Prisma schema, and `git log` (143 merged PRs, chronological). Where the evidence is incomplete, ambiguous, or a claim can't be sourced, that is stated explicitly rather than filled in. No fabricated metrics, customer data, or accomplishments appear below. This document is maintained continuously — see "Continuous Update Rule" near the end.

---

## 1. Executive Summary

Pepscore Lab is a peptide-research-supplier e-commerce and back-office platform: a public storefront for research-use-only compounds, and — the larger and more mature half of the system — an internal operations engine that turns every sale (Stripe checkout *or* a manual/off-platform transaction — DM, cash, Cash App) into one trackable, invoiced, fulfillable record.

**The business problem it solves**: the owner was losing track of manual sales conducted outside the storefront (`docs/ProjectOverview.md`) — no consistent invoicing, no unified payment history, no real fulfillment record for a DM/cash sale the way a Stripe order automatically gets one.

**Product vision**: one coherent back office that scales "from one person taking manual orders over DM to a fully automated, multi-channel operation — without ever needing to throw away and rebuild what came before" (`docs/ProjectOverview.md`). The architecture decisions throughout this project are explicitly evaluated against that bar — extend a proven seam, don't build a parallel one.

**Target users**: the owner/operator (admin dashboard, invoicing, CRM, fulfillment) and, as of Phase 2A/2B, the customer directly (intake forms, a Customer Portal, and a public storefront).

**Scope actually built**: a full invoice system (dual PDF output, payment arrangements, archiving, trash/recovery), carrier-agnostic shipment tracking with real Shippo integration, a centralized Fulfillment Gate, a CRM layer (Customer, activity logs, lead capture), a Customer Identity Platform (portal accounts, claim flow, rollout automation), a payment-provider abstraction (Stripe today, ACH, saved payment methods), inventory/pricing (case/SPA/individual-vial sell units, backorders), and a redesigned storefront (product detail pages, search, SEO, dark-brand theme).

**Current state**: the operational core (invoicing, fulfillment, tracking) is Production Validated. Real payment processing (Stripe test-mode, ACH, saved cards) and real bulk customer communications (Twilio SMS) are Engineering Complete but their production activation switches are deliberately OFF (`docs/PaymentReadiness.md`). Storefront checkout is gated behind `STOREFRONT_CHECKOUT_ENABLED`, unset in production as of the most recent readiness report (2026-08-08).

---

## 2. My Role

All engineering on this project was AI-assisted/orchestrated via Claude Code, directed session-by-session by the owner. This case study describes that division of labor honestly rather than presenting it as traditional solo manual coding:

- **Product strategy and vision**: defined what Pepscore Lab is becoming and in what order (`docs/ProductRoadmap.md`'s phase structure), including the decision to keep the marketing site (`pepscore-landing`) and the operational app (`pepscore`) as two permanent, separate Vercel projects rather than a single cutover domain (`ProductRoadmap.md`, "Landing Page & Domain Migration Strategy," updated 2026-07-22).
- **Requirements authorship**: wrote the original master development prompt that founded the invoice system (`docs/InvoiceSystemSpec.md`, Parts 1 & 2 — system role, design language, data model requirements, sample invoice data), and issued the specs behind later phases (Customer Identity Platform, Portal Adoption Automation, the payment-provider migration, Phase 3).
- **Architecture direction**: made or approved the load-bearing calls — e.g., directing that the acquisition-offer system reuse Pepscore's existing promotion architecture pattern rather than a disconnected coupon system, while explicitly leaving the exact model shape ("create a separate campaign abstraction if that remains the cleanest architecture after implementation-level review") to be resolved once an audit determined whether the existing invoice-discount `Promotion` model was structurally the same concept — it wasn't, so a new `PromotionCampaign`/`PromotionCode` pair was built instead, per that same standing direction (`docs/Decisions.md` #41); and that self-checkout should keep the existing `Order`+`Invoice` pairing rather than introduce a third sale-record shape (`ProductRoadmap.md`, "Two open architectural decisions").
- **Business-rule and pricing decisions**: e.g., the payment-arrangement availability rule (Decision #16), the portal-eligibility "needs a real invoice" rule and its explicit override via `leadStatus: CONVERTED` (Decisions #35, #36) — both are documented as directly challenged and corrected by the owner mid-session.
- **UX direction**: flagged the invoice module's initial branding mismatch against the real landing site and directed the dark-theme rebuild (Decision #10); set the "less is more," printer-friendly PDF branding standard (Decision #12).
- **QA and production-validation authority**: defined the "Code Complete vs. Production Validated vs. Complete" distinction now used across the roadmap (`ProductRoadmap.md`, "How completion is defined"; also `git log` #39, "Define Code Complete / Production Validated / Complete for the roadmap").
- **Security/compliance boundaries**: set and enforced the standing rule that real money movement, real bulk customer communication, and real payment/postage activation require explicit owner approval — reiterated verbatim in the Phase 3 sequencing constraints (`ProductRoadmap.md`, "Sequencing and safety constraints") and in every kill-switch decision in this log.
- **Implementation**: performed by Claude Code under this direction — writing code, running tests, fixing bugs found during that work, and proposing (not unilaterally deciding) architectural tradeoffs that the owner then approved, challenged, or overrode.

---

## 3. Problem / Opportunity

Before this build-out, Pepscore had a working Stripe storefront and an admin dashboard for order management, Shippo labels, and expense tracking (`docs/ProjectOverview.md`) — but no system for the manual/off-platform sales that were, in practice, a real share of the business. Every such sale required ad hoc tracking outside the app. There was no invoicing tool, no unified payment-status view spanning both sale types, and no CRM memory of a customer across their DM/cash history versus their Stripe account. The opportunity was to build one operational core that both sale paths feed into, so the owner gets one accurate picture of revenue, balances, and fulfillment regardless of how a sale happened — and to build it so each subsequent module (CRM, portal, inventory, storefront redesign) extends that core instead of duplicating it.

---

## 4. Product Requirements — How They Evolved

The requirements did not stay static; several were directly challenged and corrected mid-build, on the record:

- **Invoice data model** (frozen spec, `docs/InvoiceSystemSpec.md`) called for "saved locally for now" with future DB flexibility — the owner's engineering judgment (Decision #2) skipped the localStorage detour entirely since Postgres/Prisma was already provisioned, on the reasoning that building a throwaway layer to replace later would itself be the "quick hack" the spec explicitly forbade.
- **Invoice branding** initially inherited the pre-existing `/admin` dashboard's light theme by default. The owner flagged that this didn't match the real, live `pepscore-landing.vercel.app` site (all-black, not just the hero) — the invoice UI was rebuilt end-to-end to the measured, real brand tokens (Decision #10).
- **Payment arrangements** were originally spec'd to appear only on invoices already at `Partial` status (a literal reading of "should not appear for Pending or Paid invoices"). Live use surfaced a real gap — the owner wanted to set up a plan proactively on a brand-new Draft invoice "just in case it needs to be utilized" — and the rule was generalized to any invoice with a balance due (Decision #16).
- **Portal-invite eligibility**: the first rule excluded any customer with zero invoices as a "bare lead" (Decision #35, based on an actual production audit finding 6 of 17 real Customer rows were lead-stage). The owner directly challenged this — an admin-arranged sale in progress with no invoice yet is still a real customer — leading to the `leadStatus: CONVERTED` override (Decision #36), described in the log as "exactly the call the owner made."
- **Portal rollout automation** moved from a one-time frozen eligibility snapshot to live, ongoing eligibility on explicit owner instruction that "activated" should mean an ongoing state, not a single approved batch (Decision #37).
- **Phase 3 scope** (Promotion Campaigns, pricing intelligence, reorder) was pinned mid-session specifically because it "supersedes a hardcoded FIRST10 assumption" the owner wanted generalized before it shipped further (`ProductRoadmap.md`, Phase 3A).

---

## 5. System Architecture

**Stack**: Next.js 16 (App Router), TypeScript, Prisma ORM over Neon Postgres, Clerk (auth), Stripe (payments), Shippo (shipping/tracking), Resend (transactional email), Twilio (SMS), Tailwind CSS, `@react-pdf/renderer` (PDF generation), Zustand (storefront cart state only), Zod (validation), Vitest (testing).

**Frontend**: Next.js App Router with server components fetching data and client components (`InvoiceBuilder`, section components) owning interactive form state. No global state library for the invoice module — deliberately, since the whole editing session lives on one page (`docs/Architecture.md`).

**Backend / layering discipline**: a strict three-layer rule enforced throughout — UI components never call Prisma directly, API routes contain no business logic (auth check → parse/validate → call a `lib/` function → return), and each domain has exactly one data-access module (`lib/invoices.ts` is "the ONLY module that queries Prisma for invoice data," per `docs/Architecture.md`).

**Database**: Neon Postgres via Prisma, 51 models spanning storefront (`Product`, `Order`, `OrderReservation`), invoicing (`Invoice`, `InvoiceItem`, `InvoiceDiscount`, `InvoicePayment`, `PaymentArrangement`), CRM (`Customer`, `CustomerActivityLog`, `IntakeLink`, `LeadCapture`), payments (`Payment`, `AchAuthorization`, `SavedPaymentMethod`, `PaymentSettings`), fulfillment/tracking (`Shipment`, `TrackingEvent`, `ShipmentNotification`, `InvoiceActivityLog`), and portal identity (`CustomerPortalInvite`, `CustomerIdentityReviewCase`, `PortalRolloutSettings`). Schema changes are pushed via `prisma db push` — the log itself flags that a real migration history hasn't been adopted yet (Decision #40 section, `ProductRoadmap.md` Phase 2G).

**Auth**: Clerk. Admin auth is a single hardcoded `ADMIN_CLERK_USER_ID` check (documented as fine for one operator, explicitly flagged as needing real roles once there's more than one — `ProductRoadmap.md` Phase 2G). Customer Portal auth is a separate, newer authorization boundary (Customer Identity Platform, PRs #70–#89) scoping every query to the session's linked `Customer.id`.

**Payments**: Stripe behind a `PaymentProviderAdapter` interface (Decision #28) mirroring the existing `ShippingProvider` pattern — one interface, one real adapter today, additional providers (ACH via another processor, PayPal) are new files, not new branches through checkout code. Card, ACH (Decision #30), Cash App Pay, and PayPal are wired; Apple/Google Pay ride on Card automatically; Venmo has no Stripe Checkout path and is a permanently readiness-only flag (Decision #32).

**Inventory & pricing**: case/SPA/bulk/individual-vial sell-unit pricing (the "Pricing MVP," PR #91), a physical stock ledger with reservations (`InventoryReservation` for invoices, a separate `OrderReservation` for storefront Orders — Decision #29), and catalog-level backorder support with admin-discretionary accommodation (PR #107–#109).

**Customer identity**: two still-separate identities — `User` (Clerk-linked storefront account) and `Customer` (invoice/CRM identity, no login) — flagged as an open architectural decision Phase 2B must resolve (`ProductRoadmap.md`).

**Customer Portal**: shell, navigation, dashboard, invoice/payment/fulfillment/correspondence views, profile, support, saved payment methods, and real storefront Order history (PRs #70–#125). Built on the same `lib/` service layer the admin app uses — "no parallel customer version of `lib/invoices.ts` or `lib/customers.ts` should ever be written" (`ProductRoadmap.md`, Customer Portal Readiness Assessment).

**Admin**: dashboard, invoice management, CRM/leads interface (PR #110), fulfillment/package-preset settings, payment settings, portal rollout controls, notification-recipient configuration.

**CRM / leads**: `Customer`, `CustomerActivityLog`, `CustomerStatus` (computed), lead capture (`LeadCapture`, `FirstOrderOfferConfig`/`Claim`), duplicate-customer detection (`findPossibleDuplicateCustomers()`).

**Messaging**: Resend for transactional email (invoice-issued, payment-received, shipment notifications, correspondence log), Twilio for SMS (opt-in/opt-out webhook, transactional sends) — no bulk-send path exists in the codebase at all (Decision #27, explicitly noted as a safety property, not a gap).

**Fulfillment / shipping**: `Shipment` as a true one-to-many under `Invoice` (Decision #24), a centralized Fulfillment Gate (`lib/fulfillment/gate.ts`), real Shippo rate-shopping and label purchase (`lib/fulfillment/labels.ts`) gated behind a separate kill-switch from the API key itself (Decision #26).

**External integrations**: Clerk, Stripe, Shippo, Resend, Twilio, Zippopotam.us (free/keyless ZIP lookup, Decision #19).

**Deployment**: Vercel, two separate projects — `pepscore-landing` (marketing, owns `pepscorelab.com`) and `pepscore` (the operational app, no attached domain yet, reachable only at its Vercel-assigned URL) — deliberately kept as two permanent interfaces to one shared backend, not a temporary state pending cutover (`ProductRoadmap.md`).

---

## 6. Key Technical Decisions

Pulled from `docs/Decisions.md`'s 47 logged entries — the subset with the most architectural weight.

### Extend `Invoice` rather than build a parallel `ManualInvoice` model (Decision #1)
**Problem**: the existing `Invoice` model was hard-wired 1:1 to a Stripe `Order`, but manual/off-platform sales needed invoicing too.
**Options**: extend `Invoice` (optional `orderId`) vs. a fully separate `ManualInvoice` model.
**Decision**: extend `Invoice`.
**Why**: one invoice concept, one dashboard, one PDF pipeline regardless of sale origin — avoids "which one do I query" ambiguity at every future call site.
**Tradeoff**: `Invoice` now carries fields irrelevant to either path individually; judged acceptable since both share far more lifecycle than they differ.
**Result**: this single decision is the foundation every later invoice/payment/fulfillment feature built on without a rewrite.

### Payment arrangements as real relational models, not JSON (Decision #15)
**Problem**: the feature needed to support future overdue detection, reminders, a customer portal, and finance reporting — all requiring per-installment queries.
**Options**: `Json` column on `Invoice`, vs. real `PaymentArrangement`/`PaymentArrangementInstallment` tables.
**Decision**: real relational tables.
**Why**: `WHERE dueDate < now() AND status = 'PENDING'` already answers "what's overdue" with no future migration needed.
**Result**: this seam is exactly what later features (the Customer Portal, fulfillment eligibility) built on without touching the schema again.

### Automated Paid → Archived transition via daily Vercel Cron, `paidAt` as a live countdown anchor (Decision #21)
**Problem**: needed QuickBooks/Stripe-style automatic archival with every listed reset trigger (edit, reversal, reopen, additional payment) restarting the countdown correctly.
**Decision**: recompute `paidAt` on every relevant write rather than store a separate mutable "archive date."
**Why**: exactly one source of truth for when the countdown started; can't drift from the invoice's actual payment history.
**Tradeoff**: "Overdue" has no true due-date field on `Invoice` — implemented as a documented pragmatic stand-in.
**Result**: later regression-tested as its own permanent suite (PR #124) after PRs #120–123 extended the same filter/archive system.

### Carrier-agnostic tracking on a `ShippingProvider` abstraction over Shippo (Decision #22)
**Problem**: spec required not hard-coding carrier logic into invoice components, and preferred a multi-carrier API.
**Options**: 4 separate direct-carrier APIs (USPS/UPS/FedEx/DHL) vs. one abstraction over the already-integrated multi-carrier aggregator (Shippo).
**Decision**: `ShippingProvider` interface, Shippo as the only implementation today.
**Why**: zero new vendor relationships, adding a carrier or swapping providers later touches only a registry file and one adapter — never the UI, webhook, or cron routes.
**Result**: directly reused as the template for the payment-provider abstraction two months later (Decision #28).

### `Shipment` becomes a true one-to-many, primary shipment always derived, never stored (Decision #24)
**Problem**: real physical packages for one invoice aren't always exactly one shipment (mistyped tracking, split packages, replaced labels); shipping labels spend real money, so "can this ship" needed exactly one enforced check.
**Options**: keep 1:1 plus a separate history log table, vs. store a `primaryShipmentId` pointer, vs. drop the unique constraint and derive "current" on read.
**Decision**: one-to-many, `getPrimaryShipment()` derives current state (most recent non-voided) rather than storing a pointer.
**Why**: a stored pointer can silently drift (e.g., a voided shipment without reassignment); a pure derivation function is always correct by construction and unit-testable with no database.
**Result**: the centralized Fulfillment Gate (`checkFulfillmentEligibility()`) built directly on top, enforced identically in the UI and inside the label-purchase service itself.

### Live-eligibility rollout cron, replacing a frozen activation snapshot (Decision #37)
**Problem**: the original portal-rollout automation intersected eligible customers against a snapshot list captured once at admin activation — correct for a one-time bulk-invite decision, wrong for "the owner should not have to remember to re-approve as new customers qualify."
**Decision**: compute eligibility fresh on every cron run; the old snapshot is now historical-record-only.
**Why**: direct owner instruction that "activated" should represent an ongoing approved state, not a one-time batch.
**Tradeoff**: an admin who wants a genuine one-time-only batch send no longer has that as a built-in mode; Pause is the closest equivalent.
**Result**: every other safety gate (kill switch, dry-run default, allowlist, per-run cap) stayed independently sufficient — this change only touched which eligible customers a live run considers, not whether or how many it's allowed to contact.

### Portal eligibility excludes bare leads, then is overridden by an explicit `leadStatus: CONVERTED` (Decisions #35, #36)
**Problem**: should a customer with zero invoices ever receive portal credentials automatically?
**Decision**: exclude zero-invoice customers by default (#35) — audit found 6 of 17 real production Customer rows were lead-stage, 4 sitting inside the "14 eligible" bulk-invite audience — then add an explicit admin-vouched override via the pre-existing `leadStatus: CONVERTED` field rather than inventing a new column (#36).
**Why**: reused an existing, already-documented "never auto-computed, admin-only" signal instead of adding a second field that could silently disagree with it.
**Result**: verified to change zero real outcomes at the time (eligible count stayed 10) while correcting the rule for the case the original version could get wrong.

### Promotion Campaign system built as a new model pair, not an extension of the existing invoice-discount `Promotion` (Decisions #41, #42)
**Problem**: the owner's original instruction was to "reuse the existing promotion architecture" for a generalized, admin-configurable acquisition-offer system (so the hardcoded FIRST10 10% could become an editable, replaceable campaign) — but an audit found the existing `Promotion` model was a structurally different concept: a flat, admin-picked discount applied ad hoc to one invoice line, with no dates, eligibility rules, scheduling, or per-customer code issuance.
**Decision**: a new `PromotionCampaign`/`PromotionCode` model pair, explicitly authorized by the owner once the audit distinction was clear ("create a separate campaign abstraction if that remains the cleanest architecture after implementation-level review"). `FirstOrderOfferClaim` gained a nullable `campaignId` and `promotionCodeId` rather than the claim flow being rewritten from scratch. A second slice then migrated the actual claim logic onto the new system: live campaign resolution, real unique code issuance inside the same transaction as the claim, and a real branded discount email.
**A real production bug caught mid-build**: adding an hourly cron for scheduled campaign activation failed the deployment outright — this Vercel project is on the Hobby plan, which rejects any cron scheduled more frequently than daily (the same class of bug this project had already fixed once before for a different cron). Caught by a failed preview deployment, not assumed; fixed by changing to a daily schedule.
**A second real bug caught mid-build**: once the claim flow's rewrite added a notification-sending import, `next build` failed — the Twilio SDK (Node-only, needs `net`/`tls`) ended up in a client-side bundle, because a pre-existing client component statically imported the server-only storefront footer. Fixed by splitting the module so the read-only "is the offer live" surface stays free of any notification dependency.
**Result**: verified against real Postgres (a disposable rehearsal test exercising the full activate/demote/expire-codes transaction and the claim/code-issuance transaction) and a real Resend send that had to be debugged once — a Gmail test address was rejected because the Resend account is still sandbox-restricted to its own verified address, a pre-existing infrastructure fact surfaced by this work, not a defect in it. Live-verified end-to-end in production afterward: a real campaign created, activated, its live storefront banner confirmed rendering the campaign's own copy (not a hardcoded percentage), then fully retired/archived/deleted and the master switch restored off.

### Payment-provider abstraction, Phase 1 (Decision #28)
**Problem**: the existing Stripe integration was real and working but entirely Stripe-shaped — a genuine bug was found in the audit: the webhook silently dropped `charge.refunded`, `charge.dispute.created`, and `payment_intent.canceled`, leaving `Payment.status` stuck at `SUCCEEDED` forever after a real refund.
**Decision**: `PaymentProviderAdapter` interface mirroring the proven `ShippingProvider` pattern; existing Stripe columns untouched, new fields purely additive.
**Result**: verified against a genuinely computed Stripe webhook test signature — not a mock — confirming a full refund correctly moves `Order.status` to `REFUNDED` while a partial refund/dispute deliberately does not (a real business decision left unmade on purpose, not defaulted silently).

### ACH / Pay by Bank — genuinely async lifecycle, one shared "mark paid" tail (Decision #30)
**Problem**: ACH doesn't settle synchronously like a card; treating `checkout.session.completed` as sufficient signal (as cards do) would mark an order paid, ship-eligible, and email a confirmation for a debit that hasn't cleared and might still bounce.
**Decision**: branch on `session.payment_status`; only `async_payment_succeeded`/`async_payment_failed` (which can fire days later) settle the order for real. `markOrderPaid()` extracted as the single function both the card and ACH-success paths call.
**Security boundary honored**: this database never receives, transmits, or stores a raw bank account/routing number — only Stripe's own safe references.
**Result**: verified with genuinely-signed Stripe webhook events covering the full lifecycle, including idempotency on redelivery.

### Shared email shell replaces 18 independently-styled templates, and admin-facing alerts join the same visual system rather than getting a second shell (Decisions #43–#47)
**Problem**: the storefront/admin/Customer Portal had already moved to a dark-gold brand system (Decision #10), but every customer-facing and admin-facing email template still rendered on the old cream/serif shell — a genuine brand-cohesion gap flagged directly, not assumed. An audit before building (per this project's established discipline) found 18 templates on the old system: 15 customer-facing, 3 admin-only.
**Decision**: one new module, `emails/shared/shell.ts`, owns the branded header (wordmark + gold divider), CTA buttons, elevated panel, and footer for every email; each template file keeps its own content/business logic and only calls into the shared presentation layer. Every color token was measured directly from the live production storefront via `getComputedStyle()` JS inspection, not invented (`#D4AF37`→`#E8C84A` gradient, `#000000`/`#0D0D0D` dark surfaces) — the same "measure the real site" discipline as Decision #10. Migrated across 5 reviewable slices (PRs #140–#144) rather than one large PR. Admin-only alerts, which previously used a visually distinct "PEPSCORE ADMIN" shell, were folded into the same shared shell (distinguished only by an "Admin Alert" eyebrow and footer note) rather than maintained as a second shell variant.
**Why**: a shared shell is what prevents the *next* new template from drifting again, which restyling each file independently wouldn't; one shared admin/customer shell is easier to keep in sync than two.
**Result**: all 18 templates (32 distinct rendering functions across them) now draw their header/CTA/panel/footer treatment from one source of truth. Every migrated rendering function was exercised for real via Resend (not mocked) to a sandbox-verified address for direct visual verification before merge. Full test suite stayed green throughout (626/626 by the close of the migration), and `next build` stayed clean at every slice, confirming the shared-shell import graph never leaked a server-only dependency into a client bundle (the exact failure class already fixed once in Decision #42).

### Storefront `Order` inventory reservation as a separate model from the invoice-scoped one (Decision #29)
**Problem**: audit for the ACH work found storefront checkout never reserved or deducted stock at all — two concurrent checkouts for the last unit could both succeed.
**Decision**: new `OrderReservation` model mirroring `InventoryReservation`'s proven discipline, rather than widening the mature, production-active invoice-scoped model to also serve a then-inactive storefront feature.
**Result**: verified against a real Stripe test-mode session reserving/rejecting/fulfilling/releasing stock correctly, confirmed via actual `physicalStockOnHand` changes, not inferred.

### PDF layout fix — `wrap={false}` moved from the whole legal footer to each clause (Decision #18)
**Problem**: a live invoice with a payment history and a 4-installment arrangement was overflowing to a nearly-empty second page.
**Root cause found**: the *entire* legal footer had `wrap={false}`, so react-pdf pushed the whole footer to page 2 the moment it was even a few points short of fitting on page 1 — a strictly worse failure mode than genuine content overflow.
**Decision**: move `wrap={false}` to each individual clause instead of the container.
**Result**: verified empirically by rendering real invoices and counting actual PDF page objects — every typical scenario now renders on exactly one page; only genuinely content-heavy edge cases use two.

### Manual tracking made Shippo-independent; backorder gating extended everywhere shipping status can move (Decision #25)
**Problem**: a hard `throw` inside what was meant to be an optional provider adapter broke the one fulfillment path (Pirate Ship + manual entry) actually used day-to-day in production — a real production bug.
**Decision**: manual tracking registration becomes best-effort; backorder gating extended from just Shippo label purchase to every path that can move an invoice's shipping status (manual tracking creation, webhook/poll cascade, admin overrides).
**Result**: manual tracking became "genuinely first-class rather than works-if-Shippo-happens-to-also-be-configured."

---

## 7. Major Features

| Feature | Description | Status |
|---|---|---|
| Invoice system core | Unlimited line items, stacking discounts/promotions, dual PDF output (Master/Client), sequential numbering, live preview | **Production Validated** |
| Payment arrangements | Weekly/biweekly installment schedules, available on any invoice with a balance, computed payment status | Production Validated |
| Invoice archiving | Auto-archive Paid invoices after a configurable delay via daily cron; regression-tested suite (PR #124) | Production Validated |
| Invoice trash | Soft-delete with recoverable two-step permanent delete | Production Validated |
| Manual invoicing | Customer/shipping capture, ZIP autofill, "same as billing" sync | Production Validated |
| Product catalog & pricing engine | Case/SPA/bulk/individual-vial sell units, manual-override-beats-formula precedence | Production Validated |
| Inventory & backorders | Physical stock ledger, invoice-scoped reservations, catalog-level backorder + admin accommodation | Production Validated |
| Sell units / SPA eligibility | Explicit wholesale/SPA pricing eligibility on the storefront | Production Validated |
| Customer identity (CRM) | `Customer`, `CustomerActivityLog`, computed `CustomerStatus`, duplicate detection | Production Validated |
| Customer intake workflow | Secure expiring links, public intake form, duplicate-detection/upsert pipeline | **Complete** (Phase 2A — Code Complete + Production Validated, incl. one continuous real-customer acceptance run per `ProductRoadmap.md`) |
| Customer Portal | Dashboard, invoices, payments, fulfillment tracking, correspondence, profile, storefront order history | Production Validated |
| Portal invitation & adoption automation | Secure claim flow, eligibility rules, live-eligibility rollout cron, delivery-failure surfacing | Production Validated |
| Carrier-agnostic shipment tracking | `ShippingProvider` abstraction, webhook + polling fallback, 16-value normalized status | Production Validated (registration path verified via sandbox + direct service calls, per Decision #22's documented limitation) |
| Fulfillment Gate | Centralized "can this invoice ship" check (paid, arrangement, or attributed override) | Production Validated |
| Shippo label purchase | Real rate-shopping and label purchase, printerless USPS QR codes | **Engineering Complete — Activation Pending** (`SHIPPO_PURCHASING_ENABLED` unset; account awaits Shippo Trust & Safety business-registration review, per Decision #26) |
| Search | Invoice search by customer/number/tracking/phone/SKU/amount; storefront product search | Production Validated |
| Promotion Campaign system | Admin-configurable acquisition-offer campaigns (percentage/fixed, draft→scheduled→active→retired→archived lifecycle, one default first-order campaign at a time, a stacking-compatibility engine with a Family & Friends privileged class) — generalizes what was originally a hardcoded FIRST10 offer | **Engineering Complete — Activation Pending** (master switch off in production; live-verified end-to-end via a real test campaign, then cleaned up) |
| FIRST10 lead capture | Full claim journey on the campaign system: lead form → dedup → unique single-redemption code issuance → branded discount email → correspondence logging | **Engineering Complete — Activation Pending** (`FirstOrderOfferConfig.enabled` off by default; real Resend delivery and code issuance verified via a disposable rehearsal test, not simulated) |
| Promotions (legacy invoice-discount catalog) | Reusable, stackable discount picker for manual invoice lines — a structurally separate concept from the Promotion Campaign system above, kept intentionally distinct rather than merged (`docs/Decisions.md` #41) | Production Validated |
| Payments — card | Embedded Stripe Checkout | **Engineering Complete — Activation Pending** (test-mode keys only; `STOREFRONT_CHECKOUT_ENABLED` off in production) |
| Payments — ACH / Pay by Bank | Async lifecycle, mandate evidence, never stores raw bank data | **Engineering Complete — Activation Pending** |
| Saved payment methods | Card + bank via Stripe Customer/SetupIntent, Customer Portal UI | **Engineering Complete — Activation Pending** |
| Bulk/transactional SMS (Twilio) | Sending real, STOP/START opt-out real and DB-backed; A2P 10DLC registration is the owner's remaining checklist | **Engineering Complete — Activation Pending** (`TWILIO_*` unset in production) |
| Admin controls | Payment settings, fulfillment settings, package presets, notification recipients, portal rollout controls | Production Validated |
| Analytics | Invoice dashboard KPIs, payment processing-cost analytics (`getPaymentCostAnalytics()`) | Production Validated (data-layer real; processing-cost analytics correctly shows empty state since checkout has been off) |
| Shared email design system | Centralized branded email shell (`emails/shared/shell.ts`) — header, CTA, panel, footer tokens measured from the live storefront; all 18 customer- and admin-facing email templates (32 rendering functions) migrated onto it across 5 slices | **Production Validated** (presentation-only migration; content/business logic of every template unchanged, verified via real Resend sends to a sandbox-verified address before each merge) |

---

## 8. UX Evolution

Sourced from `docs/Decisions.md` and `docs/UIUXGuidelines.md` — no design history is claimed beyond what these documents actually record.

- **Initial invoice UI**: launched on the pre-existing `/admin` dashboard's light `cream`/`g100` convention, inherited by default rather than checked against the real brand (Decision #10).
- **Dark rebrand**: the owner flagged the mismatch against the live `pepscore-landing.vercel.app` site, which live JS inspection confirmed was pure black end-to-end (`rgb(0,0,0)`, not just the hero) with flat-depth, hairline-bordered glass cards (`bg-white/[0.03]`, `border-gold/10`, `rounded-[18px]`, no shadow) — not the filled-gray-box treatment the invoice UI had inherited. The invoice dashboard and builder were rebuilt to these measured tokens, centralized in one file (`components/invoices/theme.ts`) so a future token change is a one-file edit. The rest of `/admin` (non-invoice pages) was explicitly left on the old light theme, creating a visible seam at that boundary — called out directly in the decision log as a known, accepted gap.
- **PDF branding**: restrained, deliberate use of the gold accent (a small header bar, the status badge, section-label underlines) rather than color-coding every status, on the explicit standard that PDFs "reinforce the brand but remain professional and printer-friendly" and must never look like marketing material (Decision #12).
- **PDF layout iteration**: went from an initially generous, branding-focused layout to a tightened one after real invoices were found overflowing to a nearly-empty second page — root-caused and fixed (Decision #18), verified by rendering real invoices and counting actual PDF page objects rather than guessing.
- **Interaction conventions**: no native browser `confirm()` dialogs anywhere in the dashboard — destructive actions (Delete, Delete Forever) use an in-page two-click arm/confirm pattern consistent with the app's toast-driven interaction language (Decision #20).
- **Accessibility**: at least one direct fix is on record — screen-reader labels corrected in the "Correct Sell Unit" admin dialog (`git log`, PR #95, "Scenario 18 follow-up: fix screen-reader labels").
- **Mobile responsiveness**: at least one direct fix is on record — "Fix mobile-responsiveness gaps in admin page headers and two grids" (`git log`, PR #55). Beyond these specific commits, this document does not have evidence of a systematic, page-by-page mobile/accessibility audit — that would need to be confirmed separately before being claimed at that scope.
- **Storefront redesign**: dedicated product detail pages, category pages, search, SEO architecture (sitemap/robots/structured data), and a "dark Pepscore Lab theme migration" for the storefront itself (`git log`, PRs #99, #100, #101, #103, #104) — bringing the storefront in line with the same brand tokens the invoice module adopted earlier.

---

## 9. Significant Bugs / Challenges

Pulled from `docs/Decisions.md`'s and `docs/ChangeLog.md`'s documented self-caught issues — real, not illustrative.

**Stripe webhook silently dropping refund/dispute/cancellation events.** *What happened*: an audit ahead of the ACH work found `charge.refunded`, `charge.dispute.created`, and `payment_intent.canceled` were never handled — a real refund from the Stripe Dashboard left `Payment.status` permanently stuck at `SUCCEEDED`. *Why it mattered*: financial state could silently disagree with reality indefinitely. *Root cause*: the webhook handler was built only for the original `checkout.session.completed` happy path. *Fix*: the new `PaymentProviderAdapter`/reconciler now handles all three. *Verification*: a genuinely computed Stripe webhook signature (not a mock) drove a seeded payment through a full refund (confirmed `Order.status` → `REFUNDED`), a partial refund, and a dispute (Decision #28). *Lesson*: an integration that only handles the success path is a latent data-integrity bug, not a finished feature.

**Storefront checkout never reserved inventory, for any payment method.** *What happened*: discovered during the ACH prerequisite audit — two concurrent checkouts for the last unit of a product could both succeed. *Why it mattered*: a real overselling risk the moment checkout goes live. *Fix*: a new `OrderReservation` model, transactionally reserved at Order creation, released on Stripe failure (Decision #29). *Verification*: a real Stripe test-mode session confirmed rejection of a checkout that would exceed remaining stock, and confirmed actual `physicalStockOnHand` deduction on fulfillment.

**Product picker silently resolved to the wrong strength.** *What happened*: the invoice line-item picker matched on bare product name (`product.name`), but the catalog reuses names across strengths (Tesamorelin 5mg/10mg). Selection could silently resolve to whichever row happened to come first, and even a correct selection dropped the mg strength from the saved line item. *Why it mattered*: real invoices could show the wrong price/strength with no visible indication. *Fix*: a composed `Name — Size — 1 Box` label (`formatProductLabel()`), verified to have zero collisions across all 119 live catalog products (Decision #13).

**Legal footer's `wrap={false}` pushed the entire footer to a near-empty second page.** *What happened*: found while verifying that a real invoice (payment history + 4-installment arrangement) fit on one page — it didn't. *Root cause*: `wrap={false}` on the whole footer container, not per-clause, so react-pdf moved the entire block rather than filling remaining space on page 1. *Fix*: moved `wrap={false}` to each individual legal clause (Decision #18). *Verification*: rendered real and representative invoices, counted actual PDF page objects.

**Manual tracking (Pirate Ship) broke in production because of an unrelated dependency.** *What happened*: a hard `throw` inside what was meant to be an optional Shippo adapter call broke the one shipping workflow actually used day-to-day, whenever Shippo couldn't register a tracking number. *Why it mattered*: this wasn't a theoretical edge case — it was the live production path. *Fix*: made provider registration best-effort with a non-fatal warning surfaced in the response (Decision #25).

**Vercel Hobby-tier cron rejection silently blocked every production deploy.** *What happened*: `poll-tracking`'s cron was scheduled every 4 hours; Vercel's Hobby tier rejects the *entire deployment* if any cron runs faster than daily — this had been silently blocking every production deploy since the carrier-tracking PR merged. *Fix*: changed to once-daily, matching the archive sweep (`docs/ChangeLog.md`, "Sanitized Shippo API errors + Vercel Hobby cron fix"). *Lesson*: a platform-tier constraint that silently blocks deploys is a production incident waiting to be found, not a cosmetic config detail.

**PDF header logo failed to embed / dates rendered a day early.** *What happened*, found during initial invoice-system smoke testing: the logo needed a base64 data URI, not a bare filesystem path, to embed in `@react-pdf/renderer`; and payment/delivery dates rendered a day early due to local-timezone formatting of UTC-midnight dates. *Fix*: base64 embedding; UTC forced in `lib/invoice/format.ts`, shared by both PDFs and the live preview (`docs/ChangeLog.md`, "Initial build").

**Zero-invoice eligibility rule was directly challenged and found to be too strict.** *What happened*: Decision #35's "needs at least one invoice" portal-eligibility rule was correct as a safe default but would have wrongly excluded a real customer an admin was actively arranging a sale for. *Fix*: `leadStatus: CONVERTED` override (Decision #36), reusing an existing admin-only CRM field rather than inventing a new one. *Verification*: all 4 real customers the original rule excluded were individually audited by name and confirmed to genuinely be unconverted leads before the fix shipped — the fix changed zero real outcomes at the time while correcting the rule.

**An ordering bug in failure-summarization logic, caught during its own code review.** *What happened*: `summarizeRepeatedFailures()`'s naive last-write-wins logic over an array of failures silently picked the *oldest* error as "most recent" when the caller's query returned newest-first — because the oldest run sits last in that array. *Fix*: compare `occurredAt` explicitly instead of relying on iteration order (Decision #40). *Lesson*: array-position assumptions about "most recent" are a recurring class of bug worth a specific regression test, which this fix added.

**A new cron silently would have blocked every future production deploy.** *What happened*: a new cron for scheduled Promotion Campaign activation was initially scheduled hourly — the PR's own preview deployment failed outright rather than degrading silently. *Root cause*: this Vercel project is on the Hobby plan, which rejects the entire deployment if any cron runs more frequently than daily — the exact same class of platform-tier constraint that had already caused a real production incident earlier in the project (a 4-hour tracking-poll cron silently blocking every deploy until caught). *Fix*: changed to a daily schedule, matching every other cron in the project. *Lesson*: a lesson from earlier in the project (state the platform constraint explicitly rather than rediscovering it) wasn't fully internalized as a checklist item — worth naming as a gap in process, not just a one-off fix.

**A server-only dependency leaked into a client bundle and broke the production build.** *What happened*: rewiring the FIRST10 claim flow to send a real discount email added an import chain that transitively pulled in the Twilio SDK (Node-only, requires `net`/`tls`). `next build` failed. *Root cause*: a pre-existing client component (`CheckoutForm.tsx`) directly imports the storefront `Footer` — a Server Component — so Next.js's client bundler follows that import regardless of `Footer`'s own server-only body, and any heavy server-only dependency anywhere in `Footer`'s import graph breaks the client build. This was a latent, pre-existing risk that had simply never been triggered before, since the original `Footer`/FIRST10 code had no notification-sending import at all. *Fix*: split the module so the read-only "is the offer live" surface stays free of any notification dependency, isolating the email-sending code (and therefore Twilio) to a separate file the client bundle never touches. *Lesson*: a passing build today doesn't prove an import boundary is actually enforced — it can mean the risky path just hasn't been exercised yet.

---

## 10. Security / Reliability

- **Kill switches, layered and independent of key presence**: `STOREFRONT_CHECKOUT_ENABLED` (checkout unreachable client- and server-side while unset), `SHIPPO_PURCHASING_ENABLED` (blocks label purchase independent of whether an API key is configured — deliberately, to avoid a stale test key silently "working" and being mistaken for live, Decision #26), Twilio configuration checks (every SMS resolves to `SKIPPED_NOT_CONFIGURED` while `TWILIO_*` is unset, and the inbound webhook itself 404s with no token to verify against, Decision #27).
- **Dry-run defaults**: the portal-invite rollout cron defaults to dry-run, with an allowlist and per-run cap as additional independent gates (Decision #37's "Benefits" section).
- **Idempotency**: Stripe webhook handlers guard against redelivery via `stripePaymentIntentId` existence checks, extended to every new handler added this session and verified via rehearsal tests that explicitly redelivered events and confirmed no duplicate rows (Decision #28, #30). Tracking events are deduplicated at the database layer via a `(shipmentId, eventHash)` unique constraint (Decision #22).
- **Provider abstraction as a reliability pattern**: both `ShippingProvider` (Decision #22) and `PaymentProviderAdapter` (Decision #28) exist specifically so a provider swap or addition never touches UI/webhook/cron code — reducing the blast radius of any single integration's failure or migration.
- **Payment tokenization**: no raw card or bank account/routing number, online-banking credential, or Financial Connections token is ever received, transmitted, or stored by this database — Stripe's own hosted/embedded UI collects it, and only safe references (PaymentMethod id, last4, brand) come back (Decision #30, #33).
- **ACH mandate evidence**: a dedicated `AchAuthorization` model records mandate id, authorization version, timestamp, IP/user agent, and revocation state — never overwritten (Decision #30).
- **Access controls**: admin routes gated by a single `isAdmin` check (`userId === ADMIN_CLERK_USER_ID`); a regression guard exists specifically to catch any admin API route missing that check (`git log`, PR #68, "Add regression test guarding every admin API route's isAdmin() check"). Customer Portal routes use a separate, purpose-built authorization boundary scoping every query to the session's linked `Customer.id`, with an explicit rule that admin-only fields (`internalNotes`, discount presets, balance-transfer execution) must never round-trip through a customer-facing response (`ProductRoadmap.md`, Customer Portal Readiness Assessment).
- **Audit logging**: `AdminAuditLog` for admin actions, a dedicated `InvoiceActivityLog` for shipment/tracking events (deliberately separate since its shape needs an optional `userId` to cover webhook/system-sourced entries, Decision #22), `CustomerActivityLog` for CRM events, and a cron-run audit trail (`ROLLOUT_CRON_RUN`, `REMINDER_CRON_RUN`) that surfaces repeated portal-invite delivery failures to the admin UI (Decision #40).
- **Timing-safe comparisons**: the Shippo webhook shared-secret comparison was hardened to timing-safe (`git log`, PR #29) after being flagged in the Phase 2 completion audit.
- **Environment/secrets handling**: `/admin/settings/payments` shows only booleans ("Stripe Configured," "Test Mode," "Checkout Enabled") derived server-side — never a secret value in the browser (Decision #31). `CRON_SECRET`-gated cron endpoints. Preview and Production share one Neon database by deliberate choice (`docs/ChangeLog.md`, "PR #1 preview troubleshooting").
- **Real-money/communication activation gates**: reiterated as a standing rule throughout the entire payment-provider arc — "no real money moved, no real postage was purchased, and no real bulk customer message was sent at any point this session. Every live-activation switch remains in its safe, fail-closed default state" (`docs/PaymentReadiness.md`, verified as of 2026-08-08, PRs #107–#119).

---

## 11. Testing / QA

- **Unit tests**: **626 tests passing across 59 test files**, run via Vitest (`npx vitest run`, executed directly against this repository at the time this revision was written). Vitest itself was added specifically for the carrier-tracking work — "no test framework existed in this project before" (`docs/ChangeLog.md`) — starting from 47 tests and growing with each subsequent feature (pure business logic: schedule generation, eligibility computation, status normalization, dedup, format validation).
- **Type checking**: `npx tsc --noEmit` — clean, verified directly at the time this case study was written.
- **Linting**: `npx eslint .` — reported as clean at every PR per `docs/ChangeLog.md`'s verification notes; a real flat-config compatibility bug (Decision #9) was found and fixed early in the project specifically because Next.js 16 removed the `next lint` subcommand, meaning `eslint .` had never actually been exercised as a path until then — fixing it surfaced 4 genuine findings in code the same PR touched.
- **Build**: `npm run build` (`prisma generate && next build`) — reported clean at every PR per the ChangeLog's verification notes.
- **Rehearsal / disposable scripts against real provider test APIs**: the dominant verification pattern for payment/shipping/SMS work — genuinely-signed Stripe webhook events, real Shippo test-mode purchases, a genuinely computed Twilio request signature — rather than mocks, with explicit call-outs whenever something *couldn't* be verified end-to-end in this environment (e.g., no real browser can complete an embedded Stripe checkout or a Financial Connections bank-linking flow from a script — acknowledged directly in Decisions #30, #32, #33 rather than glossed over).
- **Live/production verification**: multiple documented end-to-end passes on the actual deployed app — the invoice system's full workflow tested on the live Preview deployment before merge (`docs/ChangeLog.md`, "PR #1 preview troubleshooting"); Shippo tracking taken live end-to-end in production for the first time with a real USPS tracking number resolving 16 real historical events (`docs/ChangeLog.md`, "Sanitized Shippo API errors + Vercel Hobby cron fix"); the single continuous real-customer acceptance run closing out Phase 2A (`ProductRoadmap.md`).
- **Permanent regression suites**: added after specific incidents, not just ad hoc scripts — e.g., a permanent regression suite for invoice archiving after PRs #120–123 (`git log`, PR #124), and a regression guard confirming every admin API route enforces `isAdmin()` (PR #68).

---

## 12. Outcomes / Metrics

Only what is actually measurable from this repository's own evidence — no business metrics (revenue, customer counts, conversion rates) are claimed, because they are not yet available:

- **143 merged pull requests** (`git log --oneline`, chronological, PR #1 through #144).
- **47 logged architecture decisions** in `docs/Decisions.md`, each with Decision/Reason/Alternatives/Benefits/Drawbacks.
- **626 passing unit tests** across 59 test files (Vitest), grown from 47 tests at the introduction of the test framework.
- **51 Prisma models** in the current schema, spanning storefront, invoicing, CRM, payments, fulfillment, and portal identity.
- **`npx tsc --noEmit` clean** at the time this document was written.
- Phase 2A (Customer Intake Workflow) is the one phase explicitly marked **Complete** in `docs/ProductRoadmap.md` — both Code Complete and Production Validated, including a single continuous real-customer acceptance run.
- **Adoption and revenue metrics are not yet available.** Real storefront checkout, real bulk SMS, and real ACH/saved-payment-method activation are all still switched off in production as of the most recent readiness report (`docs/PaymentReadiness.md`, dated 2026-08-08) — there is no live transaction volume to report yet, and this document does not claim any.

---

## 13. Lessons Learned

- **Audit before building, every time.** Several of the highest-value fixes in this project's history were found by auditing existing behavior before writing new code, not by executing a feature request literally — the Stripe webhook refund/dispute gap (Decision #28), the missing storefront inventory reservation (Decision #29), the zero-invoice portal-eligibility gap (Decision #35), and the "no event-driven trigger needed" conclusion (Decision #38, which explicitly chose *not* to build something because the audit showed the existing daily cron plus manual button already covered the real need).
- **A working provider abstraction pattern is worth reusing verbatim.** `ShippingProvider` (Decision #22) was built first; `PaymentProviderAdapter` (Decision #28) is explicitly described as mirroring it. Investing in the pattern once paid off a second time.
- **Derive, don't store, whenever a value could drift.** This shows up repeatedly and deliberately: computed `PaymentStatus` (Decision #17), the derived primary `Shipment` (Decision #24), live-recomputed `CustomerStatus`-based portal eligibility (Decision #35/#37) — each explicitly rejected a stored flag/pointer in favor of a pure function precisely because a stored value can silently disagree with reality.
- **A failure mode that fails *silently* is worse than one that fails loudly.** The Vercel Hobby-tier cron rejection blocking every deploy, the Stripe webhook silently dropping refund events, and the manual-tracking `throw` breaking the actual production shipping workflow are all versions of the same lesson: an integration point that degrades silently is far more dangerous than one that visibly errors.
- **Real verification means hitting the real (test-mode) API, not a mock.** The recurring pattern across every payment/shipping/SMS decision — genuinely-signed webhook events, real Stripe test-mode sessions retrieved back from Stripe's own API, a genuinely computed Twilio signature — reflects a deliberate standard that a mocked auth check or a hand-typed expected response isn't real verification.
- **State the limitation instead of glossing over it.** Every "couldn't be verified end-to-end in this environment" case (embedded checkout completion, Financial Connections bank linking, live-carrier Shippo registration under a sandbox key) is documented explicitly rather than silently assumed to work — this discipline is itself a project artifact worth naming.
- **AI-assisted engineering requires an owner who reviews and challenges, not just approves.** The two clearest examples — the payment-arrangement availability rule (Decision #16) and the portal-eligibility override (Decision #35/#36) — exist because the owner caught a real gap between what the spec said and what the actual workflow needed, and corrected it. The audit trail this produced (a full Decisions.md log) is itself a byproduct of directing AI-assisted development deliberately rather than treating it as autonomous.

---

## 14. Future Roadmap

Clearly separated from completed work — pulled from `docs/ProductRoadmap.md`, which pins sequencing rationale ahead of scope.

- **Phase 2D — Inventory & Purchasing** (Planned): real stock counts decremented on order/invoice creation, low-stock alerts (unblocks Phase 2B's self-checkout from overselling); full scope includes supplier tracking, purchase orders, batch/lot tracking for research compounds, warehouse locations.
- **Phase 2E — Automation** (Planned): abandoned-cart emails, shipment follow-ups, review requests, reorder reminders, return-customer discounts — riding entirely on the existing notification dispatch system, no new infrastructure needed.
- **Phase 2F — Analytics Dashboard** (Planned): extends the existing `getInvoiceDashboardStats()` seam — revenue, best-sellers, repeat-customer rate, AOV, gross margin, payment-method mix.
- **Phase 2G — Compliance & Security, later items** (Planned): two-factor authentication, session management, real admin roles (today a single hardcoded admin id), formal audit-log expansion, automated backups/secrets rotation, a real Prisma migration history to replace `db push`. (Note: several *earlier* Phase 2G items — Stripe webhook idempotency, the `SHIP_FROM_STREET` mismatch, basic rate limiting, timing-safe Shippo webhook comparison — are already done, per `ProductRoadmap.md`.)
- **Phase 3A — Configurable Promotion Campaign system + FIRST10 completion** (Engineering Complete — Activation Pending): the `PromotionCampaign`/`PromotionCode` schema, lifecycle service, stacking-compatibility engine, and admin management UI shipped (`docs/Decisions.md` #41), then the FIRST10 claim flow was migrated onto it end to end — live campaign resolution, unique code issuance, and a real branded discount email (`docs/Decisions.md` #42) — verified live in production via a real test campaign (created, activated, storefront banner confirmed, then fully cleaned up) and a disposable rehearsal test hitting real Postgres and real Resend delivery. `FirstOrderOfferConfig.enabled` (the master switch) stays off in production, so the entire flow remains structurally inert pending an explicit owner go-ahead. Twilio double opt-in remains **not started**, deliberately deferred to its own slice pending an audit of the exact production Twilio/A2P-registered consent wording.
- **Phase 3B — Admin pricing intelligence + individual-vial admin access** (Planned): audit-first verification that every price tier is admin-editable with audit history, plus a "this invoice only vs. update product price" workflow for price corrections.
- **Phase 3C — Customer Portal reorder ("Buy Again")** (Planned): re-resolves historical purchases against *current* price/inventory/eligibility rather than cloning stale data; must never itself trigger payment.
- **Phase 3D — Global PepScore Lab notification/communication design system** (Email templates: **Complete**; broader scope: Planned): the email-template portion is done — all 18 customer- and admin-facing templates (32 rendering functions) migrated onto a shared branded email shell (`emails/shared/shell.ts`) across 5 slices (PRs #140–#144, `docs/Decisions.md` #43–#47), content/business logic unchanged, presentation only. Still open: an in-app Customer Portal notification component audit, an admin notification card audit, an SMS brand-name consistency check (deliberately deferred pending a Twilio A2P consent-wording audit — no SMS body copy was touched by this work), an admin preview capability for these templates using representative sample data, and a final brand-cohesion audit comparing Landing→Storefront→Portal→Email→In-app notification end to end.
- **Open architectural decision carried forward**: `User` and `Customer` remain two separate, unconnected identities — resolving this (adding `Customer.userId` and a claim flow) is explicitly Phase 2B's first task, not yet done.
- **Standing safety constraint for all future phases**: real bulk customer communication and real payment/checkout activation stay off throughout continued engineering work; only a defined short list of triggers (real money movement, security issues, blocking factual business questions) should stop autonomous execution.

---

## 15. Evidence Index

Every claim below traces to a real PR number or commit found in `git log`, cross-referenced against `docs/Decisions.md`/`docs/ChangeLog.md`. No PR number in this table is invented.

| Area | PR / Commit | Evidence | Result |
|---|---|---|---|
| Invoice system foundation | #1 (`8f9b97e`) | Decision #1–#14, `ChangeLog.md` "Initial build" | `Invoice` extended with items/discounts/payments; dual PDF generation; dashboard + builder shipped |
| Invoice branding / dark theme | #2 (`28ca541`) | Decision #10, #11 | Dashboard/builder moved to measured landing-page dark tokens |
| Dropdown contrast fix | #3 (`c2900c1`) | — | Fixed invisible white-on-white text in dark-theme selects |
| Payment arrangements | #4, #5 (`15ee3a4`, `68980f3`) | Decision #15, #16 | Real relational installment model; generalized beyond Partial-only invoices |
| PDF one-page fit | #6 (`8f59aff`) | Decision #18 | Root-caused footer `wrap` bug; verified via real PDF page counts |
| ZIP autofill / address sync | #7 (`937b88d`) | Decision #19 | Zippopotam.us proxy; ephemeral same-as-billing state |
| Invoice trash | #8 (`610aa42`) | Decision #20 | Soft-delete + two-step permanent delete, DB-enforced ordering |
| Automated archival | #9 (`09426d8`) | Decision #21 | Daily Vercel Cron sweep, `paidAt` as live countdown anchor |
| PDF logo enlargement | #10 (`e1cf353`) | `ChangeLog.md` | Verified against real invoices, still 1 page |
| Carrier-agnostic tracking | #11 (`342ae71`) | Decision #22 | `ShippingProvider` abstraction over Shippo; 47 unit tests added (first test framework) |
| Hobby-tier cron fix | #12 (`67fd4e8`) | `ChangeLog.md` | Fixed a bug silently blocking every production deploy |
| Sanitized Shippo errors | #13 (`9f95ad2`) | `ChangeLog.md` | Live Shippo production go-live: real USPS tracking, 16 real events |
| Automatic invoice-issued email | #14 (`f0e47e1`) | Decision #23 | Gated by activity-log presence, not a boolean flag |
| CRM foundation | #15 (`95ccbd3`) | — | `Customer`, intake links, activity log, notifications schema |
| Customer activity wiring | #16 (`0f97bb9`) | — | Wired into existing invoice touchpoints |
| Notifications subsystem | #17 (`35bad10`) | — | Dispatch, dashboard bell, email channel, SMS stub |
| Shipment one-to-many refactor | #18 (`9c4bdb3`) | Decision #24 | Dropped unique constraint; derived primary shipment |
| Fulfillment Gate | #19 (`d3a29ae`) | Decision #24 | Centralized "can this ship" check |
| Real Shippo label purchase | #21 (`fb0595b`) | Decision #24, #26 | Rate-shop + buy postage, DB write only after Shippo confirms |
| Payment Received email | #23 (`4951d5a`) | — | No dedup guard by design (each payment is a distinct event) |
| Fulfillment Workflow v1 doc | #24 (`704f79e`) | `ChangeLog.md` | Multi-shipment, gate, label purchase documented |
| Product Roadmap adopted | #25 (`65a1a1f`) | `ProductRoadmap.md` | Live Phase 2 planning document established |
| Stripe webhook idempotency fix | #26 (`09ea1c2`) | `ProductRoadmap.md` Phase 2G | Pulled forward from audit findings |
| Basic rate limiting | #28 (`0646358`) | `ProductRoadmap.md` Phase 2G | Checkout, both webhooks, zip-lookup |
| Timing-safe Shippo comparison | #29 (`aff0eab`) | `ProductRoadmap.md` Phase 2G | Hardened webhook auth |
| Customer Intake Workflow (Phase 2A) | #30–#36 | Decision set, `ProductRoadmap.md` | Marked **Complete** — real acceptance run |
| Customer Identity Platform | #70, #81–#89 | — | Portal identity linking, claim flow, security tests |
| Customer Portal shell → full views | #71–#73, #125 | — | Dashboard, invoices/payments/fulfillment, storefront Order history |
| Portal rollout kill-switch | #74 (`cd6fe6c`) | — | `PORTAL_ENABLED` |
| Auth Sprint (P1–P10) | #75–#80 | — | Clerk webhook, audit trail, authorization regression guard |
| Pricing / Inventory MVP | #91 (`964584d`) | — | Case/SPA/individual pricing, physical stock ledger, reservations |
| Backorder model | #93, #107–#109 | — | Reservation lifecycle, admin correction UI, catalog-level backorder |
| Payment-provider abstraction | #113 (`0ec9f52`) | Decision #28 | `PaymentProviderAdapter`, refund/dispute reconciliation fixed |
| Storefront inventory reservation | #114 (`ffa7cda`) | Decision #29 | `OrderReservation`, verified against real Stripe test session |
| ACH / Pay by Bank | #115 (`3b99da9`) | Decision #30 | Async lifecycle, `AchAuthorization`, no raw bank data stored |
| Admin Payment Settings + analytics | #116 (`3127b1b`) | Decision #31 | Real gates vs. readiness-only flags, live `groupBy()` analytics |
| Embedded Checkout + PayPal | #117 (`04e0133`) | Decision #32 | Venmo confirmed to have no Stripe path |
| Saved payment methods | #118 (`694f354`) | Decision #33 | Stripe Customer/SetupIntent reuse of embedded-Checkout component |
| Payment-change safety | #119 (`d413c43`) | Decision #34 | Stale Checkout Session invalidation on backorder-driven balance change |
| Payment readiness report | (`9bd5eab`) | `PaymentReadiness.md` | All live switches confirmed off, dated 2026-08-08 |
| Twilio A2P 10DLC readiness | #112 (`ef014d2`) | Decision #27 | Real STOP/START webhook, signature-verified |
| Portal eligibility fixes | #126–#134 | Decision #35–#40 | Duplicate-phone gap, lead-stage exclusion + override, live rollout cron, delivery-failure surfacing |
| Phase 3 roadmap pinned | #135 (`63af5c4`) | `ProductRoadmap.md` | Promotion Campaigns, pricing intelligence, reorder — queued, not yet built |
| Promotion Campaign architecture | #136 (`03ff2a9`) | Decision #41 | `PromotionCampaign`/`PromotionCode` schema, lifecycle service, stacking engine, admin UI — additive, zero behavior change to existing FIRST10 flow |
| Case study backfill | #137 (`8184bc8`) | This document's own history | Initial `docs/CaseStudy.md`, spot-checked against real `git log` before shipping |
| FIRST10 migrated onto Promotion Campaign system | #138 (`95b052e`) | Decision #42 | Live code issuance, real discount email, module split to fix a real client-bundle build failure; live-verified in production then cleaned up |
| Shared email shell + slice 1 (InvoiceIssued, PortalInvite) | #140 (`4c85ace`) | Decision #43 | `emails/shared/shell.ts` built from live-measured tokens; first 2 templates migrated |
| Email shell slice 2 (PaymentReceived, OrderConfirmation, RefundNotice, FirstOrderOfferCode refactor) | #141 (`b3dabec`) | Decision #44 | 5 rendering functions migrated |
| Email shell slice 3 (BackorderNotice, BalanceTransferNotice, TrackingUpdate, InvoiceShipmentUpdate) | #142 (`219487e`) | Decision #45 | 7 rendering functions migrated |
| Email shell slice 4 (AchPaymentProcessing, ClientArrangementDecision, ClientSubmissionConfirmation, ContactInquiry) | #143 (`d76b04d`) | Decision #46 | 7 rendering functions migrated |
| Email shell slice 5 — closing (IntakeLinkRequest, PortalSupport, all 3 admin-only templates) | #144 (`d0d0330`) | Decision #47 | 9 rendering functions migrated; completes the 18-template Phase 3D email migration |
| Regression test coverage | #124, #68 | — | Invoice-archiving suite; every admin route's `isAdmin()` check |

---

## 16. Portfolio Summary

Pepscore Lab is a production back-office platform — invoicing, payment arrangements, carrier-agnostic shipment tracking, a real fulfillment engine, CRM, and a Customer Portal — built for a peptide-research-supplier business through owner-directed, AI-assisted engineering with Claude Code. The owner defined product vision, requirements, architecture direction, business rules, and QA/production-validation standards; implementation, testing, and bug discovery were carried out under that direction and recorded in a 47-entry engineering decision log spanning 143 merged pull requests. The system reflects disciplined engineering practice throughout: provider abstractions reused across shipping and payments, derived-not-stored state to prevent drift, layered kill switches and fail-closed defaults on every real-money and real-communication path, and an audit-before-building discipline that caught and fixed several genuine production bugs (a silently-dropped Stripe refund webhook, an unreserved storefront inventory path, a cron misconfiguration silently blocking every deploy) before they became customer-facing incidents. The operational core — invoicing, fulfillment, tracking, CRM — is production-validated and in active use; payment processing and bulk customer communication are fully engineered but deliberately held behind activation switches pending explicit business go-ahead, exactly as documented in the project's own payment-readiness report.

---

## Continuous Update Rule

This document is not a final-week deliverable — it is maintained alongside development, updated as part of normal execution rather than as a separate documentation checkpoint. The standing rule: after a meaningful PR finishes implementation, testing, and merge/deploy/verification, and after the roadmap is reconciled, this case study and its Evidence Index are updated (or explicitly evaluated and judged not to need an update, for purely mechanical/formatting-only changes) before moving to the next task. Historical backfill (sections 1–16 above) was performed once, grounded in `docs/Decisions.md`, `docs/ChangeLog.md`, `docs/ComponentMap.md`, `docs/ProductRoadmap.md`, and `git log`, current through PR #135; subsequently extended incrementally through PR #144 (Decisions #43–#47, the 5-slice email-shell migration). Every subsequent meaningful PR is expected to extend this document rather than requiring a second backfill pass — if a future gap is found between the last documented milestone and current `git log`, the correct response is to backfill only that gap, not to regenerate the whole document. Status labels (Completed / Production Validated / Engineering Complete — Activation Pending / Deferred / In Progress / Planned) are re-checked against `docs/PaymentReadiness.md` and current production configuration whenever a labeled system changes, not assumed to stay accurate indefinitely.
