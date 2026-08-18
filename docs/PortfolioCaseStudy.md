# Pepscore Lab — Portfolio Case Study

**A production back-office and e-commerce platform, built through owner-directed, AI-assisted engineering.**

This is the external-safe companion to `docs/CaseStudy.md`, this project's full internal engineering case study. It is written for a professional portfolio audience and omits anything from the internal document that would expose secrets, customer or supplier identity, credential handling detail, or regulated-product operational specifics not relevant to demonstrating engineering capability. Every number below was measured directly against this repository at the time this document was written — none are estimates. Where the internal document has more depth on a topic, this document says so rather than padding with invented detail.

This is not a tutorial project or a portfolio demo built to look impressive. It is a real, in-production operations platform for a research-supplier business, with a real (if intentionally staged) revenue channel, real customers, and real production incidents that were found and fixed before they became customer-facing failures.

---

## What it is

Pepscore Lab is a peptide-research-supplier e-commerce and back-office platform: a public storefront, and — the larger and more mature half of the system — an internal operations engine that turns every sale, whether it comes through the storefront or is arranged manually by the owner, into one trackable, invoiced, fulfillable record. On top of that operational core sits a full customer portal, a financial reporting and tax-preparation center, and a from-scratch first-party AI research-assistant subsystem, built dark and activated in careful, individually-verified stages.

**Stack**: Next.js 16 (App Router), TypeScript, Prisma ORM over Neon Postgres, Clerk (authentication), Stripe (payments), Shippo (shipping/tracking), Resend (transactional email), Twilio (SMS), Vercel AI Gateway (model routing), Tailwind CSS, Vitest (testing). Deployed on Vercel.

---

## Engineering evidence, measured

| Metric | Value | How it was measured |
|---|---|---|
| Commits shipped to the main branch | 303 | `git log --oneline \| wc -l`, run directly against the repository |
| Automated tests passing | 1,401, across 128 test files | `npx vitest run`, executed directly against the repository |
| Test-suite growth over the period covered by this backfill | 626 → 1,401 tests (more than doubled) | Prior case-study revision's recorded count vs. current measured count |
| Database models | 67 | `grep -c "^model " prisma/schema.prisma` |
| API routes | 112 total, 76 of them admin-authenticated | Direct file count under `app/api/**` |
| Admin-authenticated pages | 29, all covered by an automated route/page auth-coverage regression test | Direct file count under `app/admin/**`; verified by the two coverage test suites themselves |
| Third-party integrations | 7 (authentication, payments, shipping/tracking, transactional email, SMS, address lookup, and an AI model gateway) | Direct code audit |
| Scheduled automation jobs | 6 registered, 1 additional built and safety-gated but not yet enabled | `vercel.json` |
| Architecture decision log entries | 74, each with a documented decision, reasoning, alternatives considered, benefits, and drawbacks | `docs/Decisions.md` |
| Time span covered | Roughly 5.5 months of continuous, owner-directed development | First commit to most recent commit at the time of writing |

None of these numbers are projected or rounded up — they are the literal output of running the measurement commands against the current state of the repository.

---

## Architecture layers

The system is organized into distinct, independently-testable layers, each with its own clear responsibility boundary enforced by convention and, in several cases, by an automated regression test:

- **Storefront** — public catalog, product detail, search (predictive autocomplete), category browsing, checkout (staged, not yet publicly activated), SEO (sitemap, structured data, canonical/Open Graph metadata).
- **Customer Portal** — authenticated customer-facing account area: invoices, payments, fulfillment tracking, correspondence history, saved profile, order history, reorder ("Buy Again").
- **Admin Operating System** — a full internal back office covering sales (both manual/invoiced and storefront-originated), customer relationship management, catalog and pricing management, fulfillment, financial reporting, and system settings, unified under one unified navigation shell.
- **Commerce & Payments** — a provider-abstraction pattern (one interface, swappable real implementations) covering both payments and shipping, so that adding or replacing a provider never touches UI, webhook, or scheduled-job code.
- **Fulfillment** — carrier-agnostic shipment tracking, a centralized fulfillment-eligibility gate, and real label-purchase integration (currently held behind an intentional pre-activation safety switch pending third-party account review, unrelated to any code readiness question).
- **Financial Reporting & Tax Preparation** — a ledger, ledger reconciliation, profit-and-loss reporting, and accountant-ready export system built entirely as a read layer over the platform's own transactional records, with zero duplicated money calculations anywhere in the system.
- **First-Party AI Research Assistant** — a from-scratch, provider-agnostic AI subsystem (see below) with its own policy, safety, retrieval, and observability layers, built and dark-deployed independently of the storefront/admin/checkout code paths.
- **Authentication & Authorization** — session authentication via a managed identity provider, with a centralized, database-backed role-authorization layer covering every administrative surface.
- **Automation** — scheduled background jobs for archival, tracking synchronization, reminder delivery, and reservation cleanup, each independently kill-switched.
- **Deployment & Infrastructure** — CI/CD via Git-integrated deployments, environment-scoped configuration, and a documented separation between the public marketing site and the operational application.

---

## Engineering discipline, demonstrated repeatedly

A few patterns recur throughout this project's history, each verifiable in the commit record rather than asserted:

