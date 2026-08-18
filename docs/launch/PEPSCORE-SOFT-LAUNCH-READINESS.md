# Pepscore Lab — Soft-Launch Readiness Dashboard

**As of:** 2026-08-18, post-AOAI-transfer soft-launch sprint
**Current live testing domain:** `https://pepscore-aoai.vercel.app` (the pre-transfer domain, `pepscore-compscigrads-projects.vercel.app`, is frozen/stale — do not use it)
**Custom domain status:** `pepscorelab.com` / `www.pepscorelab.com` remain untouched on `pepscore-landing`. Not cut over. See `docs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md` for the cutover procedure (prepared, not executed).

**How to read this doc:** GREEN means verified and launch-ready today. YELLOW means Michael has a specific, scoped action to take — most of these are already tracked in full detail in `docs/PendingOwnerActions.md`, which this doc links to rather than duplicates. RED means something genuinely blocks soft launch. BLUE is intentionally deferred, not needed for initial revenue. Nothing here is a nice-to-have dressed up as a blocker.

---

## 🟢 GREEN — Verified and launch-ready

### Storefront
- Homepage, category browsing, product detail pages, predictive search — all real, DB-driven, no stubs. Verified live: search → product → add to cart works correctly, cart sidebar shows correct pricing and live service-credit calculation.
- Mobile nav uses a hamburger below the `xl` breakpoint (1280px), with a documented 2026-08-18 fix for outside-click handling so nav links aren't dead on first tap. *(Verified in code; a live mobile-viewport screenshot wasn't possible this session — see Mobile note below.)*
- SEO: sitemap.xml, robots.txt, canonical tags, OpenGraph, and JSON-LD structured data (Organization, WebSite, Product, ProductGroup, FAQPage, BreadcrumbList) all present and correctly excluding inactive products/admin/account/checkout. **Fixed this session:** `NEXT_PUBLIC_APP_URL` was still pointing at the stale pre-transfer domain, which meant sitemap/robots/canonical/og:url were all silently wrong. Corrected and live-verified against the current domain.

### Account / Customer / Compliance
- Clerk sign-in/sign-up, RUO agreement/intake flow, customer profile/orders/invoices/tracking/payment-methods — all real, data-driven, with consistent auth-state handling across every subpage.
- Portal invitations (admin-triggered + the two cron jobs) are among the most defensively engineered surfaces in the app: feature flags, kill switch, dry-run default-on, allowlist, per-run caps, live re-checked eligibility.

### Cart / Checkout (code)
- Cart: variant-integrity-correct (case vs. individual vial coexist as separate lines), full add/remove/update/clear.
- Checkout: server never trusts client-submitted prices (line items re-resolved from DB), promo codes re-validated server-side, RUO re-confirmed at checkout.
- **Fixed this session:** added a Stripe `idempotencyKey` (keyed on `order.id`) to checkout session creation, closing a real (narrow) duplicate-Session risk from an SDK-level retry.
- The gated "Coming Soon" state (storefront checkout is intentionally dark — see YELLOW below) is a clean, designed page, not a broken error — verified live.

### Payments / Fulfillment (code + live admin)
- Stripe: webhook handler is thorough (signature verification, `checkout.session.completed`/expired/failed, refund/dispute reconciliation via `Payment` upserts). Payment Settings admin page transparently shows `STRIPE CONFIGURED / TEST MODE / CHECKOUT DISABLED` — verified live.
- Shippo: rate-shopping, label purchase, tracking webhook, and the 4-hour polling-fallback cron are all real and complete.
- **Fixed this session (real safety gap):** the Order-side label-purchase route (`app/api/shipping/labels/route.ts`) was missing the `SHIPPO_PURCHASING_ENABLED` kill-switch its invoice-side sibling already enforces. Shippo purchasing must stay off until the account clears Trust & Safety review regardless of key validity — this route could have bypassed that the moment a live key is installed. Now reuses the existing, already-tested gate.

### Communications / Automation
- Resend: 19 email templates, all built on a shared, XSS-safe shell; no placeholder copy or dead subject lines found. Centralized routing (`lib/notifications/routing.ts`) maps ~29 message categories to the correct From-name/Reply-To.
- Contact form: rate-limited, honeypot-protected, cross-origin-locked to an explicit allowlist, logs to `Communication` regardless of outcome.
- All 6 registered cron jobs verified complete in code and confirmed enabled/scheduled correctly in the live Vercel dashboard: archive-invoices, poll-tracking, portal-invite-reminders, portal-invite-rollout, promotion-campaign-schedule, release-abandoned-reservations. (A 7th, `first-order-offer-reminders`, is built and safety-gated but intentionally not yet registered — not a bug.)

### Admin (verified live against real production data)
- Dashboard, Customers (rich CRM with search/filters/merge/duplicate-detection), Invoices (including trash/soft-delete recovery), Fulfillment Command Center (bucketed queue, matches code exactly), Payment Settings — all verified working live, not just in code.
- Error/empty states throughout are handled deliberately (e.g., "Storefront (not yet launched — 0 orders on file)" rather than a blank table), and access-denied messaging is human-readable.

