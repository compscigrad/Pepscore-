# Pepscore Domain Cutover Checklist

Status as of 2026-08-18: **staging / readiness only**. `pepscorelab.com` and
`www.pepscorelab.com` remain on the `pepscore-landing` coming-soon project.
The full application is healthy and reachable only at
`https://pepscore-compscigrads-projects.vercel.app`, for private owner
testing. Nothing on this checklist has been applied yet — this document
tracks what must be true before the owner says "cut over the domain," and
what happens, in order, once they do.

Full findings and rationale behind each item live in
`docs/assets/audits/2026-08-18-domain-cutover-audit.md` (DNS records, current
config, indexing status). This file is the actionable checklist; that one is
the evidence.

## PRE-LAUNCH BUSINESS

- [ ] LLC formed
- [ ] Business bank account open
- [ ] Payment settlement bank linked (Stripe payout destination)
- [ ] Shippo finalized (carrier accounts, label settings)
- [ ] Shipping workflow tested end-to-end
- [ ] Production email verified (Resend sending from real `@pepscorelab.com` addresses — DNS already confirmed correct, confirm actual delivery test)

## APPLICATION

- [ ] Admin review complete
- [ ] Catalog review complete
- [ ] Storefront review complete
- [ ] Mobile review complete
- [ ] Checkout test complete (real payment method, not just build/smoke test)
- [ ] Intake workflow complete
- [ ] Portal invite workflow complete
- [ ] Auth complete (sign-in/sign-up/session behavior verified end-to-end)
- [ ] Production environment variables complete (see DOMAIN section below for the one still pending: `NEXT_PUBLIC_APP_URL`)

## DOMAIN

- [ ] Clerk allowed origins verified (see Clerk checklist below — not yet confirmed, dashboard access required)
- [ ] `NEXT_PUBLIC_APP_URL` ready to flip: `https://pepscore-compscigrads-projects.vercel.app` → `https://www.pepscorelab.com` (documented, not applied)
- [ ] Both Vercel domains (`pepscorelab.com`, `www.pepscorelab.com`) ready to reassign from `pepscore-landing` to `pepscore`
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
