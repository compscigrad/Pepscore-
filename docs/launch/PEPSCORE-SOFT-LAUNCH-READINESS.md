# Pepscore Lab — Soft-Launch Readiness Dashboard

**As of:** 2026-08-18, post-AOAI-transfer soft-launch sprint
**Current live testing domain:** `https://pepscore-aoai.vercel.app` (the pre-transfer domain, `pepscore-compscigrads-projects.vercel.app`, is frozen/stale — do not use it)
**Custom domain status:** `pepscorelab.com` / `www.pepscorelab.com` remain untouched on `pepscore-landing`. Not cut over. See `docs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md` for the cutover procedure (prepared, not executed).

**How to read this doc:** GREEN means verified and launch-ready today. YELLOW means Michael has a specific, scoped action to take — most of these are already tracked in full detail in `docs/PendingOwnerActions.md`, which this doc links to rather than duplicates. RED means something genuinely blocks soft launch. BLUE is intentionally deferred, not needed for initial revenue. Nothing here is a nice-to-have dressed up as a blocker.

**Updated 2026-08-18 (same day, follow-up sprint):** reduced the YELLOW list to its smallest form — **`OWNER-LAUNCH-CHECKLIST.md` is the single document to read first.** That sprint also corrected two earlier findings that turned out to be wrong (Y4's legal pages were already fully drafted and live, not placeholders; Y3's Resend gap was narrower than stated — SPF/MX present, only the DKIM record is actually missing), and prepared five new supporting documents for owner decisions this environment can't make alone (sales tax, checkout shipping, Stripe/Shippo live-readiness, legal sign-off, and a final live-transaction rehearsal procedure).

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

**The shortest possible version of this section is `OWNER-LAUNCH-CHECKLIST.md`, written 2026-08-18 in a follow-up sprint — start there.** It supersedes the table below for prioritization; this table stays as the fuller index. Six supporting documents were prepared in that same sprint (research/plans, not activations): `SalesTaxDecision.md`, `CheckoutShippingOptions.md`, `StripeShippoLiveReadiness.md`, `LegalComplianceStatus.md`, `FinalTransactionRehearsal.md`, plus this file.

