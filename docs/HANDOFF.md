# Pepscore Development Handoff

**Last updated:** 2026-07-23, mid Phase 2B (Customer.userId identity-link task)
**Purpose:** living checkpoint — update this file at the end of every major session so work can resume with minimal context loss if a terminal/browser session is lost. Supersedes nothing; `docs/ProductRoadmap.md` remains the source of truth for phase scope and sequencing, `docs/Decisions.md` for why-this-way engineering decisions, `docs/ChangeLog.md` for shipped history. This file is the *"where exactly did we stop"* snapshot.

---

## 1. Current Project State

- **Repo**: `C:\Users\micha\pepscore` (GitHub: `compscigrad/Pepscore-`)
- **Current branch**: `feature/customer-user-identity-link`
- **Latest commit**: `0d8fdf010c3e73aeb523fda8de3b20ed75addb3c` — "Link Customer to storefront User (Phase 2B identity resolution)"
- **Open PR**: [**#42**](https://github.com/compscigrad/Pepscore-/pull/42) — `feature/customer-user-identity-link` → `master`. Status: **Open, not merged.** 2/2 checks passing, no conflicts, "Merging can be performed automatically."
- **Vercel Preview deployment for PR #42**: Ready, at `https://pepscore-git-feature-customer-user-32a4dc-compscigrads-projects.vercel.app`
- **Working tree**: clean. Only untracked file is `byc-form-index.html` (pre-existing, unrelated to this project's work — do not stage).
- **Uncommitted files**: none.
- **Local dev server**: running in the background (`npm run dev`, Turbopack, `http://localhost:3000`), restarted earlier this session after a Prisma Client regeneration required stopping it first.

## 2. Phase Status

| Phase | Status | Notes |
|---|---|---|
| Foundation (Invoice System, Fulfillment Workflow v1, Carrier-Agnostic Tracking) | **Completed** | 95% / 95% / 90% per the last completion audit; roadmap explicitly judged this a good foundation to build Phase 2 on. |
| Phase 2A — Customer Intake Workflow | **Completed** (this session) | Full real-customer acceptance run completed this session: env var/fallback bug fixed across `pepscore` (Production + Development + `.env.local`) and `pepscore-landing` (footer fallback), fresh intake links generated in both local dev and production, one full real intake submission verified end-to-end (link → customer upsert → draft invoice → DB record), test invoices (PS-2026-000010, PS-2026-000011) moved to recoverable Trash per your instruction — **not yet permanently purged**, pending your next production-cleanup review. |
| Phase 2B — Customer Storefront | **In Progress** | See Section 3 below — first task (`Customer.userId` identity link) is code-complete, tested, and PR'd, but **not yet merged**; real signed-in acceptance test is mid-flight and paused at a human-required step (Cloudflare Turnstile). |
| Phase 2C — CRM | **Not started** | Backend (`Customer`, `CustomerActivityLog`, `CustomerStatus`) already exists from Phase 2A; only the `/admin/customers` UI is missing. |
| Phase 2D — Inventory & Purchasing | **Not started** | Blocked behind Phase 2B's self-checkout per roadmap sequencing (need it live before oversell risk matters). |
| Phase 2E — Automation | **Not started** | Waits on 2B/2C per roadmap. |
| Phase 2F — Analytics Dashboard | **Not started** | Waits on 2B/2C/2D per roadmap. |
| Phase 2G — Compliance & Security | **Partially done** | Webhook idempotency, `SHIP_FROM_STREET` fix, rate limiting, timing-safe Shippo comparison — already fixed pre-Phase-2A. 2FA/roles/formal audit logs/migration history — not started, correctly deferred. |

## 3. Current Task

**Objective**: Resolve the Phase 2B-blocking architectural decision — `User` (Clerk-linked storefront account) and `Customer` (invoice/CRM identity) are two separate, unconnected identities today. This task adds an optional `Customer.userId` link and the resolution logic so a signed-in storefront customer converges onto the same CRM record that admin-entered and intake-submitted invoices already use.

**Files involved**:
- `prisma/schema.prisma` — added `Customer.userId String? @unique` + `user User? @relation(...)`, and the reverse `User.customer Customer?`. **Already applied directly to the shared production database** (you ran `npx prisma db push --accept-data-loss` manually after the Claude Code permission classifier blocked me from running it directly — confirmed successful, no data loss, schema synchronized).
- `lib/customerIdentity.ts` (new) — pure decision function `decideCustomerIdentityAction()`: given "already linked?" + a list of email-matching candidates (each with their own `userId`), decides `ALREADY_LINKED` / `LINK_EXISTING` / `CREATE_NEW` / `AMBIGUOUS`. Zero database access — mirrors the existing `lib/intakeLinkState.ts` pure-function pattern used elsewhere in this codebase.
- `lib/customerIdentity.test.ts` (new) — 6 unit tests covering every branch, including the two safety-critical ones: never guess across 2+ unclaimed matches, never let a User claim a Customer already linked to someone else.
- `lib/customers.ts` — added `resolveCustomerForUser(userId)`, the single centralized I/O wrapper around the pure decision function; extended `CustomerInput`/`createCustomer()` with an optional `userId` field (unused by every existing caller — intake and admin paths are unaffected).
- `app/account/page.tsx` — calls `resolveCustomerForUser(user.id)` once, right after the existing `prisma.user.upsert`; logs (does not throw or block rendering) if the result is `AMBIGUOUS`.

**What is already complete**:
- Schema change designed, diffed (`prisma migrate diff`, confirmed additive-only SQL), inspected against production data (0 Users, 1 Customer, zero duplicate/ambiguous emails at inspection time — completely clean slate), and applied.
- Prisma Client regenerated locally (had to stop the dev server first — Windows file lock on `query_engine-windows.dll.node`).
- Full implementation written and committed.
- Full validation suite green: `tsc --noEmit` clean, `eslint .` clean (repo-wide, one unrelated pre-existing warning in `app/checkout/page.tsx`), `vitest run` — **123/123 passing**, `next build` clean.
- Branch pushed, PR #42 opened, Vercel Preview deployed and Ready, both PR checks green.

**What still remains** (this is exactly where the session paused):
- **Real signed-in acceptance test**, in progress via a human-assisted "guide mode" checkpoint:
  1. Navigated the Preview URL's `/account` page → redirected to Clerk sign-in (not already authenticated — Preview deployments don't share the admin browser session).
  2. Switched to Clerk sign-up, used a disposable Clerk dev-mode test address: `phase2b-acceptance-test+clerk_test@pepscorelab.com` / password `[DISPOSABLE TEST CREDENTIAL — recreate through Clerk if needed]` (the `+clerk_test` suffix makes Clerk accept the fixed OTP `424242` instead of emailing a real code).
  3. Hit a **Cloudflare Turnstile "Verify you are human" checkbox** — I cannot complete CAPTCHAs/bot-detection challenges under any circumstance, so this needs you.
  4. **I gave you Step 1** ("click the Cloudflare checkbox, wait for the green check") and was waiting for your confirmation when this checkpoint was requested instead.
- Once past Turnstile, remaining sign-up steps (likely an OTP-entry screen — enter `424242`) still need to be walked through one at a time in guide mode.
- Once signed in and landed on `/account`, the acceptance verification still to run:
  1. Confirm the Clerk `User` row was created (query `User` by the test email).
  2. Confirm exactly one `Customer` is linked (`Customer.userId` set to that `User.id`).
  3. Confirm no duplicate `Customer` rows were created.
  4. Confirm idempotency (revisiting `/account` a second time doesn't create/change anything).
  5. Confirm the pre-existing intake-only `Customer` ("TEST DeleteMe", `userId = null`) is completely unaffected.
  6. Confirm the account page itself rendered without error using the linked `Customer`.
  7. Report pass/fail against every Phase 2B acceptance criterion from the approved plan.
- **Only after that passes**: merge PR #42, then report the next Phase 2B task scope (the shipping-estimate fix — see Section 7).
- Test Clerk account cleanup: once verified, the test `User`/`Customer` pair (`phase2b-acceptance-test+clerk_test@pepscorelab.com`) should be deleted or clearly flagged as test data, same pattern as PS-2026-000010/000011.

## 4. Current Architecture

- **Landing site** — `pepscore-landing` Vercel project, owns `pepscorelab.com` / `www.pepscorelab.com`. Static marketing/pre-launch site. Its footer's "Admin Sign In" link was fixed this session (dead fallback domain → correct app URL), committed (`e1d2688`), deployed, verified live.
- **Application** — `pepscore` Vercel project (admin dashboard, storefront, invoices, fulfillment, intake). **Zero custom domains attached** — deliberate, documented decision (PR #41); reachable only at `pepscore-compscigrads-projects.vercel.app`. (`pepscore.vercel.app` is a dead alias — confirmed 404, must never be used as a fallback anywhere; this was the root cause of two separate bugs fixed this session.)
- **Shared backend/database** — one Neon Postgres database, shared across local dev, Preview, and Production. No separate databases per environment.
- **Stripe** — checkout creates an `Order`+`Invoice` pair atomically (`app/api/checkout/route.ts`); this pattern is confirmed working and is the one the roadmap says to keep, not replace.
- **Shippo** — `lib/shippo.ts`, `getRates()`/`purchaseLabel()`; used today only post-purchase for fulfillment labels. Real pre-checkout rate quoting is the **next** Phase 2B task, not yet built.
- **Resend** — invoice-issued and payment-received emails; also the admin intake-notification channel from Phase 2A.
- **Google Workspace** — `orders@`/`billing@`/`support@`/`contact@`/`admin@pepscorelab.com` identities, referenced by both frontends' contact surfaces.
- **Clerk** — single Clerk application shared by admin login and storefront customer accounts; `ADMIN_CLERK_USER_ID` env var designates the one admin user. Publishable key is a `pk_test_...` (development instance) — Cloudflare Turnstile bot-check appears on sign-up in this environment.
- **Prisma** — schema-sync via `db:push` (no formal migration history yet — a known, explicitly-deferred Phase 2G item). Client regenerated after every schema change; on Windows this requires stopping any running `next dev` process first (file lock on the query engine DLL).
- **Neon** — the Postgres host for the one shared database above.
- **Vercel** — team `compscigrads-projects`; three projects total (`pepscore`, `pepscore-landing`, and the unrelated `ao-ai-solutions` — explicitly out of scope for Pepscore work per standing instruction). PR-based Preview deployments are this repo's established acceptance-test environment before merge.

## 5. Database State

Schema changes completed this session (all additive, applied directly to the shared database, already confirmed live in Neon):

```sql
ALTER TABLE "Customer" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- `Customer.userId` — nullable, unique. Every existing `Customer` row (admin-entered or intake-submitted) keeps `userId = null` — verified zero rows were affected.
- The unique constraint enforces "one User can never be linked to more than one Customer" at the database level, not just in application logic.
- `ON DELETE SET NULL` matches the existing convention used by every other optional `User` relation in this schema (`Order.user`, `ComplianceAcknowledgment.user`) — deleting a `User` can never cascade into deleting `Customer`, `Invoice`, `Order`, `Payment`, `IntakeLink`, or `Shipment` history.
- **Pre-application inspection** (read-only, via a temporary `tsx` script, deleted afterward — never committed): 0 `User` rows, 1 `Customer` row, 0 duplicate emails on either side, 0 ambiguous cross-matches. Completely clean slate — this schema change carried zero migration risk.
- **No pending schema work** beyond this task. The next Phase 2B task (shipping estimates) needs no new schema — it's a new route calling the existing `lib/shippo.ts`.

## 6. Environment Status

**`.env.local` is intentionally not stored in Git** (gitignored) and contains live secrets (database URLs, Clerk/Stripe/Resend/Shippo keys). It must be restored securely from Vercel's Environment Variables settings (or another approved secret-management source) before running the local dev server or any local script that touches the database — never by copying values into this or any other doc.

| Variable | Project/Scope | Status |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `pepscore` — Production | Fixed this session: `pepscore.vercel.app` (dead) → `pepscore-compscigrads-projects.vercel.app`. Verified live. |
| `NEXT_PUBLIC_APP_URL` | `pepscore` — Development | Same fix applied. Verified. |
| `NEXT_PUBLIC_APP_URL` | `pepscore` — Preview | **No value set** — reported, not changed blindly, per your explicit instruction. Still an open item; no decision made yet on what (if anything) it should be. |
| `NEXT_PUBLIC_APP_URL` | `pepscore/.env.local` | Fixed to match Production. Dev server restarted after the change (twice this session — once for the URL fix, once for the Prisma Client regeneration). |
| `NEXT_PUBLIC_ADMIN_APP_URL` fallback | `pepscore-landing` (code, not an env var — no such var is set in that project) | Fixed: hardcoded fallback in `LandingFooter.tsx` corrected to the live app URL. |
| `DATABASE_URL` / `DIRECT_URL` | Shared, all environments | Unchanged, confirmed working (same Neon instance used for every inspection/migration this session). |

**Production vs. Development differences**: Preview and Production share the same database (by design — see Section 4), so data created against a Preview deployment (like the test Clerk account being created right now) lands in the same shared Customer/User tables as Production. This is expected and matches how Phase 2A's acceptance testing worked.

## 7. Remaining Work (ordered)

1. **Finish the paused acceptance test** (see Section 3) — human-assisted guide-mode walkthrough past Cloudflare Turnstile → Clerk OTP (`424242`) → `/account` → verify Clerk `User` creation, `Customer` linking, no duplicates, idempotency, intake-only customer unaffected, page renders correctly.
   - *Dependencies*: none — this is the very next step.
   - *Acceptance criteria*: all 7 checks in Section 3's "what still remains" pass.
2. **Merge PR #42** once the acceptance test passes.
   - *Files affected*: none new — this is a merge action.
   - *Dependencies*: Task 1 complete.
   - *Acceptance criteria*: `master` includes the identity-link change; Production redeploys automatically; a quick post-merge smoke check that `/admin/invoices` and `/account` both still load on Production.
3. **Phase 2B, Task 2 — Real shipping estimates before checkout** (the roadmap's named blocker: `app/api/checkout/route.ts:70` hardcodes `shippingCost` to `$0`).
   - *Purpose*: call `lib/shippo.ts`'s existing `getRates()` pre-payment instead of only after a label is purchased.
   - *Files likely affected*: new rate-limited API route (mirroring `app/api/intake/[token]/zip-lookup/route.ts`'s public-but-guarded pattern), `app/checkout/page.tsx` (new UI step to show/select a rate), `app/api/checkout/route.ts` (use the selected real rate instead of `0`).
   - *Dependencies*: needs `FulfillmentSettings.returnAddress` (already exists) as the ship-from address, and either `FulfillmentSettings`'s default parcel dimensions or a `PackagePreset` as the parcel — **no per-product weight/dimension field exists yet**, which is a real, small gap to resolve as part of scoping this task (not before it).
   - *Acceptance criteria*: a real checkout on Preview shows a non-hardcoded, Shippo-sourced shipping cost before payment; existing free-shipping-over-$150 logic still works; `tsc`/`eslint`/`vitest`/`next build` clean; verified with a real (or realistic scratch) cart on a Preview deployment.
4. **Phase 2B remaining MVP items** (catalog filter/search UI, product detail pages, coupon codes at checkout) — not yet scoped in task-level detail; scope each individually when its turn comes, per the roadmap.
5. **Phase 2C MVP** (`/admin/customers` page) — cheap relative to 2B/2D, can run in parallel with the tail end of 2B per roadmap sequencing.

## 8. Known Issues

- **`NEXT_PUBLIC_APP_URL` unset for `pepscore`'s Preview environment** — reported, not fixed; no decision made on what it should be (Preview URLs are dynamic per-PR, unlike Production's stable alias).
- **No per-product weight/dimension field** on the `Product` model — will need resolving as part of the shipping-estimate task (Section 7, Task 3), likely via `FulfillmentSettings`'s default parcel or a `PackagePreset` rather than a new per-product field, but not yet decided.
- **No formal Prisma migration history** — `db:push` has been the only schema-sync method since commit one (explicitly deferred, Phase 2G, "not because anything is currently broken").
- **Test data awaiting cleanup, left in place on purpose**:
  - `PS-2026-000010` and `PS-2026-000011` invoices — in recoverable Trash, **do not permanently purge** until your next production-cleanup review confirms no records/events/relationships are needed for troubleshooting.
  - The in-progress `phase2b-acceptance-test+clerk_test@pepscorelab.com` Clerk `User` + its linked `Customer` — will need cleanup once the acceptance test is verified.
- **`app/checkout/page.tsx:34`** — pre-existing `'clearCart' is assigned a value but never used` ESLint warning, unrelated to any work this session touched. Low priority, noted for awareness only.
- **API routes return raw `err.message` to the client on failure** (pre-existing, noted in `docs/TODO.md` — worth tightening to generic messages + server-side logging as the admin surface grows, not urgent).

## 9. Recovery Instructions

If this session is lost, paste this into a new Claude Code terminal session in `C:\Users\micha\pepscore`:

> Read `docs/HANDOFF.md` in this repo — it's a checkpoint from a session that was implementing Phase 2B of the roadmap in `docs/ProductRoadmap.md`. We're on branch `feature/customer-user-identity-link`, PR #42 is open with the `Customer.userId` identity-link change (schema already applied to the shared production database, code complete, fully tested, Preview deployment green). The real signed-in acceptance test was paused mid-flight at a Cloudflare Turnstile human-verification step during Clerk sign-up on the Preview URL. Resume exactly where Section 3 of the handoff doc leaves off: walk me through the rest of the Clerk sign-up in guide mode (one step at a time, since a CAPTCHA needs a human), then verify the acceptance criteria listed there, then merge PR #42, then propose the next Phase 2B task (real shipping estimates before checkout — already scoped in Section 7 of the handoff doc). Don't re-investigate anything already confirmed in the handoff doc — treat it as ground truth unless you find it's stale, in which case tell me what changed.

## 10. Repository Health

- **Git status**: clean working tree (only the pre-existing, unrelated `byc-form-index.html` untracked file — leave it alone).
- **Branch status**: `feature/customer-user-identity-link` is fully pushed, up to date with `origin`, no divergence.
- **Safe to stop now**: **Yes.** Nothing uncommitted, nothing partially written to disk, the schema change is already durably applied to the database (not just staged), and the paused acceptance test left no partial/broken state — the test Clerk sign-up simply hasn't completed yet, which is harmless to leave as-is.
- **Commands to run before resuming**: none strictly required. If picking back up in a new terminal window, the local dev server will need restarting (`npm run dev`) since it only exists in this session's process list; nothing else needs to be re-run (Prisma Client is already regenerated and committed-schema-consistent).

---

## Executive Summary

Pepscore's Phase 2A (Customer Intake Workflow) is fully complete and production-validated as of this session — the broken-domain bug that blocked it is fixed in both the `pepscore` and `pepscore-landing` projects, and a real end-to-end intake submission was verified against production. Phase 2B (Customer Storefront) is now underway; its first required task — resolving the `User`/`Customer` identity split via a new, additive `Customer.userId` link — is fully implemented, tested (123/123 passing, clean `tsc`/`eslint`/`build`), and sitting in an open, green-checked PR (#42) on a dedicated branch, with its schema change already safely applied to the shared production database. The only remaining step before merging is a real signed-in acceptance test, which is paused mid-flight at a Cloudflare Turnstile check during Clerk sign-up on the PR's Preview deployment — a step that requires a human, not Claude, to complete. The next development session should pick up in guide mode exactly there: finish the Clerk sign-up (Turnstile, then OTP `424242`), verify the seven acceptance checks listed in Section 3, merge PR #42, and then move to Phase 2B's next task — building real pre-checkout shipping estimates via the already-existing `lib/shippo.ts`, which is fully scoped and ready to start in Section 7.
