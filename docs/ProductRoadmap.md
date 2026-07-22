# Pepscore Product Roadmap

**This is a product document, not a coding document.** It defines what Pepscore is becoming and in what order, so that every future feature — whether scoped by you or by Claude — gets checked against it before a line of code is written. `docs/Decisions.md` still records *why* a specific technical choice was made once something is built; this document records *what* gets built next and *why it's next*, not *how*.

Written at the close of Fulfillment Workflow v1 (`docs/ChangeLog.md`, `docs/Decisions.md` #24), based on the completion audit performed immediately beforehand. Supersedes `docs/FutureRoadmap.md` as the live planning document — that file is kept for its historical decision context, not as a current source of truth.

## Vision

Pepscore started as a way to stop losing track of manual sales (DMs, cash, Cash App) alongside the Stripe storefront. It has since grown a full back-office operations core: invoicing, payment arrangements, carrier-agnostic tracking, and — as of this phase — a real fulfillment engine that gates, purchases, and monitors shipping labels end to end.

That operational core is now the foundation, not the frontier. **Phase 2's job is to make the customer experience progressively self-service, so the operational core spends less time being operated by hand and more time just running.** Every feature below exists to either (a) remove a manual step you currently perform, or (b) give you visibility you currently have to go looking for.

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

## Phase 2A — Customer Intake Workflow (Highest Priority)

**Why first**: this is the direct blocker on using the invoice workflow with real clients today — there's no way for a client to supply their own information; every draft invoice starts from scratch, typed in by an admin. Investigating turned up more than expected: the backend for this (`lib/intakeLinks.ts`'s secure token lifecycle, `lib/intake/validation.ts`'s submission schema, `lib/customers.ts`'s duplicate-detection/customer-upsert/draft-invoice-creation pipeline, `lib/notifications/dispatch.ts`'s admin notification) is already fully built. This phase is almost entirely a UI/wiring exercise, not new architecture — which is exactly why it can run first, ahead of the storefront and identity-model decisions below.

**Scope**:
- Admin "Request Customer Information" action on a draft invoice — generates a secure, expiring, single-purpose link, with copy-to-clipboard for sending however you already reach clients.
- A public, unauthenticated, branded intake form: billing/shipping address capture (ZIP autofill, "same as billing" checkbox), honeypot and rate-limit spam defenses, clear states for expired/invalidated/already-submitted/attempt-limit-reached links.
- A submission endpoint that runs the existing duplicate-detection → customer-upsert → draft-invoice-creation pipeline and fires the existing admin notification (dashboard + email).
- An admin Intake Queue page listing every intake-originated draft, using the already-built `getFulfillmentQueue()`.
- Full link lifecycle (active/viewed/submitted/expired/invalidated/attempt-limit-reached) with regenerate/invalidate admin controls, and timeline entries on the customer/invoice activity log for each step.

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

## How this document should be used

Before scoping any Phase 2+ feature, check it against this document: which phase does it belong to, does it depend on an earlier phase or an open decision above, and does it fit inside a phase's stated MVP or full scope. When a phase actually gets built, its *why-this-way* engineering decisions still go in `docs/Decisions.md` and its shipped state still goes in `docs/ChangeLog.md` and `docs/ComponentMap.md` — this document stays about sequencing and scope, not implementation detail. Update it when a phase completes, a priority genuinely changes, or a new open decision surfaces — it should stay a living reflection of what's actually next, not a static plan followed past the point it stops making sense.