**Audit before building.** Several of the highest-value fixes in this project were found by auditing existing behavior before writing new code, not by executing a feature request literally. This habit caught, among others, a payment-webhook handler silently dropping refund events, a storefront checkout path with no inventory reservation at all, and — most recently — a revenue-reporting query that was including archived test data in a real financial figure (see "A defect worth naming" below).

**Provider abstraction reused, not reinvented.** A single interface pattern for swapping external providers was built once for shipping, then explicitly reused for the payment integration months later, and reused a third time for the AI model-routing layer — one architectural investment paying off three separate times rather than being redesigned per integration.

**Derive, don't store, whenever a value could drift.** Computed payment status, a derived "primary" shipment rather than a stored pointer, live-recomputed portal eligibility, and continuously-aggregated AI usage/compliance dashboards all reflect the same underlying principle: a stored value can silently disagree with reality; a pure function over current data cannot.

**Fail-closed by default.** Every feature capable of moving real money, sending real bulk communication, or making a real external API call is gated behind an independent, explicit activation switch that defaults to off — verified, not merely documented, via dedicated regression tests confirming that disabled paths make zero network calls and every enabled path is independently switchable from every other.

**Dark deployment for high-risk capability.** The most complex single body of work in this project — a first-party AI research assistant — was built, fully tested, and deployed to production in more than twenty-five separate, individually-verified increments, entirely inaccessible to any real customer until each layer (policy engine, retrieval, provider routing, live-model credentialing) was independently proven safe. Public activation remains a deliberate, separate decision the system is structurally incapable of making on its own.

---

## A defect worth naming

Not every engineering story in this project is a clean success — some of the most valuable moments were catching a real problem before it reached a customer or a real business decision:

A financial-reporting sprint building out a profit-and-loss dashboard found that a set of test/rehearsal invoices, generated during earlier development and later filed away through the application's normal archive workflow, were still being counted in a headline revenue figure. Archiving an invoice in this system is a workflow action (it changes what a list shows an operator), not a data-provenance fact (it does not mean "this was never a real sale") — and until this sprint, nothing in the system distinguished the two. The fix added an explicit, narrowly-applied "this is not real data" flag, backfilled only against the exact records confirmed to be test artifacts (never a pattern match that could accidentally catch a real future record), and corrected the reported revenue figure by roughly 22% — a number the owner would otherwise have used for real business planning. Both the reporting bug and the fix are documented in detail in the internal case study, since this is exactly the kind of pre-launch data-integrity issue worth catching before a business starts making decisions on top of it.

A second defect worth naming from a UX/reliability angle: a live-verification pass on the mobile navigation menu found every menu item was unresponsive on first tap. Root-causing it (rather than patching around the symptom) revealed a genuine event-ordering race — an outside-click handler scoped too broadly was unmounting the entire menu on `mousedown`, before the browser's subsequent `click` event could ever reach the tapped link. The fix narrowed the handler's scope and shipped with a regression test built specifically to exercise real browser event timing (a synthetic click alone could not reproduce the bug), confirmed to fail against the old code before being restored to guard the fix.

A third: live-verifying a first-party AI research assistant's answers against the company's own catalog found that a natural-language question could return an apparently-correct answer while the system's own retrieval log showed zero data had actually been retrieved from the real catalog — meaning the model was answering from general training knowledge, not grounded company data, despite a citation architecture existing specifically to prevent that. Tracing the retrieval call (rather than assuming a prompting or model problem) found the reused search-matching function was correct for its original purpose (exact product-name lookup) but structurally unable to handle open-ended natural-language phrasing. The fix added a narrowly-scoped, catalog-grounded fallback specifically for that failure mode, verified by a true end-to-end pipeline test exercising the real retrieval component rather than a stub.

---

## What's real vs. what's intentionally staged

In the spirit of this being a genuine production system rather than a demo, it's worth being explicit about what's actually live versus deliberately held back pending a business decision:

**Live and in active use**: invoicing, payment-arrangement scheduling, carrier-agnostic shipment tracking, the CRM/customer layer, the customer portal, catalog and pricing management, the financial reporting and tax-preparation center, and the admin operating system as a whole. The business's real, current sales channel — direct/manual invoicing — is fully operational, with a real, audited revenue figure on record.

**Engineering-complete, activation deliberately pending an explicit business decision**: real storefront checkout (currently shows a clean, intentional "coming soon" state rather than a broken flow), real bulk SMS communication, and public access to the AI research assistant. Each of these is fully built, fully tested, and independently switchable — the code is not what's blocking them; a deliberate business/compliance decision is.

This distinction — engineering-complete versus business-activated — is tracked explicitly throughout the project's own documentation, and is treated as a first-class status, not a euphemism for "not done."

---

## A note on how this was built

All engineering on this project was performed through AI-assisted development (Claude Code), directed session-by-session by the project owner, who set product vision, requirements, architecture direction, business rules, and quality/production-validation standards throughout. This is disclosed plainly rather than presented as traditional solo manual coding, because the resulting discipline — a 74-entry architecture decision log, a continuously-maintained engineering case study, and a habit of auditing before building — is itself a demonstration of how to direct AI-assisted engineering deliberately rather than treating it as autonomous. The full internal case study (`docs/CaseStudy.md`) documents that process, along with every architecture decision, in far greater depth than is appropriate for this external-facing summary.
