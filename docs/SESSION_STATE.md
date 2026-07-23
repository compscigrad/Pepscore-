# Session State Snapshot

A five-minute read for a new Claude instance (or a human) to understand where Pepscore stands right now. Detail and reasoning live in `docs/HANDOFF.md`; this file is the compressed version.

## Architecture

- **Two Vercel projects, one platform**: `pepscore-landing` (owns `pepscorelab.com`, static marketing site) and `pepscore` (the operational app — admin, storefront, invoices, fulfillment; zero custom domains, reachable at `pepscore-compscigrads-projects.vercel.app`). This split is deliberate and permanent, not a pending cutover.
- **One shared Neon Postgres database** across local dev, Preview, and Production — no per-environment data isolation.
- **Stripe** for payment (`Order`+`Invoice` pair created together at checkout), **Shippo** for shipping labels/rates, **Resend** for transactional email, **Clerk** for auth (one app, shared by admin login and storefront customers), **Prisma** via `db:push` (no formal migration history yet).

## Completed Milestones

- Foundation: Invoice System, Fulfillment Workflow v1, Carrier-Agnostic Tracking — all previously shipped and judged stable enough to build on.
- **Phase 2A (Customer Intake Workflow)** — complete and production-validated this session. Fixed a broken-domain bug (`pepscore.vercel.app`, a dead alias) across both Vercel projects, then ran one full real intake submission end-to-end against production and confirmed it correctly created/updated the customer and invoice records.
- **Phase 2B, Task 1 (`Customer.userId` identity link)** — code complete, fully tested (123/123 `vitest`, clean `tsc`/`eslint`/`next build`), schema already applied to the shared production database, branch pushed, PR #42 open with a green Preview deployment.

## Pending Milestones

- Finish PR #42's acceptance test (paused — see "Open Risks" below) and merge it.
- Phase 2B remaining tasks: real pre-checkout shipping estimates (next up, fully scoped), product catalog filter/search, product detail pages, checkout coupon codes.
- Phase 2C (`/admin/customers` UI), 2D (inventory), 2E (automation), 2F (analytics), 2G's later items (2FA, roles, formal migrations) — all not started, correctly sequenced for later per `docs/ProductRoadmap.md`.

## Database State

- `Customer.userId` — new, nullable, unique column with an `ON DELETE SET NULL` foreign key to `User.id`. Applied directly to the shared database this session; confirmed additive-only, zero pre-existing conflicts (0 Users, 1 Customer, no duplicate/ambiguous emails at inspection time).
- No other pending schema work.

## Environment Configuration Status

- **`.env.local` is intentionally not stored in Git** (gitignored) — it holds live secrets (database URLs, Clerk/Stripe/Resend/Shippo keys) and must be restored securely from Vercel's Environment Variables settings, or another approved secret-management source, before running the local dev server or any local script. No environment-variable values, keys, passwords, or tokens are ever copied into this or any other recovery document.
- `NEXT_PUBLIC_APP_URL` — fixed this session in `pepscore`'s Production and Development scopes, and in `.env.local`, all now pointing to the correct live app URL (previously pointed at a dead `pepscore.vercel.app` alias — the root cause of two separate bugs fixed this session, one in `pepscore` and one in `pepscore-landing`'s footer fallback).
- `NEXT_PUBLIC_APP_URL` for `pepscore`'s **Preview** scope remains unset — reported, intentionally not changed without your explicit decision.
- All other env vars (Stripe, Shippo, Resend, Clerk, database URLs) unchanged and confirmed working throughout this session's testing.

## Deployment Status

- `pepscore-landing` Production — deployed, verified live, footer fix confirmed working.
- `pepscore` Production — live at `pepscore-compscigrads-projects.vercel.app`, running the code from before PR #42 (the identity-link change has not merged yet).
- `pepscore` Preview for PR #42 — deployed, Ready, at `pepscore-git-feature-customer-user-32a4dc-compscigrads-projects.vercel.app`.
- Local dev server — was running via `npm run dev` at the end of this session (restarted after a Prisma Client regeneration mid-session); will need restarting in a fresh terminal.

## Open Risks

- **PR #42's acceptance test is mid-flight**, paused at a Cloudflare Turnstile "verify you are human" check during Clerk sign-up on the Preview deployment — this specifically requires a human to click through; Claude cannot complete CAPTCHAs. No code risk here, just an unfinished verification step.
- **No per-product weight/dimension field** exists yet on the `Product` model — will need a decision (new field vs. reuse `FulfillmentSettings`'s default parcel / a `PackagePreset`) as part of scoping the next task (shipping estimates), not before it.
- Test data intentionally left in place, not yet cleaned up: invoices `PS-2026-000010`/`PS-2026-000011` (recoverable Trash, awaiting your production-cleanup review before permanent deletion) and the in-progress test Clerk account `phase2b-acceptance-test+clerk_test@pepscorelab.com`.

## Open Decisions

- What (if anything) `NEXT_PUBLIC_APP_URL` should be set to for `pepscore`'s Preview environment.
- Whether `pepscorelab.com` ever points at the application, whether the app gets its own subdomain, or both frontends coexist indefinitely — explicitly deferred in `docs/ProductRoadmap.md`, not to be decided speculatively.
- How to source parcel weight/dimensions for the upcoming shipping-estimate feature (see "Open Risks" above).