| # | Item | What's blocked | Detail |
|---|---|---|---|
| Y1 | **Flip `STOREFRONT_CHECKOUT_ENABLED`** once Stripe live keys are activated and RUO merchant-eligibility is confirmed | Real storefront checkout (currently shows a clean "Coming Soon" page) | `StripeShippoLiveReadiness.md`, `docs/PendingOwnerActions.md` #1 |
| Y2 | **Enable PayPal** in the Stripe Dashboard | PayPal as a checkout option specifically (card/ACH unaffected) | `docs/PendingOwnerActions.md` #2 |
| Y3 | **Add the missing Resend DKIM record.** Corrected 2026-08-18 by direct DNS lookup: `send.pepscorelab.com`'s SPF and bounce-handling MX are already correctly in place, but `resend._domainkey.pepscorelab.com` (CNAME) does not currently resolve — check the Resend Dashboard for the exact required value | Weaker mail authentication / more likely to land in spam even once the domain shows "verified" — not fully cosmetic, narrower than originally stated | New finding, 2026-08-18 |
| Y4 | ~~Legal/policy page copy~~ — **corrected 2026-08-18, was overstated.** All five pages (`/terms /privacy /shipping /returns /lab-results`) are already fully drafted and live, not placeholders — direct code read found the "Coming soon" footer fallback is dead code today. Remaining: fill in the Governing Law blank in Terms, confirm the COA claim is accurate, give final sign-off | Nothing functionally — pages are live today, just not search-indexed until approved | `LegalComplianceStatus.md` |
| Y5 | **Confirm Clerk production keys** before wide traffic (currently on development keys — works fine in real browsers, may fail in strict-privacy contexts) | Nothing for most users today | `docs/PendingOwnerActions.md` #26 |
| Y6 | **Enable phone/SMS as a Clerk sign-in/MFA factor** | Nothing — email/password auth already works and is Clerk-secured | `docs/PendingOwnerActions.md` #11 |
| Y7 | **Confirm Neon DB backup/PITR retention window** in the Neon dashboard | Nothing — automatic PITR exists by default on paid tiers, this only confirms the exact window | `docs/PendingOwnerActions.md` #10 |
| Y8 | ~~Review and clear 5 paid orders awaiting shipping labels~~ — **reclassified 2026-08-18: not a pure owner action, blocked on Shippo's Trust & Safety review** (`docs/PendingOwnerActions.md` #4) — purchasing is platform-gated regardless of what anyone clicks until that clears. Becomes actionable the moment `SHIPPO_PURCHASING_ENABLED` can be safely flipped | Nothing blocking launch (manual-tracking fallback is the real current workflow); becomes real backlog once Shippo clears | `StripeShippoLiveReadiness.md` |
| Y9 | ~~Leftover "Rehearsal"/test invoices in production~~ — **done.** 11 draft/unpaid invoices (synthetic `@example.com` test data from an earlier session's own regression testing) archived via the app's reversible Archive mechanism. Active Invoices list now shows 15 real records, down from 26. One related, lower-urgency item remains untouched: one customer record with a synthetic `@delivered.resend.dev` email | — | Found and archived, 2026-08-18 |
| Y10 | **Master pricing report** — prepared but not sent (needs explicit approval to email) | Nothing | `docs/PendingOwnerActions.md` #19 |
| Y11 | **Price-Matching Guarantee mechanics** — the Mission section names it, but no eligibility/reimbursement policy exists yet | Nothing until a customer tries to invoke it | `docs/PendingOwnerActions.md` #24 |
| Y12 | **Individual Vial pricing formula** — old formula still in use pending a replacement decision | Nothing today (only affects 8 owner-approved public-vial products) | `docs/PendingOwnerActions.md` #18 |
| Y13 | **One live mobile-viewport browser check** — reconfirmed 2026-08-18 via `window.innerWidth` that the browser-automation tooling genuinely cannot resize the rendering viewport in this environment (not a transient issue); mobile stays code-verified only | Nothing — verification gap, not a known defect | Reconfirmed 2026-08-18 |
| Y14 | **One live customer-side (non-admin) Clerk login QA walkthrough** of `/account/orders` and `/account/tracking` | Nothing — shipped and tested from the admin/engineering side | `docs/PendingOwnerActions.md` #7 |
| Y15 | **Decide sales tax collection.** No tax calculation exists anywhere in checkout today (`Invoice.tax` stays 0). Ship-from address is confirmed DC (informational only, not a legal conclusion) | Nothing until real checkout goes live — should be decided before Y1 | `SalesTaxDecision.md` |
| Y16 | **Decide checkout shipping.** Every order is currently charged exactly $0 shipping regardless of the advertised $150 free-shipping threshold (both branches of the code evaluate to 0) — not a customer-harming bug, but the threshold isn't actually enforced | Nothing until real checkout goes live — should be decided before Y1 | `CheckoutShippingOptions.md` |
| Y17 | **Run the final transaction rehearsal** once Stripe is live, before public announcement | Confirms the live pipeline end-to-end with real (small, refunded) money | `FinalTransactionRehearsal.md` |

*(Full list of 26 tracked items in `docs/PendingOwnerActions.md`, including finance/COGS backfill decisions and Twilio SMS registration — none of them block soft launch of the core storefront/admin/payments flow.)*

---

## 🔴 RED — Genuine blockers

**None found that block a soft launch of the core application.**

The one item that could arguably be RED — **real storefront checkout is dark** — is deliberately, correctly gated (not broken) pending Y1's owner decision, and the business's actual current sales channel (admin-created invoices) is fully live and operating today ($4,978 in revenue across 15 real invoices — 26 before this session archived 11 leftover test "Rehearsal" invoices, see Y9 — verified in the live Admin dashboard). Soft launch does not require flipping `STOREFRONT_CHECKOUT_ENABLED` on day one if invoice-based selling is the intended initial channel — that's Michael's call (Y1).

Sales tax (Y15) and checkout shipping (Y16) are both real open decisions, not classified RED because neither is a code defect — see `SalesTaxDecision.md` and `CheckoutShippingOptions.md` for the full analysis and options. Recommend deciding both before flipping Y1.

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

## What changed in the follow-up sprint (same day, 2026-08-18)

Research/planning documents (no activation, no code change):
- `docs/launch/OWNER-LAUNCH-CHECKLIST.md` — the single, shortest-possible prioritized action list
- `docs/launch/SalesTaxDecision.md`, `CheckoutShippingOptions.md`, `StripeShippoLiveReadiness.md`, `LegalComplianceStatus.md`, `FinalTransactionRehearsal.md`

Corrections to earlier findings (this doc and `docs/PendingOwnerActions.md` both updated):
- Y4/PendingOwnerActions #9: legal pages were already fully drafted and live, not placeholders — earlier finding was stale/overstated
- Y3/PendingOwnerActions #5: narrowed from "add DNS records" to "add the one missing DKIM record" — SPF/MX confirmed present by direct lookup
- Y8: reclassified — blocked on Shippo's third-party review, not a pure owner action
- Y13: reconfirmed (not just repeated) via `window.innerWidth` that the mobile-viewport tooling limitation is real, not transient

No public customer AI activation, no domain cutover, no real financial transactions, no real customer communications, no Stripe/Shippo live-mode activation performed in the follow-up sprint either.
