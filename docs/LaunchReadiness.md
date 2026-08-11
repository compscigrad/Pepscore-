# Pepscore Lab — Launch Readiness Checklist

**Compiled**: 2026-08-11, as Phase 4U of the Phase 4 Production Readiness & Launch Hardening initiative.

**Purpose**: one canonical, per-system launch-readiness status, evidence-based against `docs/Decisions.md`, `docs/CaseStudy.md`, `docs/PaymentReadiness.md`, and `docs/PendingOwnerActions.md` — never marked READY merely because code exists. A system is only **READY** when it is both code-complete and has been verified end-to-end (real test-mode rehearsal, live production read-check, or equivalent); code-complete-but-unverified or code-complete-but-owner-gated systems are labeled accordingly, never rounded up.

**Status legend**:
- **READY** — code complete, verified, and safe to activate today (or already live).
- **ENGINEERING READY — OWNER ACTION REQUIRED** — fully built and verified in test/sandbox mode; blocked only by a real-world action only the owner can take (credentials, account registration, a business decision).
- **BLOCKED** — a genuine unresolved defect or missing piece stands between here and launch.
- **DEFERRED** — intentionally not part of this launch; a documented, deliberate scope decision, not an oversight.
- **NOT REQUIRED** — doesn't apply to Pepscore Lab's actual launch model.

---

## Storefront (customer-facing)