### Data integrity (full audit, 2026-08-18)
- 120 total products, zero duplicate (name, size) pairs, all slugs unique, zero missing/broken images (every one of the 51 currently-active product names has a curated, owner-approved family image — the two-layer `resolveProductImage()` system was verified to have full coverage), zero missing/impossible prices, zero malformed categories, zero empty descriptions.
- **Sitemap/catalog agreement is exact: 100 active products, 100 sitemap product URLs, zero discrepancies either direction.**
- Every specific identity concern raised was checked and confirmed already correctly handled from prior work: GLOW50 is properly archived (INACTIVE, not indexed); GLOW70 is the correct canonical active product; the legacy `BPC 10mg + GHK-Cu 50mg + TB500 10mg` record (archived) and GLOW70 correctly share one image via an explicit image-resolution-layer mapping (owner-approved, database records deliberately not merged to protect pricing/order/inventory history); standalone GHK-Cu/BPC 157/TB500 products are correctly distinct from that legacy combo record — no false-identity confusion found; CJC-1295/Ipamorelin variants (including the combo) are correctly modeled.
- Combination-product naming (`size` = summed component mg, e.g. "BPC 10mg + GHK-Cu 50mg" → size "70mg") is a consistent, intentional convention across all 6 combination products, not a bug.

### Security
- RBAC is simple (binary Customer/Admin) but correctly enforced everywhere; every admin route has a real auth gate.
- Webhook signature validation confirmed present for Stripe and Twilio; Shippo uses a shared-secret query param (Shippo doesn't sign payloads) with timing-safe comparison.
- No secrets logged, no exposed dev/diagnostic routes, no stray `console.log`/`debugger` (the few `console.log` calls found are intentional dry-run/audit logging, not debug cruft).
- Repo-wide sweep found zero TODO/FIXME in `app/`, `lib/`, or `components/`; zero functional hardcoded local file paths (two comments reference a source-asset's original download path for provenance only, never used as a live path); zero live "Holistic" branding references (one comment documents its prior removal); zero dev/test/debug API routes.

### Production build & tests
- Full test suite: **1369 tests passing across 125 files.**
- `npx tsc --noEmit` and `eslint --max-warnings=0` clean on every file touched this session.
- Clean production build (`rm -rf .next && npm run build`) after every change.
- All fixes committed, pushed, and verified deployed READY on the correct AOAI Production domain.

---

## 🟡 YELLOW — Owner action required

**Full detail for most of these is already tracked in `docs/PendingOwnerActions.md` (26 items, actively maintained) — linking rather than duplicating. Summarized here for the launch-critical ones:**

| # | Item | What's blocked | Detail |
|---|---|---|---|
| Y1 | **Flip `STOREFRONT_CHECKOUT_ENABLED`** once Stripe live keys are activated and RUO merchant-eligibility is confirmed | Real storefront checkout (currently shows a clean "Coming Soon" page) | `docs/PendingOwnerActions.md` #1 |
| Y2 | **Enable PayPal** in the Stripe Dashboard | PayPal as a checkout option specifically (card/ACH unaffected) | `docs/PendingOwnerActions.md` #2 |
| Y3 | **Resend domain verification** for `pepscorelab.com` (DNS records) | Cosmetic only — email currently sends from Resend's shared sandbox `From:` address; Reply-To is already correct | `docs/PendingOwnerActions.md` #5 |
| Y4 | **Legal/policy page copy** — Terms of Service, Privacy Policy, Shipping Policy, Returns & Refunds; decide whether a public Lab Results/COA page is part of launch | Nothing functionally, but a real pre-launch trust/compliance gap for a commerce site | `docs/PendingOwnerActions.md` #9 |
| Y5 | **Confirm Clerk production keys** before wide traffic (currently on development keys — works fine in real browsers, may fail in strict-privacy contexts) | Nothing for most users today | `docs/PendingOwnerActions.md` #26 |
| Y6 | **Enable phone/SMS as a Clerk sign-in/MFA factor** | Nothing — email/password auth already works and is Clerk-secured | `docs/PendingOwnerActions.md` #11 |
| Y7 | **Confirm Neon DB backup/PITR retention window** in the Neon dashboard | Nothing — automatic PITR exists by default on paid tiers, this only confirms the exact window | `docs/PendingOwnerActions.md` #10 |
| Y8 | **Review and clear 5 paid orders awaiting shipping labels** (oldest is 25 days old: PS-2026-000016, Chris Daly) — real, live operational data seen in the Fulfillment Command Center today | Nothing blocking launch, but genuinely actionable now | New finding, 2026-08-18 |
| Y9 | ~~Leftover "Rehearsal"/test invoices in production~~ — **done.** Found 11 draft/unpaid invoices named "Rehearsal ..."/"[REHEARSAL] Customer A/B" (created 2026-08-10/11, all synthetic `@example.com` emails or none — the IANA-reserved documentation domain, never used for real accounts; clearly leftover from an earlier autonomous session's own regression testing, not real business records). All 11 archived via the app's existing, reversible Archive/Trash mechanism (not deleted) — recoverable from the Invoices → Trash view if any turn out to matter. Active Invoices list now shows only real customer records (15, down from 26). One related item remains: a customer record with a synthetic `@delivered.resend.dev` email in the Customers list — left untouched (lower urgency, and customer-record removal has a different risk profile than invoice archiving given potential linked history) | Found and archived, 2026-08-18 |
| Y10 | **Master pricing report** — prepared but not sent (needs explicit approval to email) | Nothing | `docs/PendingOwnerActions.md` #19 |
| Y11 | **Price-Matching Guarantee mechanics** — the Mission section names it, but no eligibility/reimbursement policy exists yet | Nothing until a customer tries to invoke it | `docs/PendingOwnerActions.md` #24 |
| Y12 | **Individual Vial pricing formula** — old formula still in use pending a replacement decision | Nothing today (only affects 8 owner-approved public-vial products) | `docs/PendingOwnerActions.md` #18 |
| Y13 | **One live mobile-viewport browser check** — this session's browser-automation tooling could not resize the actual rendering viewport (confirmed on two attempts); mobile is code-verified only | Nothing — this is a verification gap, not a known defect | New finding, 2026-08-18 |
| Y14 | **One live customer-side (non-admin) Clerk login QA walkthrough** of `/account/orders` and `/account/tracking` | Nothing — shipped and tested from the admin/engineering side | `docs/PendingOwnerActions.md` #7 |

*(Full list of 26 tracked items, including finance/COGS backfill decisions, Twilio SMS registration, and RUO legal-wording sign-off, is in `docs/PendingOwnerActions.md` — none of them block soft launch of the core storefront/admin/payments flow.)*

---

## 🔴 RED — Genuine blockers

**None found that block a soft launch of the core application.**

The one item that could arguably be RED — **real storefront checkout is dark** — is deliberately, correctly gated (not broken) pending Y1's owner decision, and the business's actual current sales channel (admin-created invoices) is fully live and operating today ($4,978 in revenue across 15 real invoices — 26 before this session archived 11 leftover test "Rehearsal" invoices, see Y9 — verified in the live Admin dashboard). Soft launch does not require flipping `STOREFRONT_CHECKOUT_ENABLED` on day one if invoice-based selling is the intended initial channel — that's Michael's call (Y1).

No tax calculation exists anywhere in the storefront checkout flow (`Invoice.tax` stays 0; no Stripe Tax integration). **This is flagged, not classified, because it's a legal question this environment can't answer**: if Pepscore's jurisdiction(s) require sales tax collection on these transactions, this becomes a real blocker before real checkout activates. Recommend Michael confirm with a tax advisor before flipping Y1.

Shipping cost is hardcoded to $0 at storefront checkout time by design (`app/api/checkout/route.ts` comment: "Shippo rates fetched post-checkout") — reconciled later via admin. Confirm this is the intended launch behavior before flipping Y1, since it means paid orders never charge shipping automatically at checkout today.

---

## 🔵 BLUE — Intentionally deferred, not needed for initial revenue

- Bulk case-quantity discount enforcement at checkout (currently marketing copy only) — `docs/PendingOwnerActions.md` #16
- Finance: receipt file upload (currently a plain text URL field, no drag-and-drop storage integration) — #21
- Finance: invoice-line COGS admin input UI + historical backfill — #22, #23
- Twilio SMS (A2P 10DLC registration) — sending/receiving both fully engineered, gated on carrier registration — #3
- Real refund-initiation admin UI on `Order`/`Payment` (refund *reconciliation* from Stripe already works; a mature separate refund workflow already exists for `Invoice`) — noted in Phase 1 payments audit
- Granular RBAC beyond binary Customer/Admin (fine for a solo owner; relevant only if staff are added later)
- GA4/gtag specifically — Vercel Analytics + a first-party event catalog (`lib/analytics/events.ts`) already cover product_view/search/add_to_cart/begin_checkout/lead_capture, but there's no GA4 tag if that's specifically needed for ad-platform conversion tracking
- 7th cron job (`first-order-offer-reminders`) — built, safety-gated, intentionally not registered yet

---

## What changed this session (soft-launch sprint, 2026-08-18)

Code fixes (all tested, committed, pushed, deployed, live-verified):
1. `app/api/shipping/labels/route.ts` — added the missing `SHIPPO_PURCHASING_ENABLED` gate (real safety gap closed)
2. `app/api/checkout/route.ts` — added Stripe `idempotencyKey` to checkout session creation
3. `NEXT_PUBLIC_APP_URL` (Vercel env var) + `app/sitemap.ts`/`app/robots.ts`/`app/layout.tsx`/`lib/storefront/structuredData.ts` fallbacks — corrected from a stale/inconsistent domain to the current real serving domain

Production data cleanup:
4. Archived 11 leftover "Rehearsal"/test invoices from an earlier autonomous session's own regression testing, via the app's existing reversible Archive/Trash mechanism (see Y9) — no permanent deletion, no real (paid) records touched

Documentation:
5. `docs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md` — updated for the AOAI transfer (was still written against the frozen pre-transfer domain and team)
6. This document

No public customer AI activation, no domain cutover, no real financial transactions, no real customer communications performed this session.
