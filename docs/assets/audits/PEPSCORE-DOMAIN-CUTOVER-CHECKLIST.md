# Pepscore Domain Cutover Checklist

Status as of 2026-08-18 (updated post-AOAI-transfer, soft-launch sprint):
**staging / readiness only**. `pepscorelab.com` and `www.pepscorelab.com`
remain on the `pepscore-landing` coming-soon project. The full application
is healthy and reachable only at `https://pepscore-aoai.vercel.app` — the
`pepscore` project was transferred from `compscigrad's projects` (Hobby) to
the owner's `AOAI` team (Pro, for AI Gateway ZDR support) later on
2026-08-18; its old auto-generated domain
(`pepscore-compscigrads-projects.vercel.app`) is now a frozen, stale alias
that stopped tracking new Production deployments at transfer time — do not
use it for anything, including this checklist. Nothing on this checklist
has been applied yet — this document tracks what must be true before the
owner says "cut over the domain," and what happens, in order, once they do.

Full findings and rationale behind each item live in
`docs/assets/audits/2026-08-18-domain-cutover-audit.md` (DNS records, current
config, indexing status) — written pre-transfer, so its domain references
are similarly stale; treat this checklist as the current source for the
testing-domain value. This file is the actionable checklist; that one is
supporting evidence for the DNS/SEO items only.

## PRE-LAUNCH BUSINESS

- [ ] LLC formed
- [ ] Business bank account open
- [ ] Payment settlement bank linked (Stripe payout destination)
- [ ] Shippo finalized (carrier accounts, label settings)
- [ ] Shipping workflow tested end-to-end
- [ ] Production email verified (Resend sending from real `@pepscorelab.com` addresses — DNS already confirmed correct, confirm actual delivery test)

## APPLICATION

- [x] Admin review complete — 2026-08-18 soft-launch sprint: dashboard, customers, fulfillment command center, payment settings all verified live against real production data, working correctly
- [x] Catalog review complete — 2026-08-18: full data-integrity audit (duplicates, images, pricing, named-identity spot-checks, sitemap/catalog agreement) — all clean, see `docs/launch/PEPSCORE-SOFT-LAUNCH-READINESS.md`
- [x] Storefront review complete — 2026-08-18: landing → search → category → product → cart verified live, checkout gate shows a clean "Coming Soon" state (not an error)
- [ ] Mobile review complete — code-level verified only (hamburger breakpoint, dated mobile-nav fix); a live mobile-viewport browser check was not possible this session (tooling limitation, not a product gap)
- [ ] Checkout test complete (real payment method, not just build/smoke test) — blocked: `STOREFRONT_CHECKOUT_ENABLED` is intentionally unset (checkout dark) pending live Stripe activation, see `docs/PendingOwnerActions.md` item 1
- [x] Intake workflow complete — verified in code (Phase 1 audit): link validation, DRAFT/issued branching, RUO modal, payment selection/arrangement
- [x] Portal invite workflow complete — verified in code: heavily safety-gated cron + admin rollout page, real eligibility computation
- [x] Auth complete — sign-in/sign-up/session behavior verified in code (Clerk middleware, RUO signup gate); see `docs/PendingOwnerActions.md` items 11 and 26 for two related owner-only Clerk Dashboard confirmations
- [ ] Production environment variables complete — `NEXT_PUBLIC_APP_URL` corrected 2026-08-18 to the current testing domain (see below); still needs one more flip at actual cutover time

## DOMAIN

- [ ] Clerk allowed origins verified (see Clerk checklist below — not yet confirmed, dashboard access required)
- [x] `NEXT_PUBLIC_APP_URL` corrected 2026-08-18 to the current, correct testing domain: `https://pepscore-aoai.vercel.app` (was still pointing at the frozen pre-transfer domain). Still needs the real cutover flip when the owner approves: `https://pepscore-aoai.vercel.app` → `https://www.pepscorelab.com`
- [ ] Both Vercel domains (`pepscorelab.com`, `www.pepscorelab.com`) ready to reassign — now FROM `pepscore-landing` TO the `pepscore` project under the **AOAI** team (not `compscigrad's projects` — the project transferred 2026-08-18)
- [ ] Email DNS backed up/verified (8 records catalogued in the audit doc — MX/SPF/DKIM/DMARC for Google Workspace inbound, MX/SPF/DKIM for Resend/SES outbound on `send.` subdomain, plus Google site-verification TXT)
- [ ] `pepscore-landing` rollback deployment ID recorded immediately before cutover (grab it fresh at cutover time — the one referenced in the audit doc will be stale by then)

## SEO

- [ ] Canonical URLs ready (code already reads `NEXT_PUBLIC_APP_URL`; no code change needed, only the env var)
- [ ] Sitemap ready (`app/sitemap.ts` already generates from `NEXT_PUBLIC_APP_URL`)
- [ ] Robots ready (`app/robots.ts` already generates from `NEXT_PUBLIC_APP_URL`)
- [ ] Open Graph ready (`lib/storefront/structuredData.ts`, same pattern)
- [ ] Search Console plan ready (submit `https://www.pepscorelab.com/sitemap.xml` after cutover; do not submit the `.vercel.app` alias — it's already `X-Robots-Tag: noindex` at the platform level and should stay unsubmitted)

## POST-CUTOVER VERIFICATION

- [ ] HTTPS certificate issues cleanly on both `pepscorelab.com` and `www.pepscorelab.com`
- [ ] Redirect: `pepscorelab.com` → `https://www.pepscorelab.com` (301/308, not the current 307)
- [ ] Sign-in / sign-up flow works on the live domain (Clerk redirect correctness)
- [ ] Checkout completes, success/cancel redirects land on `www.pepscorelab.com`
- [ ] Customer intake link generates and opens correctly with the new domain
- [ ] Portal invite email link opens correctly with the new domain
- [ ] `sitemap.xml` shows `www.pepscorelab.com` URLs
- [ ] `robots.txt` Sitemap reference shows `www.pepscorelab.com`
- [ ] Canonical `<link>` tag shows `www.pepscorelab.com`
- [ ] OG tags (`og:url`, `og:image`) show `www.pepscorelab.com`
- [ ] Email DNS unchanged (re-run the same MX/SPF/DKIM/DMARC checks from the audit doc, confirm identical)
- [ ] Mobile rendering verified on the live domain
- [ ] Rollback path re-confirmed working (reassign domains back to `pepscore-landing`, revert `NEXT_PUBLIC_APP_URL`, redeploy) — verify this actually works *before* cutover, not just document it
