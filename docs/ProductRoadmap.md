# Pepscore Product Roadmap

**This is a product document, not a coding document.** It defines what Pepscore is becoming and in what order, so that every future feature — whether scoped by you or by Claude — gets checked against it before a line of code is written. `docs/Decisions.md` still records *why* a specific technical choice was made once something is built; this document records *what* gets built next and *why it's next*, not *how*.

Written at the close of Fulfillment Workflow v1 (`docs/ChangeLog.md`, `docs/Decisions.md` #24), based on the completion audit performed immediately beforehand. Supersedes `docs/FutureRoadmap.md` as the live planning document — that file is kept for its historical decision context, not as a current source of truth.

## Vision

Pepscore started as a way to stop losing track of manual sales (DMs, cash, Cash App) alongside the Stripe storefront. It has since grown a full back-office operations core: invoicing, payment arrangements, carrier-agnostic tracking, and — as of this phase — a real fulfillment engine that gates, purchases, and monitors shipping labels end to end.

That operational core is now the foundation, not the frontier. **Phase 2's job is to make the customer experience progressively self-service, so the operational core spends less time being operated by hand and more time just running.** Every feature below exists to either (a) remove a manual step you currently perform, or (b) give you visibility you currently have to go looking for.

## Landing Page & Domain Migration Strategy

This is foundational context for every phase below, not a phase of its own — it governs how the storefront (2B) and any future public-facing work gets built.

**Updated 2026-07-22**: earlier versions of this section assumed a full domain cutover (`pepscorelab.com` eventually retiring the landing page entirely) was the default plan. That assumption is explicitly withdrawn — see "Current Architecture" below. The two frontends are now a deliberate long-term structure, not a temporary state pending cutover.

### Current Architecture

Two separate Vercel projects, confirmed by direct inspection of both projects' Domains settings:

- **`pepscore-landing`** — owns `pepscorelab.com` and `www.pepscorelab.com` (redirect + Production). This is the public marketing/brand site: education, product information, trust building, SEO, conversions. It remains the primary domain visitors see.
- **`pepscore`** — the operational application (admin dashboard, invoices, customers, Stripe, Shippo, Resend, CRM, fulfillment). Has **zero domains attached**; reachable only at its Vercel-assigned URL `pepscore-compscigrads-projects.vercel.app`. (`pepscore.vercel.app` looks like it should also work but has no live deployment behind it — confirmed 404; don't use it anywhere, including `NEXT_PUBLIC_APP_URL`.) May get its own subdomain later (e.g. `app.pepscorelab.com`), but that is not yet decided.

These are **two interfaces to one platform, not two businesses** — both must share the same backend database, authentication system, customer records, invoice/order/shipment data, Resend configuration, and Google Workspace email identities (`orders@`/`billing@`/`support@`/`contact@`/`admin@pepscorelab.com`). Never duplicate administrative functionality or spin up a second database.

The landing page should carry CTAs — "Admin Login," "Customer Portal," "Order Status," "Request Invoice" — that route into the application; it should never contain a second admin system of its own.

**Moving the root domain to the application is explicitly not the default next step.** Final routing architecture (whether `pepscorelab.com` ever points at the app, whether the app gets its own subdomain instead, or both coexist indefinitely) is an open decision to make later — don't build anything that assumes one outcome over the other.

## Foundation Assessment — is it stable enough to build on?

Per the completion audit, the three modules that make up the operational backbone score:

- **Invoice System — 95%**
- **Fulfillment Workflow v1 — 95%**
- **Carrier-Agnostic Tracking — 90%**

An ERP-shaped system is never "done" — there will always be another edge case, another carrier quirk, another report someone wants. The right bar to clear before expanding isn't 100%, it's: **does the current architecture already have the seams new features need, so Phase 2 extends it instead of rewriting it?** Concretely, yes:

- `lib/invoices.ts` is already the one service seam every invoice mutation goes through — a self-service checkout that creates invoices calls the same function admin-created invoices do.
- The `Shipment`/tracking/notification stack is already carrier-agnostic and already event-driven (webhook + polling) — inventory and CRM automation can hook into the same activity-log pattern rather than inventing a new one.
- `getInvoiceDashboardStats()` is already the named seam for analytics (`docs/Decisions.md`); `lib/notifications/` is already a pluggable dispatch/channel system with a real email channel and a real (if stubbed) SMS channel.
- The two live bugs the audit found (Stripe webhook idempotency, the `SHIP_FROM_STREET` mismatch) have since been fixed, along with basic rate limiting and a timing-safe Shippo webhook comparison — all four were contained, understood fixes that didn't touch this architecture, confirming the foundation itself was never the problem.

**Conclusion: yes, this is a good time to move on.** The one qualifier is below.

## Two open architectural decisions Phase 2 forces

Neither of these came up while the operational core was being built, because nothing customer-self-service-facing existed yet. Both need an answer before Phase 2B goes far, because they change the shape of everything under it.

### 1. `User` and `Customer` are two separate, unconnected identities today

`User` (`prisma/schema.prisma:17`) is the Clerk-linked storefront account — has `orders`, has `complianceLogs`, requires login. `Customer` (`prisma/schema.prisma:720`) is the invoice/CRM identity — no login, no Clerk link, just a snapshotted name/email/phone that an admin (or, as of Phase 2A, the customer themselves via an intake link) attaches to an invoice. **Phase 2B's "customer account portal" and Phase 2C's CRM are each currently building on top of a different one of these models.** Left alone, a signed-in customer and their own CRM history would never connect — you'd see their orders on one side and their support/CRM timeline on the other, with no link between them.

*Recommendation*: add an optional `Customer.userId` (or the reverse) as the very first Phase 2B task, so a self-service order can create-or-attach a `Customer` record the same way an admin-entered invoice (and now an intake-submitted one) does today. This is a small, additive schema change if done now; it gets more expensive the more Phase 2B/2C work lands on top of the split.

### 2. `Order` and `Invoice` are two parallel sale records by original design

`docs/Decisions.md` #1 deliberately kept `Invoice.orderId` optional so manual sales don't need a Stripe `Order` — that decision was correct for its time. Phase 2B's "draft invoice auto-populates from cart" implies a customer-initiated sale should still produce an `Invoice` (for the PDF/payment-arrangement/fulfillment machinery this whole session built), which means **self-checkout needs to decide whether it creates an `Order`+`Invoice` pair (today's Stripe-checkout pattern) or skips `Order` entirely and drives `Invoice` directly.** (This is separate from Phase 2A's intake-to-draft-invoice path, which already exists and doesn't touch `Order` at all.)

*Recommendation*: keep the existing `Order`+`Invoice` pairing for Stripe-paid self-checkout (it already works, is tested in production, and the Fulfillment Gate/tracking system already key off `Invoice`) — don't introduce a third sale-record shape. Reserve "skip `Order`" for a true zero-payment-processor path if one is ever needed.

## How completion is defined

A phase or feature is only **Complete** once both of the following are true — "all code written" is not the bar:

- **Code Complete** — implementation finished, tests passing, build clean.
- **Production Validated** — successfully exercised end-to-end with a real workflow in production, not a test script or a safe test-domain send.
- **Complete** = both of the above.

This distinction exists because merged PRs measure implementation, not customer readiness — a phase can be 100% code complete and still not be something a real customer has successfully gone through.

## Phase 2A — Customer Intake Workflow (Highest Priority)

**Status: Complete.** Every stage shipped and has been live-verified in production, including the single continuous real-customer acceptance run this status previously called for: a real intake link generated from a real draft invoice → opened fresh (no admin session) → ZIP-autofill resolved a real address (Houston, TX from 77002) → submitted → matched to an existing `Customer` record via the duplicate-detection/upsert pipeline (confirmed it fills only missing fields, never overwrites) → draft invoice auto-populated from the submission → admin notified (real Resend send, confirmed `SENT` with a provider message ID, not just a database flag) → invoice issued → invoice-issued email sent and confirmed `SENT` to a real inbox → payment recorded (paid in full) → manual tracking added and the customer notified (`SENT`) → every step logged to both `InvoiceActivityLog` and `CustomerActivityLog` with the correct event type and source. The one non-`SENT` row in the whole run was an SMS attempt correctly `SKIPPED` because Twilio isn't configured yet — exactly the documented graceful-degradation behavior, not a bug.

**Why first**: this is the direct blocker on using the invoice workflow with real clients today — there's no way for a client to supply their own information; every draft invoice starts from scratch, typed in by an admin. Investigating turned up more than expected: the backend for this (`lib/intakeLinks.ts`'s secure token lifecycle, `lib/intake/validation.ts`'s submission schema, `lib/customers.ts`'s duplicate-detection/customer-upsert/draft-invoice-creation pipeline, `lib/notifications/dispatch.ts`'s admin notification) is already fully built. This phase is almost entirely a UI/wiring exercise, not new architecture — which is exactly why it can run first, ahead of the storefront and identity-model decisions below.

**Scope**:
- Admin "Request Customer Information" action on a draft invoice — generates a secure, expiring, single-purpose link, with copy-to-clipboard, email, and SMS (once Twilio is configured) for sending however you already reach clients.
- A public, unauthenticated, branded intake form: billing/shipping address capture (ZIP autofill, "same as billing" checkbox), honeypot and rate-limit spam defenses, clear states for expired/invalidated/already-submitted/attempt-limit-reached links.
- A submission endpoint that runs the existing duplicate-detection → customer-upsert → draft-invoice-creation pipeline and fires the existing admin notification (dashboard + email).
- An admin Intake Queue page listing every intake-originated draft, using the already-built `getFulfillmentQueue()`.
- Full link lifecycle (active/viewed/submitted/expired/invalidated/attempt-limit-reached) with regenerate/invalidate admin controls, and timeline entries on the customer/invoice activity log for each step.
- Admin Notification Recipients settings page — without this, "fires the existing admin notification" had nowhere to send to; zero recipients existed in production until this shipped.

**Explicitly deferred within 2A**: no product browsing, no self-checkout (that's 2B), no CRM expansion beyond what the intake pipeline already writes to the customer timeline (that's 2C) — this phase is the front door, not the storefront or the back-office.

## Phase 2B — Customer Storefront

**Why next**: every feature here directly removes a step you currently do by hand — adding products to a draft invoice, calculating shipping, applying a discount code manually. This is the highest-leverage phase after intake because the backbone it depends on (Invoice, Fulfillment Gate, Promotion, tracking) is already the most mature part of the app.

**MVP scope**:
- Public product catalog with categories and search/filter (the `Product` model already has `category`; catalog today is read-only and unfiltered — this is a UI-and-query build, not a new data model).
- Product detail pages.
- Customer account portal, extended from today's read-only order history (`app/account/page.tsx`) — resolve the `User`/`Customer` link (above) as part of this, not after.
- Customer-initiated checkout: customer picks products, cart checks out through the existing Stripe flow, and the resulting `Order` gets its already-existing linked `Invoice` used as the real invoice — no admin re-entry.
- Coupon codes at checkout — reuse the existing `Promotion` model (already built for invoice discounts, including percentage/stacking logic in `lib/invoice/calculations.ts`) rather than building a second discount engine.
- Real shipping estimates before checkout — this **blocks** on fixing the audit's checkout-shipping-cost gap (currently hardcoded to `$0`); Phase 2B should call `lib/shippo.ts`'s existing `getRates()` pre-payment instead of only after a label is purchased.

**Explicitly deferred within 2B**: wishlists, product reviews/ratings, saved addresses beyond what Clerk/`User` already holds, guest checkout (require an account, since the portal is part of this phase's own value).

## Phase 2C — CRM

**Why the backend is already ahead of the frontend**: this is the weakest-scoring area in the audit (35%) for one specific reason — `Customer`, `CustomerActivityLog`, and `CustomerStatus` are fully built and have been silently logging every invoice, payment, and shipment event since earlier this session, but **no `/admin/customers` page exists to read any of it.** Building that page is the cheapest, highest-value first step in this entire phase, because the data it would display already exists — and by the time this phase starts, Phase 2A will have been writing intake-link timeline events into that same log too.

**MVP scope**:
- The `/admin/customers` list + detail page itself — customer record, computed `CustomerStatus`, and the full `CustomerActivityLog` timeline (including the intake-link history from Phase 2A), all already queryable today.
- Purchase history and lifetime value — derivable from existing `Invoice`/`InvoicePayment` records per customer, no new model needed.
- Internal notes — new, small addition to `Customer`.

**Full scope**:
- Follow-up reminders, tags, segments, marketing lists, communication history — each is additive on top of the `Customer`/`CustomerActivityLog` foundation, not a rework of it.
- Medical/provider preferences — treat as a plain custom field on `Customer` unless there's a specific compliance requirement driving its shape; don't build compliance tooling speculatively.

## Phase 2D — Inventory & Purchasing

**Why it trails the storefront**: self-checkout (2B) is the thing that makes inventory accuracy actually matter — right now `Product.inStock` is a manually-maintained boolean with no real count behind it, which is fine when you're the only one adding items to invoices, and not fine once customers are checking themselves out against a number that might be wrong.

**MVP scope** (unblocks 2B's self-checkout from overselling):
- Real stock counts on `Product`, decremented on order/invoice creation.
- Low-stock alerts, routed through the already-built `lib/notifications/` dispatch system — this is a new event type, not new notification infrastructure.

**Full scope** (can trail 2B rather than gate it):
- Supplier tracking, purchase orders (a `PurchaseOrderItem` could mirror `InvoiceItem`'s shape).
- Batch/lot tracking and expiration dates — worth real thought given Pepscore sells research compounds; scope this with whatever record-keeping standard you actually need before building it, rather than guessing at one.
- Warehouse locations, inventory valuation.

## Phase 2E — Automation

**Why it waits for 2A–2D**: most of these automations are, at their core, "notice something about a customer or an order and act on it" — which needs the CRM timeline (2C) and the storefront order flow (2B) to exist first so there's a reliable signal to automate against.

**Scope**, all riding on the existing `lib/notifications/` dispatch + Resend email channel (no new notification infrastructure needed, just new triggers):
- Abandoned cart emails, shipment follow-ups, review requests, reorder reminders, return-customer discounts (the last one composes naturally with the existing `Promotion` model), supplier notifications, internal admin reminders.

## Phase 2F — Analytics Dashboard

**Why it trails, not why it's unimportant**: analytics is most valuable once there's real self-service volume (2B) and inventory/CRM data (2D/2C) to analyze — building it earlier just means dashboards over sparse, all-manually-entered data.

**Scope**: extend `getInvoiceDashboardStats()` (the already-named seam per `docs/Decisions.md`) rather than querying Prisma directly from a new analytics layer — revenue, best-sellers, repeat-customer rate, AOV, shipping cost trends, gross margin, payment-method mix, inventory turnover (once 2D exists).

## Phase 2G — Compliance & Security

**Two different things are bundled under this heading, and they should be sequenced differently:**

**Already done** — these were pulled forward and fixed during Phase 2A's pre-work, since they were known, already-scoped issues from the audit, not future risk:
- Stripe webhook idempotency gap — fixed.
- The `SHIP_FROM_STREET`/`SHIP_FROM_STREET1` mismatch, reconciled with `FulfillmentSettings.returnAddress` so there's one return address, not two — fixed.
- Basic rate limiting on checkout, both webhooks, and the ZIP-lookup proxy — done; extend the same limiter to Phase 2A's public intake routes as they're built.
- Timing-safe comparison for the Shippo webhook shared secret — fixed.

**Genuinely new, later-phase work**, once there's more than one admin user or a real support/ops team:
- Two-factor authentication, session management, admin permissions/roles (today it's a single `ADMIN_CLERK_USER_ID` — fine for one operator, not for a team).
- Formal audit logs beyond the existing `AdminAuditLog`/`InvoiceActivityLog` (which already cover most of this — assess the gap before building a third logging system).
- Automated backups, secrets management rotation — infrastructure maturity items, not urgent at current scale.
- A real Prisma migration history (`db:push` has been the only schema-sync method since commit one) — worth adopting before the schema grows through several more phases' worth of new models, not because anything is currently broken.

## Recommended Sequencing

1. **Phase 2A** (Customer Intake Workflow) — highest priority, in progress now; the direct blocker on real-client usage of the invoice workflow.
2. **Resolve the `User`/`Customer` identity decision** — the one remaining open item before Phase 2B; the rest of the former "pre-2B hardening" list (Stripe webhook idempotency, `SHIP_FROM_STREET` fix, basic rate limiting, timing-safe Shippo comparison) is already done.
3. **Phase 2B** (Customer Storefront) — built on the hardened checkout path and the resolved identity model.
4. **Phase 2C MVP** (`/admin/customers` UI) — cheap relative to 2B/2D since the backend already exists; can run in parallel with the tail end of 2B.
5. **Phase 2D MVP** (real stock counts + low-stock alerts) — timed to land no later than 2B's self-checkout going live, to avoid overselling.
6. **Phase 2E** (Automation) — once 2B/2C give it real signal to act on.
7. **Phase 2F** (Analytics) — once 2B/2C/2D give it real data to show.
8. **Phase 2D full scope, Phase 2G later items, Phase 2C full scope** — ongoing, prioritized against whatever Pepscore's actual growth reveals as the next bottleneck, rather than pre-committed now.

## Customer Portal Readiness Assessment (Phase 2B pre-work)

Written after the Admin Portal Completion sprint (customer profiles, correspondence log, invoice send orchestration, balance carryover, discount admin) shipped and was production-validated. This assesses what a real customer-facing portal (Phase 2B's "customer account portal") would read and write against, given everything that now actually exists — not a design for the portal itself, no code changes here.

**Bottom line: the data and service layer are ready. Auth-scoping is not built yet — that is Phase 2B's actual first task, not a prerequisite that needs separate work first.**

### Identity linking and account claiming

Still genuinely open, unchanged from the "Two open architectural decisions" section above: `User` (Clerk-authenticated) and `Customer` (invoice/CRM identity, no login) remain unconnected. Nothing shipped this sprint added `Customer.userId`. What this sprint *did* add — the customer profile page, duplicate-detection surfaced in the UI, and the intake-link pipeline — all still operate on `Customer` alone, with no `User` involved, so they don't conflict with the eventual link; they're exactly what a signed-in customer's portal view would read once the link exists.

*Recommended claiming flow, given what's built*: a signed-in `User` claims their existing `Customer` history by verifying an email/phone match (the same signal `findPossibleDuplicateCustomers()` already uses for duplicate detection) — set `Customer.userId` on confirmed match, never auto-link on a bare email string match alone. A `User` with no matching `Customer` yet gets one created on their first self-service order, same as `upsertCustomerFromIntake()` does today for intake submissions. One `Customer` row should never belong to two `User`s; treat a second claim attempt against an already-linked `Customer` as a duplicate-support case, not an automatic merge.

### Duplicate resolution

Ready. `findPossibleDuplicateCustomers()` (`lib/customers.ts`) already runs on every intake submission and now also surfaces as a warning banner on the admin customer profile page (`app/admin/customers/[id]/page.tsx`). It never auto-merges — matches are surfaced for a human to resolve. A customer portal doesn't need new duplicate-detection logic; it needs the same function called at claim-time (above), with mismatches routed to an admin queue rather than silently resolved client-side.

### Customer-only authorization boundary

**Not built — this is Phase 2B's real first implementation task.** Today's admin auth is a single hardcoded `ADMIN_CLERK_USER_ID` check (see Phase 2G) — there is no concept of "a `User` scoped to only their own data" anywhere in the app yet. A customer portal needs a distinct authorization path, not an extension of the admin one:
- Every customer-portal query must filter by the requesting `User`'s linked `Customer.id` (or `Order`/`Invoice.customerId`) at the query layer — never reuse an admin route that trusts a caller-supplied ID.
- Admin-only fields must not round-trip through any customer-facing response: `Customer.internalNotes` (Phase 2C), discount preset management, balance-transfer creation/reversal, `AdminNotificationRecipient` data, and any other customer's records.
- This is new middleware/route-guard work, separate from `proxy.ts`'s existing admin-route matcher — likely a second matcher pattern (e.g. `/portal(.*)`, `/api/portal(.*)`) with its own Clerk-session-to-`Customer`-scoping check, mirroring the existing admin pattern structurally without sharing its trust boundary.

### Shared service boundary — confirmed, no duplication needed

One Neon Postgres database, one Prisma schema, one business-logic layer already serves both the admin app and the public intake pipeline (Phase 2A) today — there is no separate customer database and none should be introduced. The functions a customer portal would call already exist and are already exercised by non-admin callers:
- `lib/customers.ts` — `getCustomerProfileData()` (built this sprint) is the exact shape a customer's own "my account" view needs; a portal route would call it with the session's own `Customer.id` rather than an admin-supplied param.
- `lib/invoices.ts` — invoice read/PDF generation already customer-agnostic.
- `lib/balanceTransfers.ts` — `listBalanceTransfersForInvoice()` is safe for customer-facing read; `transferBalance()`/`reverseBalanceTransfer()` must stay admin-only (they move real money between invoices).
- `lib/notifications/log.ts` (`sendCategorizedEmail`) / correspondence log — a customer viewing their own `Communication` history reuses the same log the admin correspondence view (`CorrespondenceHistory.tsx`) already reads; the component already accepts a `customerId` prop for exactly this reuse.
- `lib/notifications/routing.ts` — category-based routing (`BALANCE_TRANSFER_NOTICE`, invoice/shipment/backorder categories) needs no change; a customer-initiated action (e.g. requesting a payment-plan change) would dispatch through the same categories, not a parallel notification path.

The rule for Phase 2B: every customer-portal read/write calls these same functions with a session-derived `Customer.id` filter added at the call site. No parallel "customer version" of `lib/invoices.ts` or `lib/customers.ts` should ever be written.

### What a customer should be able to see and do

Given the sprint's build-out, a portal's realistic v1 surface, all backed by existing data with no new models:
- **View**: their own invoices (issued, paid, open balance), payment history, account credits (`CustomerAccountCredit`), shipment tracking (`Shipment`/tracking fields already on `Invoice`), correspondence history (`Communication`, customer-scoped), and their own profile (name/email/phone/addresses).
- **Act**: select/change payment method on an open invoice (reusing existing payment-method fields), request a profile-detail update (write path should go through the same activity-log/notification pattern as intake — not a silent direct write — so admin sees the change), possibly initiate a balance-transfer *request* (not execute one — `transferBalance()` moves real money and must stay admin-executed even from a customer-initiated request).
- **Not see**: other customers' records, `internalNotes`, discount presets, `AdminNotificationRecipient` config, admin audit/activity logs beyond their own customer-scoped entries, balance-transfer reversal controls.

### Historical snapshot preservation

Already guaranteed, unrelated to any Phase 2B work. Every `Invoice` stores its own `customerName`/`customerEmail`/`customerPhone`/billing/shipping address snapshot independent of the live `Customer` record (established in `docs/Decisions.md`) — a customer editing their profile later never rewrites what an old invoice says it was billed to. A portal's "update my profile" action should update `Customer` only; past invoices keep their own snapshot untouched, exactly as admin-side edits already behave today.

### Net readiness

| Area | Status |
|---|---|
| Data model (`Customer`, `CustomerActivityLog`, `Communication`, `BalanceTransfer`) | Ready — no new models needed for v1 portal scope |
| Duplicate detection | Ready — reuse `findPossibleDuplicateCustomers()` |
| Shared service/business-logic layer | Ready — single DB, single `lib/` layer, already proven by intake pipeline reuse |
| Historical data integrity | Ready — snapshot fields already isolate past invoices from profile edits |
| `User`↔`Customer` identity link | Open — schema change + claim flow, still Phase 2B's first task |
| Customer-only auth/route-scoping | Not built — new middleware matcher + session-to-`Customer` scoping, Phase 2B's second task |
| Money-moving actions (balance transfer execution, refunds) | By design admin-only even post-launch — portal can request, never execute |

## Phase 3 — Growth & Operational Efficiency (pinned 2026-08-10)

Approved as a roadmap addition mid-way through the Customer Identity Platform / Portal Adoption Automation work (Phase 2B pre-work, above). That work continues; this phase queues up behind it and is being executed autonomously in the dependency order below, multi-PR, without a scoping checkpoint between slices — see the owner's own execution instructions preserved in full context for this phase (session transcript, not duplicated here). This section pins the *what* and *why-this-order*; `docs/Decisions.md` gets the *why-this-way* as each piece ships, and this section should be trimmed to a short "shipped" pointer once a sub-phase completes, the same way earlier phases in this document were.

### 3A. Configurable Promotion Campaign system + FIRST10 lead-capture completion

**Supersedes a hardcoded FIRST10 assumption.** The first-order acquisition offer (currently modeled as a fixed 10%) becomes the first configured instance of a reusable `PromotionCampaign` concept — admin can create/activate/retire/schedule a replacement offer (percentage or fixed-dollar) without a deploy, and every customer-facing surface (landing page copy, lead-capture modal, confirmation email, code generation) reads the *currently active* campaign rather than a hardcoded value. Reuses the existing `Promotion` architecture from PR #111 (per explicit instruction) rather than a disconnected coupon system — this is additive/generalizing work on that model, not a replacement.

Once the campaign model exists, complete the FIRST10 customer journey end to end: lead form (explicit, affirmative, non-pre-checked SMS consent, with full consent-evidence capture — wording/version/timestamp/source/campaign), dedup against existing Lead/Customer records, unique single-redemption code issuance tied to the active campaign, discount email via the existing Correspondence system, Twilio double opt-in (confirmation SMS → customer replies YES → confirmed consent recorded, idempotent), and STOP/HELP/re-opt-in integrated with Twilio's own Messaging Service/Advanced Opt-Out behavior rather than a second, conflicting keyword handler. A Lead who later becomes/matches an existing Customer must carry the same entitlement forward — never a second code for the same person, and an existing Customer submitting the lead form again must not receive a repeat first-order offer just because the active campaign changed.

**Depends on**: nothing new architecturally — extends `Promotion` (PR #111), `Customer`/lead-capture (already built), and the notification/correspondence stack (already built). The one real external dependency is the **exact production Twilio/A2P-registered consent and confirmation wording** — must match what's actually registered with the carrier, not be invented; audit current Twilio/A2P configuration before writing copy.

### 3B. Admin pricing intelligence + individual-vial admin access

Audit-first, per the owner's own framing (section 10 explicitly says "verify... confirm this capability exists end-to-end" before assuming a gap). Two distinct asks: (1) confirm the owner can always manually edit every price tier (case/SPA/bulk/individual-vial) from admin with audit history, filling any real gap found; (2) preserve `individualSalesEnabled = false` (storefront hidden) as independent from "a valid individual-vial price exists" — admin/manual invoicing must always be able to select Individual Vial for an active product with a stored price, regardless of public visibility. Then the "smart price edit" workflow: when a manually entered invoice-line price differs from the authoritative stored price, ask **This invoice only** (line-level override) vs **Update product price** (global, scoped to exactly the sell unit being edited — never cross-contaminating case/SPA/bulk), with the existing manual-override-beats-formula precedence preserved and inventory quantities left untouched by any pricing action.

**Depends on**: the existing Pricing MVP and manual-invoice line-item architecture (`lib/invoices.ts`, backorder/accommodation patterns already built this session) — likely mostly UI/workflow work once audited, not a new pricing engine.

### 3C. Customer Portal reorder ("Buy Again") + admin previous-purchase view

A repeat-purchase workflow reading historical Order/Invoice line items for *what* was bought, then re-resolving against **current** product/price/inventory/eligibility (SPA, sell-unit visibility, backorder policy) rather than cloning historical financial data — historical snapshots stay immutable per the existing invoice-snapshot precedent (`docs/Decisions.md`, Phase 2B readiness assessment above). Entry points: order history, order detail, invoice history (for non-storefront historical purchases), and a portal-home "Previously Purchased" surface. Buy Again populates a cart for review — it must never itself trigger payment; checkout/payment stays a deliberate, separate customer action, consistent with this session's standing "no real payment activation without explicit approval" boundary. Mirrors on the admin side as a "Previously Purchased → Add to New Invoice" shortcut on the customer profile, reusing current pricing/availability with the same one-time-override path as 3B rather than a separate mechanism.

**Depends on**: 3B's price-override decision UI is the natural reuse point for "current price differs from what the customer paid before" on the admin side; the Customer Portal's existing order/invoice history views (already built, this session's earlier Phase 2B work) are what reorder extends, not a new read path.

### 3D. Global PepScore Lab notification/communication design system (pinned 2026-08-10)

A permanent, ongoing UX/branding requirement, not a one-time migration: every customer-facing communication surface — transactional/promotional email, portal invitation/reminder email, in-app Customer Portal notifications, admin notification cards, and (text-only, within SMS's own constraints) SMS — must read as one cohesive PepScore Lab product alongside the storefront/admin/Customer Portal's dark-gold visual system, not a disconnected, under-branded legacy look. Brand name is `PepScore Lab` (not standalone `PepScore`) on every customer-facing surface. Direction is "premium dark luxury" (charcoal/graphite/layered depth, a real gold-gradient accent) — explicitly not flat solid black everywhere and not a flat-yellow accent.

**Scope**: (1) a centralized, reusable branded email shell (header/wordmark → gold accent → content → CTA → footer) that every email template plugs into, replacing each template's current ad hoc inline-HTML styling; (2) a shared token set (background/panel/text/border/gold/gold-gradient/CTA/semantic colors) derived from the same visual source of truth as `components/invoices/theme.ts` and the storefront's measured dark tokens (`docs/Decisions.md` #10), expressed in email-safe inline-CSS form since email HTML can't use the frontend's Tailwind/CSS-variable architecture directly; (3) migration of every existing customer-facing template (portal invite/reminder, FIRST10/promotion code, invoice issued/revised, payment received, backorder notice/accommodation, tracking/shipment, refund, lead-follow-up) onto the shared shell — content/business logic unchanged, presentation only; (4) an admin preview capability for reusable templates using representative sample data, no real send required; (5) a lighter pass auditing in-app Customer Portal/admin notification surfaces for the same dark/gold cohesion, and a controlled-hierarchy pass on the broader dark frontend so "dark" reads as intentional depth rather than undifferentiated black.

**Depends on**: nothing architecturally new — this is a presentation-layer migration of already-shipped, already-tested notification-sending logic (`lib/notifications/log.ts`'s `sendCategorizedEmail`, `lib/notifications/routing.ts`'s category system), not a rework of when/why/to-whom anything sends.

**Permanent rule going forward**: any new customer-facing email or visual notification must be built on the shared shell/tokens from the start — no new standalone-styled template.

### Sequencing and safety constraints (apply to all of 3A–3D)

1. Audit → architecture → implementation → tests → preview/browser/mobile verification → PR → CI → routine squash-merge → deploy → smoke test, per-slice, matching this session's established workflow.
2. Real bulk customer communication and real payment/checkout activation stay OFF throughout — every send during engineering uses synthetic/owner-controlled recipients, exactly as every other communication-adjacent feature this session has shipped.
3. Only stop for: real bulk customer communication, real payment activation, real money movement, owner-only authentication/paid-provider registration, destructive production changes, a serious security issue, truly blocking factual business data, or an actual usage limit — otherwise continue autonomously across PR slices without a scoping checkpoint, per explicit owner instruction for this phase.

**Phase 3 status: Complete.** All of 3A–3D shipped and are documented in `docs/Decisions.md` #41–#60 and `docs/CaseStudy.md`.

## Phase 4 — Production Readiness & Launch Hardening (added 2026-08-10, owner-directed)

Feature completion is not production readiness. Phase 4's goal: audit the entire live system end-to-end and close the remaining technical, UX, operational, security, reliability, performance, and launch-readiness gaps standing between the current state and a controlled real-customer launch.

**Sub-phases** (each its own audit-then-fix slice, same autonomous cadence as Phase 3 — implement → test → merge → deploy → verify → reconcile roadmap → update case study → continue, no stopping between sub-phases):

- **4A — Full system production audit**: every subsystem (storefront, checkout, identity, portal, invoices, payments, promotions, reorder, backorders, inventory, pricing, admin/CRM, notifications, fulfillment, tracking, analytics, cron, webhooks, auth, database, deployment config) reviewed for actual workflow completeness, not just code existence.
- **4B — End-to-end customer journeys**: new-customer acquisition (landing → FIRST offer → account → portal → cart → checkout → order → invoice → reservation → fulfillment → tracking → reorder), existing-customer (portal → orders/invoices/tracking → Buy Again → cart), admin-assisted (customer → Previously Purchased → new invoice → pricing/backorder decisions → payment), and backorder (unavailable → purchase → compensation → restock → fulfillment) — verified in sandbox/test mode only.
- **4C — Customer Portal live QA**: resolve the standing live-browser QA checkpoint (`docs/PendingOwnerActions.md` #7) if a safe test account can be used without real customer communication; verify every portal surface visually in production plus horizontal-access isolation between customers.
- **4D — Admin operational QA**: every admin surface exercised as real daily-use, looking for operational friction that would require a database edit or developer intervention for a routine action.
- **4E — Database & data-integrity audit**: orphan records, missing FKs, duplicate identities, inventory/reservation inconsistencies, stale invite states — safe deterministic corrections proceed with audit logging, ambiguous records are pinned for owner review, never auto-mutated.
- **4F — Security hardening**: authorization boundaries, webhook signature validation, secrets exposure, rate limiting, idempotency, race conditions — fix real vulnerabilities with regression coverage, never weaken a working control.
- **4G — Fraud/abuse controls**: promo-code abuse, duplicate accounts, payment/refund replay, reservation hoarding — reasonable controls, no unnecessary customer friction.
- **4H — Performance**: query efficiency, N+1s, pagination, indexes, bundle size, Core Web Vitals — fix measured/obvious risks, not theoretical ones.
- **4I — Accessibility**: keyboard nav, focus management, contrast, screen-reader labels across storefront/portal/admin.
- **4J — Mobile/responsive QA**: ~390px/~430px widths across the full system.
- **4K — Brand QA**: final PepScore Lab naming/logo/gold-gradient/hierarchy consistency pass — no redesign without evidence of a problem.
- **4L — Email/SMS/communication readiness**: every template's shell/CTA/links/consent language verified, sandbox destinations only.
- **4M — Payment launch readiness**: re-audit every payment method/flow built in Phase 2; prepare exact owner activation steps; do not activate live payments.
- **4N — Inventory/fulfillment launch readiness**: stock init/adjustment, reservation concurrency safety, sell-unit conversion, no double-counted physical vial.
- **4O — Promotion/pricing launch readiness**: campaign CRUD, stacking rules, FIRST/Family & Friends eligibility, admin price-override paths.
- **4P — Scheduled jobs/automations audit**: fail-closed behavior, idempotency, kill switches, recipient caps on every cron.
- **4Q — Observability & failure visibility**: failed sends/webhooks/payments/cron runs must be visible to admin without being noisy about theoretical events.
- **4R — Legal/policy surface audit**: verify existing Terms/Privacy/Refund/RUO-disclaimer surfaces are present and linked — never fabricate or materially rewrite legal language without owner/legal input; pin what's missing.
- **4S — SEO/indexing final audit**: sitemap, robots, canonicals, structured data, no admin/account indexing, current brand naming.
- **4T — Backup/recovery/operations audit**: Neon backup/PITR status, Vercel rollback, env-var recovery documentation — no paid products purchased without owner approval.
- **4U — Launch checklist**: a new `docs/LaunchReadiness.md` with READY / ENGINEERING READY–OWNER ACTION REQUIRED / BLOCKED / DEFERRED / NOT REQUIRED status per launch-critical system — never READY merely because code exists.
- **4V — Pending Owner Actions reconciliation**: `docs/PendingOwnerActions.md` re-verified against actual current state, stale items resolved/removed.
- **4W — Controlled launch rehearsal**: the closest full rehearsal possible without real money/postage/bulk communication.
- **4X — Final production-readiness report**: Production Ready / Engineering Ready–Owner Action Required / Blocked / Deferred / Remaining QA / Owner Actions / a launch recommendation (Not Ready / Ready for Controlled Pilot / Ready for Full Launch), evidence-based.

**Safety constraints (apply to all of 4A–4X, same standing rule as Phase 3)**: real money, real postage, real bulk customer communication, and live-launch switches stay OFF throughout unless explicitly authorized. Only stop autonomous execution for: real bulk customer communication, real payment activation, real money movement, owner-only authentication/paid-provider registration, a destructive production change, a serious security issue, or an actual usage limit — a single owner-blocked item is pinned in `docs/PendingOwnerActions.md` and every other independent sub-phase continues. Case-study maintenance continues throughout as its own permanent requirement, not a Phase 4 checkbox.

## How this document should be used

Before scoping any Phase 2+ feature, check it against this document: which phase does it belong to, does it depend on an earlier phase or an open decision above, and does it fit inside a phase's stated MVP or full scope. When a phase actually gets built, its *why-this-way* engineering decisions still go in `docs/Decisions.md` and its shipped state still goes in `docs/ChangeLog.md` and `docs/ComponentMap.md` — this document stays about sequencing and scope, not implementation detail. Update it when a phase completes, a priority genuinely changes, or a new open decision surfaces — it should stay a living reflection of what's actually next, not a static plan followed past the point it stops making sense.