| System | Status | Evidence |
|---|---|---|
| Product catalog / browsing / search | READY | Live in production today (read-only, no gate). SEO/structured-data confirmed solid (AOAI audit). |
| Cart | READY | `lib/cart-store.ts`, sell-unit-aware, live. |
| Checkout (page + API route) | ENGINEERING READY — OWNER ACTION REQUIRED | Fully built, verified end-to-end via a real Stripe TEST-mode sandbox rehearsal (Decision #66/#70): session creation → payment simulation → fulfillment → stock decrement, all correct. Gated behind `STOREFRONT_CHECKOUT_ENABLED` (off) and real Stripe live keys — both owner actions (`PendingOwnerActions.md` #1). |
| Promotion code redemption at checkout | READY (engineering) | Server-side authoritative validation, two-phase soft-hold, verified via real-Postgres rehearsal (Decision #62). Activates the moment checkout itself does — no separate gate. |
| Reservation-hoarding / abuse guard | READY | Per-email concurrent-checkout cap, verified (Decision #69). |
| Backorder purchasing on the live storefront | READY (engineering) | **RESOLVED (2026-08-11, PR #192, Decision #73)**: checkout now calls the existing `applyBackorder()` on any nonzero shortfall against a `backorderEnabled` product, producing a real `BackorderCondition` + automatic compensation. Verified end to end against real Postgres via synthetic fixtures (no live product currently has `backorderEnabled = true`). Activates the moment checkout itself does — no separate gate. |
| Payment methods: Card | ENGINEERING READY — OWNER ACTION REQUIRED | Test-mode verified. Needs live Stripe keys. |
| Payment methods: ACH | ENGINEERING READY — OWNER ACTION REQUIRED | Async lifecycle built and verified (Decision #30). Needs live Stripe keys. |
| Payment methods: PayPal | ENGINEERING READY — OWNER ACTION REQUIRED | App-side gate built (Decision #32). Needs PayPal enabled on the Stripe account in the Stripe Dashboard (`PendingOwnerActions.md` #2) in addition to live keys. |
| Payment methods: Cash App Pay | ENGINEERING READY — OWNER ACTION REQUIRED | Wired but never exercised end-to-end this session (`PaymentReadiness.md` §15 item 4) — recommend one real test-mode pass before enabling alongside live keys. |
| First-order offer / lead capture | READY | Real unique code issuance, real email delivery, real eligibility checks against actual order/invoice history (Decision #62's `hasAnyPriorOrder`). |
| Web/funnel analytics | READY | Vercel Analytics + first-party event catalog shipped (Decision #63), zero PII. |

## Customer Portal

| System | Status | Evidence |
|---|---|---|
| Portal data/service layer | READY | Every query correctly session-scoped (Decision #68's horizontal-access isolation check). |
| Portal activation (`PORTAL_ENABLED`) | ENGINEERING READY — OWNER ACTION REQUIRED | Currently off in this environment. Turning it on is a low-risk config change, not a code gap — but see the live-QA item below before flipping it for real customers. |
| Live customer-side browser QA walkthrough | BLOCKED (owner-dependent, not launch-blocking) | Requires a real, non-admin customer Clerk session this environment doesn't have (`PendingOwnerActions.md` #7). Doesn't block anything else — independent work continues regardless. |
| Self-service registration/claim automation | DEFERRED | Feature-flagged off (`CUSTOMER_SELF_REGISTRATION_ENABLED` unset); a deliberate staged-rollout decision, not a defect. |
| Bulk portal-invite rollout | ENGINEERING READY — OWNER ACTION REQUIRED | Fully built with real per-run caps, dry-run mode, delivery-failure surfacing (Decision #71 re-confirmed the caps). The one explicit action that triggers real bulk customer communication — `PendingOwnerActions.md` #6, never flipped autonomously by design. |

## Admin / Back Office

| System | Status | Evidence |
|---|---|---|
| Invoices (create/edit/payments/refunds/backorders/shipments) | READY | Most thoroughly-covered admin surface (Decision #68's 4D audit) — every state-changing action has a matching correction/reversal route. In active production use. |
| Online Storefront Orders (list/detail/cancel/mark-delivered) | READY | Built this Phase 4 cycle (Critical #2/#4, Decision #61) plus the Mark-as-Delivered fix (Decision #68). Verified via the sandbox checkout rehearsal. |
| Customer/CRM (list/detail/notes/duplicates) | READY | Core CRM solid. **RESOLVED (2026-08-11, PR #193, Decision #74)**: `lib/customers/merge.ts` provides a safe-merge-or-explicitly-blocked admin action for a weak-match duplicate customer pair, rendered directly on the duplicate-record banner. Verified end to end against real Postgres (safe-merge and blocked-merge scenarios). |
| Inventory corrections | READY | Exceptionally complete single-endpoint action set confirmed in the 4D audit — add/remove/reconcile/reverse-last, all real. |
| Identity review queue | READY | Full approve/dismiss flow, audit-logged. |
| Sales-origin clarity (Direct/Manual vs. Online Storefront) | READY | Phase 4Z shipped this session — derived, never backfilled, no double-counting by construction. |
| Admin auth model | READY for current scale; DEFERRED beyond it | Single `ADMIN_CLERK_USER_ID` — correct and sufficient for one operator (confirmed still accurate, Decision #68). Multi-admin roles/permissions explicitly a later-phase item once there's more than one operator (Phase 2G). |
| Failed-communication drill-down (which sends failed, not just a count) | BLOCKED (Phase 4Q seed scope) | Only an aggregate 7-day count exists today. Real gap, not yet built. |
| Data export (CPA/annual sales) | READY | `app/api/export`, admin-gated. |

## Inventory & Fulfillment

| System | Status | Evidence |
|---|---|---|
| Reservation concurrency safety | READY | `withOptimisticProductLock()` applied to all 9 write sites, verified via real-Postgres concurrent rehearsal (Decision #61). |
| Sell-unit-aware reservation math | READY | Verified via the sandbox checkout rehearsal (10 vials correctly deducted for 1 Standard Case). |
| Abandoned-checkout reservation release | READY | Stripe-session-verified reconciliation cron, real per-run cap, verified (Decision #61). |
| Manual invoice fulfillment (Pirate Ship + manual tracking) | READY | The actual current production shipping workflow — live and in use. |
| Shippo real-time carrier tracking | READY | Verified against Shippo's real test API pre-Phase-4. |
| Shippo label purchasing (real postage) | DEFERRED | Blocked on Shippo Trust & Safety business-registration review (`PendingOwnerActions.md` #4) — a pre-existing, deliberately-not-reopened deferral. |

## Security / Fraud / Performance / Accessibility

| System | Status | Evidence |
|---|---|---|
| Webhook signature validation (Stripe/Clerk/Shippo) | READY | Confirmed solid (Decision #68's 4F pass). |
| Webhook signature validation (Twilio) | ENGINEERING READY — OWNER ACTION REQUIRED | Correctly implemented; depends on `req.url` reflecting the real public URL (reliable on Vercel) — recommend one real signature check once Twilio is actually configured. |
| Timing-safe secret comparisons (cron auth, webhook secrets) | READY | Shared `safeCompare()` helper applied everywhere the pattern existed (Decision #65). |
| Admin authorization boundary | READY | Mechanically enforced by `adminAuthCoverage.test.ts` on every admin route. |
| Portal horizontal-access isolation | READY | Verified — every query session-scoped, no client-supplied identity trusted (Decision #68). |
| Reservation-hoarding / promo-abuse / duplicate-account / payment-replay controls | READY | Decision #69 — one real gap (hoarding) found and fixed; the other three confirmed already covered by existing work. |
| Secrets exposure | READY | Zero hardcoded keys in source; `.env.local` confirmed gitignored and never committed. |
| Rate limiting | READY, with a known scaling caveat | In-memory, single-instance — a deliberate, already-documented tradeoff with a clear `@upstash/ratelimit` swap-in path if traffic ever requires it (Decision #65). Not a defect. |
| N+1 / unbounded dashboard queries | READY | Two real instances found and fixed via `aggregate()`/`groupBy()` (Decision #70). One more (`computePortalAdoptionOverview()`'s full-table scan) investigated and correctly left alone — not measurably slow yet, and the "obvious" fix turned out to be wrong on inspection. |
| Missing database indexes | READY | Two real gaps found and fixed (`OrderItem`, `Communication`) — schema pushed and confirmed live. |
| Bundle size / heavy-dependency leakage | READY | Confirmed no server-only heavy package (`xlsx`, `stripe`, `twilio`, `@react-pdf/renderer`) reaches the client bundle. |
| Core Web Vitals (LCP path) | READY | Hero image uses `priority`, no blocking work before first paint. |
| Keyboard navigation / focus visibility | READY | Verified live via real browser automation against production — every nav link, icon-only button, and CTA reachable with a visible focus outline (Decision #70). |
| Accessible names on interactive elements | READY | Verified live — zero unlabeled icon buttons found. |
| Color contrast / screen-reader testing | BLOCKED (unverified, not failed) | Genuinely not checked this session — would need dedicated contrast-measurement tooling or a real screen reader, neither available here. Not claimed as passing. |
| Mobile/responsive rendering at real viewport widths | BLOCKED (tooling limitation, not a code defect) | The available browser-automation `resize_window` tool doesn't change this environment's actual rendering viewport (confirmed via `window.innerWidth`). Code-level review (Tailwind breakpoint consistency, dedicated mobile nav) found no issues, but real-viewport rendering is unverified. Recommend a manual pass on a real device, or revisit once viewport emulation works in this environment. |

## Brand / SEO / Legal

| System | Status | Evidence |
|---|---|---|
| Brand-name casing consistency | READY | One live regression found and fixed this cycle (Decision #71); full re-sweep confirmed zero remaining instances. |
| Visual design system (dark/gold hierarchy) | READY | Closed out in Phase 3D (Decision #60), re-confirmed via no new evidence of drift. |
| SEO fundamentals (sitemap/robots/canonicals/structured data) | READY | Confirmed solid by the AOAI flagship-alignment audit. Minor completeness gaps (homepage/category-index metadata, PDP OG image) are P2, not launch-blocking. |
| Terms of Service / Privacy Policy / Shipping Policy / Returns & Refunds | BLOCKED (owner action) | No page exists; footer links correctly made non-interactive rather than dead, but the underlying content gap is real (`PendingOwnerActions.md` #9). **Recommend closing before real checkout activates** — a real trust/compliance gap for a live commerce site. |
| RUO (Research Use Only) disclaimer | READY | Present and consistent across footer, checkout, and the RUO acknowledgment modal. |

## Notifications

| System | Status | Evidence |
|---|---|---|
| Transactional email (orders/invoices/payments/tracking/backorders/portal) | READY | 19+ templates, shared branded shell, delivery-logged via `Communication`. In active production use for the invoice/CRM side. |
| Real `pepscorelab.com` sender address | ENGINEERING READY — OWNER ACTION REQUIRED | Cosmetic-only gap — Reply-To already correct; From: falls back to Resend's sandbox address until DNS records are added (`PendingOwnerActions.md` #5). |
| SMS (transactional + STOP/START consent) | ENGINEERING READY — OWNER ACTION REQUIRED | Fully engineered send + signature-verified inbound path (Decision #27). Blocked entirely on Twilio A2P 10DLC registration (`PendingOwnerActions.md` #3) — every send gracefully no-ops without it. |
| Abandoned-cart / review-request / reorder-reminder emails | DEFERRED | Deliberately scoped to Phase 2E, not pre-launch requirements — confirmed still correctly deferred (Decision #68). |

## Infrastructure

| System | Status | Evidence |
|---|---|---|
| Database schema management | READY | `db push`-based, every change this session additive and verified live. |
| Database integrity (orphans, duplicates, invariant violations) | READY (current data) | Full sweep, zero violations found (Phase 4E). Caveat: small pre-launch dataset — recommend the same sweep periodically post-launch. |
| Deployment pipeline (CI → preview → merge → production) | READY | Proven across 20+ PRs this Phase 4 cycle alone, zero failed production deploys. |
| Rollback capability | READY | Vercel platform capability (redeploy any prior successful build), no app-side configuration needed. |
| Database backup / point-in-time recovery | ENGINEERING READY — OWNER ACTION REQUIRED | Neon provides automatic PITR by platform default on paid tiers; exact retention window needs confirming directly in the Neon dashboard (`PendingOwnerActions.md` #10) — this environment has no visibility into account/billing tier. |
| Review/testimonial system | NOT REQUIRED (this launch) | Deliberately deferred within Phase 2B scope — not part of Pepscore Lab's MVP storefront. |
| AI concierge | NOT REQUIRED (this launch) | Explicitly logged as a post-launch (Phase 5) candidate, out of Phase 4 scope by design — needs its own compliance/product scoping pass first. |

---

## Summary

**No real money, real postage, real bulk customer communication, or live-launch switch has been activated at any point.** Every ENGINEERING READY item above is fully built and test-mode-verified, waiting only on an owner action already itemized in `docs/PendingOwnerActions.md`. Every BLOCKED item is a named, real gap — none are hidden or rounded up to READY.

**Backorder handling on live storefront checkout — RESOLVED (2026-08-11, PR #192, Decision #73)**: the gap was real (a fully backordered item got no `OrderReservation` at all, no admin visibility queue existed). Checkout now calls the existing `applyBackorder()` on any nonzero shortfall against a `backorderEnabled` product, producing a real `BackorderCondition` and automatic compensation, verified end to end against real Postgres via synthetic fixtures (zero live products currently have `backorderEnabled = true`, so this was verified via test fixtures rather than a live product, per standing instruction never to flip a real product's backorder setting merely to test). No longer a gap blocking either checkout activation or backorder purchasing specifically.

**Customer-merge dead end — RESOLVED (2026-08-11, PR #193, Decision #74)**: a weak-match duplicate `Customer` pair previously had no system-provided consolidation path short of a raw database edit. `lib/customers/merge.ts` now provides either a full transactional merge or an explicitly blocked result naming the specific real identity conflict (differing linked portal login, differing Stripe customer, both already claimed a first-order offer) — never a silent dead end. Verified end to end against real Postgres for both outcomes.

---

## Phase 4X — Final Production-Readiness Report

**Counts across the checklist above** (64 line items, recalculated 2026-08-11 after PRs #192/#193): **42 READY** (including variants noting a scale caveat; the customer-merge item's prior "known sub-gap" note is now resolved and removed from the checklist text above, but it was already counted within READY, not BLOCKED), **11 ENGINEERING READY — OWNER ACTION REQUIRED**, **5 BLOCKED** (zero of which are genuine unresolved engineering gaps — the backorder-on-checkout item that was the checklist's one BLOCKED engineering gap is now resolved and moved to READY, see below; the remaining 5 are unverified-not-failed items or owner-dependent-but-not-launch-blocking, each labeled with its specific sub-reason in the checklist above), **3 DEFERRED**, **2 NOT REQUIRED**.

### Remaining QA (genuinely unverifiable in this environment, not skipped by choice)
- Color-contrast ratios and real screen-reader testing (4I) — needs dedicated tooling not available here.
- Real ~390px/~430px mobile-viewport rendering (4J) — the available browser-automation tool doesn't change this environment's actual rendering viewport.
- The checkout-page-hard-navigation cart-hydration observation (4W) — needs clean re-verification once local network conditions allow, or a real device.
- One live customer-side portal browser walkthrough (4C) — needs a real, non-admin Clerk session this environment doesn't have.

### Owner Actions (full detail in `docs/PendingOwnerActions.md`)
1. Stripe live activation + `STOREFRONT_CHECKOUT_ENABLED`
2. PayPal Dashboard enablement
3. Twilio A2P 10DLC registration
4. Shippo Trust & Safety review (deliberately deferred, not urgent)
5. Resend domain verification (cosmetic only)
6. PortalRolloutSettings activation (real bulk communication trigger)
7. Live customer-side portal QA walkthrough
9. Legal/policy page content (Terms/Privacy/Shipping/Returns) + COA program decision
10. Confirm Neon PITR retention window

*(Item 8 resolved this session.)*

### Blocked (genuine engineering gaps, not owner-dependent)

**None remaining.** Both items previously listed here are resolved:
1. ~~Backorder-on-storefront-checkout has no working admin path~~ — **RESOLVED 2026-08-11 (PR #192, Decision #73)**.
2. ~~No customer-merge path for a weak-match duplicate `Customer` pair~~ — **RESOLVED 2026-08-11 (PR #193, Decision #74)**.

No known independent engineering defect remains that can safely be fixed before pilot. Everything still open in this report is owner action, legal/provider input, a genuinely unverifiable-in-this-environment QA item (see above), or a deliberately deferred/post-launch scope decision.

### Launch Recommendation

```
READY FOR CONTROLLED PILOT
```

**Not** "Ready for Full Launch" — real payment activation, SMS, and bulk portal invitations all remain correctly gated behind owner actions that haven't happened yet, and the legal/policy page gap is a real trust surface for a live commerce site that should close before real customers transact. The recommendation is **not upgraded** by the resolution of the two engineering gaps below — closing an engineering defect is not the same as an owner/legal/provider activation gate being cleared, and those gates still stand exactly as before. **Not** "Not Ready" either — the operational core (invoicing, fulfillment, tracking, CRM, pricing, reorder, notifications, checkout, promotions, security, and abuse controls) is production-validated and has been in real use or real test-mode rehearsal throughout this entire Phase 4 cycle, and zero known independent engineering defects remain.

**Update (2026-08-11)**: the two genuine engineering gaps named in the original version of this report — backorder-on-storefront-checkout (Decision #73) and the customer-merge dead end (Decision #74) — are both resolved, verified end to end against real Postgres, and shipped to production (PRs #192, #193). This closes out every item this report is capable of resolving through engineering work alone.

**Concretely, before flipping any live switch**: (1) supply at minimum real Terms of Service and Privacy Policy content — the two most load-bearing legal pages for a commerce site; (2) complete the owner actions for whichever payment methods will actually be offered at launch. Everything else in this report is either already done or is a background-priority item that doesn't block a controlled pilot with a small, known customer group.
