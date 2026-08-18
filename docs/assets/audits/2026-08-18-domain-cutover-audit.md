# Domain Cutover Audit (read-only) — 2026-08-18

Evidence behind `PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md`. No domain, DNS, or
environment-variable changes were made while gathering this — every finding
below was captured via `nslookup`, live HTTP requests to the production
Vercel alias, and Vercel's own project/deployment API.

## Current ownership

`pepscorelab.com` and `www.pepscorelab.com` are attached to the
`pepscore-landing` Vercel project (`prj_UIcyuNUdDer6jIVmB50IagNLhpNY`) — a
separate, static, single-page "Launching Fall 2026" coming-soon site. The
full application (`pepscore`, `prj_Rp3UM8ZJS6pI4kQvfSR43JSYbC2X`) has no
custom domain attached; it's reachable only at
`https://pepscore-compscigrads-projects.vercel.app`.

## DNS (zone is fully delegated to `ns1.vercel-dns.com`)

| Record | Value |
|---|---|
| `pepscorelab.com` A | `64.29.17.65` |
| `www.pepscorelab.com` A | `64.29.17.65`, `216.198.79.1` |
| `pepscorelab.com` → | 307 redirect to `https://www.pepscorelab.com/` (www is canonical today) |
| MX (apex) | `smtp.google.com` — Google Workspace inbound |
| SPF (apex) | `v=spf1 include:_spf.google.com ~all` |
| DKIM (apex) | `google._domainkey.pepscorelab.com` |
| DMARC | `_dmarc.pepscorelab.com` → `v=DMARC1; p=none; rua=mailto:dmarc@pepscorelab.com; fo=1; pct=100` |
| Site verification TXT | `google-site-verification=sgBrOJjmeh8vil05El3AS8gqZR6LlUkO00aH_Hx-3YU` |
| MX (`send.` subdomain) | `feedback-smtp.us-east-1.amazonses.com` — Resend/SES outbound bounce handling |
| SPF (`send.` subdomain) | `v=spf1 include:amazonses.com ~all` |
| DKIM (Resend) | `resend._domainkey.pepscorelab.com` |

All of these are zone-level records, independent of which Vercel *project*
owns the apex/www routing — reassigning the domain between projects should
not touch them, but this must be confirmed directly in Vercel's domain
settings at cutover time, not assumed from this audit alone.

No Clerk custom-domain DNS records exist (`clerk.`, `accounts.`, `clkmail.`
subdomains all checked, none present) — Clerk is on its default hosted
domain today. Its allowed-origins/redirect-URL allowlist lives in the Clerk
Dashboard, not DNS or code, and was **not** verified as part of this audit —
dashboard access is required (see checklist).

## Application config currently tied to the alias

Confirmed by reading live production output, not by guessing from source:

```
robots.txt Sitemap:  https://pepscore-compscigrads-projects.vercel.app/sitemap.xml
sitemap.xml <loc>:   https://pepscore-compscigrads-projects.vercel.app (113 URLs total)
og:url:              https://pepscore-compscigrads-projects.vercel.app
og:image:            https://pepscore-compscigrads-projects.vercel.app/images/...
canonical:            https://pepscore-compscigrads-projects.vercel.app
```

All four are driven by a single source: `NEXT_PUBLIC_APP_URL`, currently set
in the `pepscore` project's production environment to
`https://pepscore-compscigrads-projects.vercel.app`. It also drives:

- Checkout success/cancel redirect URLs (`app/api/checkout/route.ts`)
- Customer intake links (`app/api/admin/invoices/[id]/intake-link/route.ts`)
- Portal invite links (`lib/portalInvites.ts`)

**At cutover, the only required change is**: `NEXT_PUBLIC_APP_URL` →
`https://www.pepscorelab.com`, followed by a redeploy (it's a
`NEXT_PUBLIC_` variable, inlined at build time — updating it in the
dashboard alone does not retroactively change already-built pages).

Aside, not blocking: the fallback defaults for this same variable are
inconsistent across files if it's ever left unset entirely (`layout.tsx` →
`pepscorelab.com`, `checkout/route.ts` → `localhost:3000`, `sitemap.ts` /
`robots.ts` / `structuredData.ts` → the `.vercel.app` alias, intake-link /
portal-invites → empty string). Harmless today since the real env var is
always set, but worth a cleanup pass at some point so a missing env var
can't silently produce a `localhost` checkout link in production.

## Indexing / SEO staging status

The alias is already protected from indexing at the platform level:

```
X-Robots-Tag: noindex     (confirmed on homepage AND product detail pages)
```

This is Vercel's automatic behavior for a project's non-primary-domain
aliases — it overrides the app's own `robots.txt` (`Allow: /`) and 113-URL
`sitemap.xml`, both of which are unaware of domain status and would
otherwise look indexable to a crawler. Well-behaved crawlers (Google
included) respect the HTTP header over the file. **No code change is
needed to keep the alias out of search results** — it already is.

Recommended staging approach: do nothing. Do not submit the `.vercel.app`
sitemap to Search Console. At cutover, re-verify that `X-Robots-Tag:
noindex` stops appearing once `www.pepscorelab.com` becomes the project's
primary domain (expected Vercel behavior, but confirm rather than assume,
per the checklist's post-cutover verification list).

## What's lost from `pepscore-landing` at cutover

Its only live content is the single coming-soon homepage (title
"Pepscore Lab — Precision Peptide Solutions | Launching Fall 2026"). Every
other path already 404s. The project itself is not deleted by a domain
reassignment and stays available as a rollback target.

## Rollback

Domain reassignment in Vercel is a fast, DNS-transparent operation (the
zone already points at Vercel's anycast IPs on both hostnames — no
registrar/nameserver change either direction). Rollback is: reattach both
hostnames to `pepscore-landing`, revert `NEXT_PUBLIC_APP_URL` on `pepscore`
to the `.vercel.app` alias, redeploy. `pepscore-landing`'s deployment is
untouched throughout and can serve immediately.
