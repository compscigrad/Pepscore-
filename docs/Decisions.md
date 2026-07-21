# Engineering Decision Log

## 1. Extend the existing `Invoice` model rather than build a parallel one

**Decision**: Made `Invoice.orderId` optional and added `InvoiceItem`, `InvoiceDiscount`, `InvoicePayment`, `Promotion` as new related models, instead of creating a second, separate "ManualInvoice" concept.

**Reason**: The spec's sample data (cash payment, stacked discounts, USPS tracking, no Stripe order) is clearly a manual/off-platform sale, but the existing `Invoice` model was hard-wired 1:1 to a Stripe `Order`. Two invoice concepts in one app would confuse "which one do I query" at every future call site.

**Alternatives considered**: A separate `ManualInvoice` model entirely independent of `Invoice`.

**Benefits**: One invoice concept, one dashboard, one PDF pipeline, regardless of sale origin. Satisfies Part 1's "maintain the current project architecture, do not unnecessarily restructure."

**Drawbacks**: The `Invoice` model is now larger and carries fields (`orderId`, `stripeInvoiceId`) that are irrelevant to manual invoices, and fields (`items`, `discounts`) that are irrelevant to the original Stripe-order use case. Judged acceptable — both paths share the same lifecycle (draft → paid, ship → deliver) far more than they differ.

## 2. Persist in Postgres/Prisma now, not localStorage

**Decision**: All invoice data goes straight into the existing Neon/Prisma database via `lib/invoices.ts`.

**Reason**: The spec says "saved locally for now," anticipating a future swap to a real database — but Neon/Prisma is already fully provisioned and used for every other entity in this app. Building a throwaway localStorage layer specifically to replace it later would itself be the "quick hack" Part 1 says never to build.

**Alternatives considered**: Browser localStorage now, migrate later.

**Benefits**: No throwaway code. The actual swap-seam the spec wants (storage can change with minimal code impact) still exists — it's `lib/invoices.ts`, the single module every route/page calls instead of touching Prisma directly.

**Drawbacks**: None identified — the "future storage flexibility" goal is met without the localStorage detour.

## 3. PDF generation via `@react-pdf/renderer`, not an overlay on the two sample PDF files

**Decision**: Build both PDF documents from React component trees (`lib/invoice/pdf/MasterInvoiceDocument.tsx`, `RecipientReceiptDocument.tsx`) rather than positioning text onto the two fixed-position sample PDFs referenced in Part 1's placeholder comments.

**Reason**: Those sample PDFs are example output for one specific invoice (3 items, 2 discounts). Real invoices have unlimited items and stacking discounts — a fixed-position overlay can't reflow to fit variable content. `@react-pdf/renderer` is pure JS (no headless-Chromium binary), which avoids a known pain point deploying Puppeteer-style HTML-to-PDF on Vercel serverless functions.

**Alternatives considered**: Puppeteer/Playwright rendering an HTML page to PDF (would guarantee pixel parity with the live preview, at the cost of a much heavier serverless deployment); pdf-lib overlay onto the static template files.

**Benefits**: Reflows correctly for any number of items/discounts; lightweight; no binary/runtime concerns on Vercel.

**Drawbacks**: The live HTML preview and the generated PDF are visually aligned (same brand constants) but not pixel-identical, since `@react-pdf/renderer` uses its own layout primitives rather than real DOM/Tailwind.

## 4. PDFs generated on-demand, not stored as files

**Decision**: `GET /api/admin/invoices/[id]/pdf` streams the PDF directly on each request. `pdfMasterUrl`/`pdfRecipientUrl` remain nullable columns, unused for now.

**Reason**: No blob storage (Vercel Blob, S3, etc.) is configured in this project yet. Adding one just for this feature would be new infrastructure the spec doesn't explicitly require, and on-demand generation is fast enough for the current scale (a single admin generating PDFs, not a high-throughput customer-facing flow).

**Alternatives considered**: Generate once on save, upload to blob storage, store the URL.

**Benefits**: No new infrastructure dependency; PDF always reflects the current invoice state (no stale cached file after an edit).

**Drawbacks**: Regenerates on every download rather than serving a cached file — acceptable at current volume; revisit if invoice volume or PDF complexity grows enough to matter.

## 5. Sequential invoice numbering is new, separate from the existing random-suffix generator

**Decision**: Added `generateSequentialInvoiceNumber()` in `lib/invoice/numbering.ts` for the new invoice endpoints; left `generateInvoiceNumber()` in `lib/orders.ts` (random suffix, e.g. `INV-202607-A1B2C`) untouched for its existing caller.

**Reason**: Part 2 explicitly requires sequential, non-reused numbers (`PS-2026-000001`). Changing the existing function's behavior would silently alter the Stripe-order invoice path's numbering format with no upstream reason to do so.

**Benefits**: Zero behavior change to existing, working code; new requirement met exactly as specified.

**Drawbacks**: Two invoice-numbering schemes now exist in the codebase (`INV-YYYYMM-XXXXX` vs `PS-YYYY-NNNNNN`). Worth unifying if/when the Stripe-order invoice path is ever merged into this module's data model (see Decision #1's drawback).

## 6. One new runtime dependency: `zod`

**Decision**: Added `zod` for invoice/payment payload validation.

**Reason**: The spec explicitly requires validation of required fields, email/ZIP format, non-negative totals, overpayment guards, and duplicate invoice numbers. No existing dependency in the project provides schema validation.

**Alternatives considered**: Hand-rolled validation functions.

**Benefits**: Declarative, type-inferring schemas (`InvoicePayload`/`PaymentPayload` types are derived from the schema, not maintained separately); well-established, lightweight, no runtime bloat.

**Drawbacks**: One more dependency to keep updated — judged worth it given how much validation surface the spec requires.

## 7. Branch workflow: `feature/invoice-system` off `master`, PR at the end

**Decision**: Branched off `master` (the full e-commerce app), not `landing` (the pre-launch marketing page) — even though the design language is sourced from `landing`. Work is pushed to GitHub incrementally; a PR is opened once the module is complete rather than merging directly.

**Reason**: The invoice system is an internal admin tool that depends on Prisma/Clerk/the admin dashboard, none of which exist on `landing`. `landing` is purely a marketing page's source — useful as a design reference, not a base to build on.

**Benefits**: Design consistency without incorrectly coupling an internal tool's codebase to the marketing page's branch.

## 8. Dedicated invoice logo (`public/images/invoice-logo.jpeg`), separate from the site-wide `logo.png`

**Decision**: Both PDF documents and the live preview use a new `public/images/invoice-logo.jpeg` (gold "P" monogram + "Pepscore Lab" wordmark), not the existing `public/images/logo.png` used by the storefront header (an older molecular-icon mark with a different tagline/typeface).

**Reason**: Part 1's placeholder comment named this exact asset (`Invoice Logo Pepscore.jpeg`) as the intended invoice logo — it's a real, newer brand asset the owner already had, not a hypothetical. The storefront's own visual refresh (matching `landing`'s look) is explicitly out of scope for this module ("that can be handled later"), so this stays scoped to the invoice system rather than swapping the site-wide logo.

**Alternatives considered**: Replacing `public/images/logo.png` everywhere (rejected — out of scope, would touch the storefront header ahead of its own redesign).

**Benefits**: Invoice PDFs/preview show the correct, current logo immediately; storefront header is untouched until its own redesign is scheduled.

**Drawbacks**: Two logo files now exist in the project until the storefront catches up, at which point `logo.png` should likely be retired in favor of this one.

## 9. Fixed `eslint.config.mjs` to import `eslint-config-next`'s flat config directly, not through `FlatCompat`

**Decision**: Replaced `compat.extends('next/core-web-vitals', 'next/typescript')` with direct imports of `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

**Reason**: `eslint-config-next@16.2.6` ships native ESLint 9 flat-config arrays (confirmed by reading its compiled `dist/*.js` — they're array spreads of real plugin objects, not legacy eslintrc strings). `FlatCompat.extends()` exists specifically to shim *legacy* eslintrc-style shareable configs into flat config; passing already-flat, self-referencing plugin objects through its legacy JSON-schema validator crashed with "Converting circular structure to JSON" the moment `eslint .` was run directly. This surfaced now (not earlier) because Next.js 16 removed the `next lint` subcommand entirely, so `eslint .` became the only way to lint this project — and that path had never actually been exercised before.

**Alternatives considered**: Disabling lint / adding broad ignores (rejected — hides real errors); downgrading `eslint-config-next` (rejected — no reason to fight the version already required by Next 16).

**Benefits**: `npx eslint .` now runs and reports real findings. Fixing it surfaced four genuine issues in code this PR touched — two `react-hooks/set-state-in-effect` violations (`InvoiceTable.tsx`, `ClerkAuthButtons.tsx`, both fixed), and a false-positive `jsx-a11y/alt-text` warning on `@react-pdf/renderer`'s `Image` (which renders into a PDF content stream, not the DOM — suppressed with a comment explaining why).

**Drawbacks**: None — this is a straightforward compatibility fix, not a workaround.

## 10. Invoice dashboard/builder moves to the landing page's actual dark theme, not the light `cream`/`g100` admin convention

**Decision**: `app/admin/invoices/**` and `components/invoices/**` (except `InvoicePreview.tsx`) now use a black page background with hairline-bordered glass cards (`bg-white/[0.03]`, `border-gold/10`, `rounded-[18px]`, no shadow), matching tokens measured live from `pepscore-landing.vercel.app` via JS inspection — not the `cream`/`g100`/`shadow-sh` light-card convention this module launched with (see Decision #7's original scope note) or the rest of `/admin`.

**Reason**: The owner flagged that the invoice UI's initial branding didn't match the actual site — it had inherited the pre-existing `/admin` dashboard's light theme by convention rather than being checked against the real landing page, which turned out to be black end-to-end (not just the hero) with a specific flat-depth card style. A later directive made this explicit: the invoice module should read as an extension of the real brand, and must not inherit the old invoice UI's own colors/spacing as a reference either.

**Alternatives considered**: Keep the light theme and only swap accent colors (rejected — doesn't fix the actual mismatch, which is background color and card depth treatment, not just hue); redesign the whole `/admin` area to match (rejected — out of scope, `/admin`'s non-invoice pages were never part of this module's brief).

**Benefits**: Dashboard/builder now visually matches the live site the owner actually showed as the reference. All dark-theme class tokens live in one file (`components/invoices/theme.ts`) instead of being re-typed per component, so a future token change is a one-file edit.

**Drawbacks**: `/admin`'s non-invoice pages (the base dashboard, orders table) still use the old light theme — there's now a visible seam at the `/admin` → `/admin/invoices` boundary. Acceptable for now per the same "that can be handled later" scope boundary as Decision #8; flagged in `FutureRoadmap.md`.

## 11. Legal footer: centralized config + one shared PDF component, normal document flow only

**Decision**: Added `lib/invoice/legal.ts` (`INVOICE_LEGAL_SECTIONS`) as the single source for the RUO and Customer-Responsibility-After-Delivery clauses, and a `LegalFooter` component in `lib/invoice/pdf/shared.tsx` used by both `MasterInvoiceDocument.tsx` and `RecipientReceiptDocument.tsx`. Replaced the old `fixed`-positioned one-line `DocumentFooter` entirely — `LegalFooter` renders in normal document flow, after the totals/payment-history/notes content, never at an absolute page position.

**Reason**: A `fixed` footer is pinned to the same spot on every page regardless of how much content precedes it; that's fine for a one-line tagline but risks visually colliding with totals or overflow content once real legal paragraphs are added. Rendering after the rest of the content in normal flow makes "never overlaps totals" true by construction rather than something to test for. Centralizing the copy in one file (rather than duplicating the same paragraphs in both PDF documents) means a future legal wording change is a one-file edit.

**Alternatives considered**: Keep the `fixed` footer and just lengthen it (rejected — reintroduces the overlap risk this decision exists to avoid); duplicate the legal text directly in each PDF document (rejected — violates the "no duplicated legal text" requirement and risks the two copies drifting).

**Benefits**: Overlap-proof by construction; single edit point for legal copy; `wrap={false}` keeps each clause intact rather than splitting a paragraph across a page break if the footer is ever pushed to a second page.

**Drawbacks**: On an unusually long invoice (many items, long notes), the footer can be pushed entirely onto a second page. Judged acceptable — better than clipping or overlapping — and not expected in practice given typical invoice length.

## 12. PDF header gets a small gold accent bar and status badge; sparing use of gold elsewhere in print

**Decision**: Added a 40×2px gold accent bar under the document title and a bordered/tinted status badge (gold only for `PAID`, neutral gray-scale for every other status) under the invoice number in `DocumentHeader`. Everything else in the PDF — body text, table rules, section borders — stays black-on-white.

**Reason**: The branding directive asked for PDFs that "reinforce the brand but remain professional and printer-friendly" and explicitly warned against looking like marketing material. Gold is the brand's one accent color; using it in exactly two deliberate spots (a small header accent, and the one status worth highlighting) reads as intentional brand presence without turning the document into a colored flyer or wasting ink on a black-and-white printer.

**Alternatives considered**: Color-code every status like the on-screen `StatusBadge` does (rejected — would mean 6+ colors in a printed document, working against "less is more" and printer-friendliness); no status badge at all (rejected — a quick-scan paid/unpaid indicator is genuinely useful on a printed record).

**Benefits**: Consistent, restrained brand presence in the PDF; status is scannable at a glance without re-reading the totals block.

**Drawbacks**: None identified.

## 13. Product picker matches on a composed "Name — Size — 1 Box" label, not the bare product name

**Decision**: `InvoiceItemsTable.tsx`'s product datalist now displays and matches against `formatProductLabel(product)` (`lib/invoice/format.ts`) — e.g. `Tesamorelin — 10mg — 1 Box` — instead of `product.name` alone. Selecting a product now also saves that full composed label as the invoice line item's `name`, not just the bare name.

**Reason**: The catalog reuses the same `name` across multiple strengths (Tesamorelin 5mg/10mg, Semaglutide across five strengths, etc.) but the picker matched purely on `product.name`. With two products sharing a name, `products.find(p => p.name === typed)` always resolved to whichever row happened to come first — the dropdown couldn't actually distinguish strengths, and even when the right one was intended, only the bare name (no strength) was saved onto the invoice line item, PDF, and receipt. This was flagged directly: invoices were losing the mg strength, and duplicate-looking dropdown entries made it easy to pick the wrong price.

**Alternatives considered**: Switch the picker to a real `<select>` keyed by product id (rejected — would drop the existing free-text/ad-hoc-item support the datalist provides, a real feature per the original spec's non-catalog sample items like "Glow70"); keep matching on name but disambiguate via a second field (rejected — more state to keep in sync for no benefit over just using an already-unique composed string).

**Benefits**: Composed labels are unique across the full catalog (verified: zero collisions across 119 live products) so selection is unambiguous; the same string appears in the dropdown, the line item, the live preview, and the PDF, so there's never a mismatch between what was selected and what's shown; free-text ad-hoc items are untouched.

**Drawbacks**: Existing saved invoices created before this change keep whatever bare name was captured at the time — unaffected, since `InvoiceItem.name` is a snapshot, not a live join. Going forward, the persisted item name is a few characters longer ("— 1 Box" suffix); judged acceptable since it's factually accurate (`price`/`bulkPrice5`/`bulkPrice10` are all defined per-box).

## 14. Tesamorelin price correction + one stale duplicate product removed

**Decision**: Corrected `prisma/seed.ts`'s Tesamorelin 1-box prices (5mg: $312 → $400, 10mg: $531 → $750; bulk tiers unchanged, not part of the correction) and reseeded the shared database. Cross-checked all other ~119 catalog products against the current master price sheet — every other price already matched exactly, so no further corrections were needed. Also deleted one unreferenced stale product row, `cjc1295-ipamorelin-10mg` ("CJC-1295 / Ipamorelin", $50, inverted bulk pricing) — a pre-reorganization leftover superseded by `cjc1295-ipa-10mg` ("CJC-1295 without DAC 5mg + Ipamorelin 5mg", $297), confirmed unreferenced by any Order/InvoiceItem before deleting.

**Reason**: A full pricing audit was requested after Tesamorelin's 1-box prices were found to be stale in the live catalog.

**Benefits**: `prisma.product` (via `prisma/seed.ts` as source of truth, re-run with `npm run db:seed`) remains the single place invoice pricing is edited — no parallel/hardcoded price table existed anywhere else in the codebase (verified via full-repo search).

**Drawbacks**: None identified.

## 15. Payment arrangements: real relational models, not JSON on Invoice

**Decision**: Added `PaymentArrangement` (1:1 with `Invoice`) and `PaymentArrangementInstallment` (1:many, one row per scheduled payment including the initial one) as real Prisma models, plus `PaymentFrequency` (`WEEKLY`/`BIWEEKLY`) and `InstallmentStatus` (`PENDING`/`PAID`/`OVERDUE` — the last not yet set automatically) enums, rather than a JSON blob on `Invoice` or a set of ad-hoc form fields that don't persist a real schedule.

**Reason**: The feature explicitly asked to be "a reusable data model rather than temporary form fields," naming future needs (overdue detection, reminders, a customer payment portal, partial payment history, audit logs, finance reporting) that all require querying/updating *individual* installments — a JSON blob would mean deserializing and rewriting the whole schedule for any single-row change, and couldn't be indexed or queried by due date across invoices for something like an overdue-detection job.

**Alternatives considered**: `Json` column on `Invoice` holding the schedule array (rejected — exactly the future-features problem above); a single `PaymentArrangement` row with the schedule inline as JSON but installments as their own rows only for *paid* ones (rejected — inconsistent shape between paid/pending installments for no real benefit).

**Benefits**: Each installment is independently queryable/updatable (`WHERE dueDate < now() AND status = 'PENDING'` already answers "what's overdue" the moment that feature is built — no migration needed then). Installment #1 is always the initial payment (generated alongside the arrangement, immediately `PAID`), so the schedule table is one uniform list, not "initial payment info" plus a separately-shaped "future schedule."

**Drawbacks**: Two new tables instead of one JSON column — judged worth it given the explicit future-compatibility requirement.

## 16. Setting up an arrangement doesn't record a new payment — and is available on any invoice with a balance, not just Partial ones

**Decision**: `createPaymentArrangement()` handles two cases. If the invoice already has a payment, "Initial Payment Amount/Date" are derived from its *existing* history (`amountPaid`, and the earliest payment's date) rather than accepted as new input — it never touches `Invoice.amountPaid`/`balanceDue`, since those were already set correctly by whatever payment(s) happened. If the invoice has no payment yet, there's no history to derive from, so the admin instead provides a `startDate` and the *entire* schedule is generated fresh from it, with every installment created `PENDING` (none pre-marked paid). Either way, only `numberOfPayments`, `frequency`, and (when needed) `startDate` are actually submitted — never a payment amount or method.

**Reason**: Initially this only supported the has-a-payment case, gated to invoices already at Partial status, per a literal reading of the original spec ("should not appear for Pending or Paid invoices"). Live use surfaced the gap directly: an admin wanted to set up a plan proactively on a brand-new Draft/Pending invoice with nothing paid yet ("just in case it needs to be utilized," uniformly available like any other invoice) — not only after the fact. Requiring an existing payment first made that impossible. Generalizing to "any invoice with `balanceDue > 0`" and letting the schedule start from a chosen date instead of a derived one covers both real workflows without duplicating the creation logic.

**Alternatives considered**: Keep requiring a prior payment and just tell users to record a token payment first to unlock the section (rejected — forces an artificial workaround for a legitimate use case); always ask for a fresh "Initial Payment Amount" to record regardless of history (rejected — reintroduces the double-counted-payment problem for invoices that already have one, see the previous version of this decision).

**Benefits**: One creation flow covers "already paid something, schedule the rest" and "nothing paid yet, schedule everything" without two separate code paths in the UI beyond which fields are shown; the arrangement still can never drift from `Invoice.amountPaid`/`balanceDue`, since neither case lets the client submit its own payment numbers — only a start date and a payment count.

**Drawbacks**: If an invoice received multiple separate payments before the arrangement was set up, "Initial Payment Date" is the *earliest* of them (not a specific single transaction) — judged acceptable since the summary is about the amount, and the schedule's dates all key off that one anchor date regardless.

## 17. Payment Status (Pending/Partial/Paid) is computed, not stored

**Decision**: `computePaymentStatus(amountPaid, total)` in `lib/invoice/paymentArrangement.ts` derives Pending/Partial/Paid from the invoice's existing `amountPaid`/`total` fields at render time — it isn't a new database column, and it's separate from (and doesn't touch) the existing `InvoiceStatus` enum (`DRAFT`/`PENDING`/.../`PAID`/`PARTIALLY_PAID`/etc.), which continues to drive the admin's own workflow state and what shows on generated PDFs.

**Reason**: The three states' definitions ("no payment received," "one or more payments received but a balance remains," "balance satisfied") are objective facts already fully determined by existing fields — storing a second value for the same fact would be exactly the kind of value that could drift from reality. `InvoiceStatus` already has its own `PAID`/`PARTIALLY_PAID` values serving a different purpose (overall workflow/document state, manually set via `InvoiceStatusSection`) — collapsing it down to only these three values would delete `DRAFT`/`APPROVED`/`ISSUED`/`CANCELLED`/`REFUNDED`/`VOID`, breaking the just-built invoice-status workflow control for no reason connected to this feature.

**Alternatives considered**: Repurpose `InvoiceStatus` itself to mean this (rejected — would destroy unrelated, already-working workflow-state functionality); add a stored `paymentStatus` column (rejected — redundant with data that already exists, risking drift).

**Benefits**: Always accurate by construction; gates the Payment Arrangement section's "offer to create" state (`Partial` + no existing arrangement) without needing to keep a separate flag in sync.

**Drawbacks**: None identified.

## 18. PDF layout tightened to fit a typical invoice on one page; legal footer's `wrap` moved from the whole block to each clause

**Decision**: Reduced page margins (48pt → 28pt), the header logo (240×161 → 140×94), and nearly every section's internal spacing/padding across `lib/invoice/pdf/shared.tsx`, so a typical invoice (a few items, a payment history or arrangement, the legal footer) fits on one LETTER page. Also: the Master Invoice no longer renders a separate "Payment History" table when a payment arrangement exists (its own schedule table already lists every payment as "Payment N," so showing both repeated the same rows and cost real estate for nothing). Separately, `LegalFooter`'s `wrap={false}` moved from the outer footer container to each individual legal clause (`legalSection`) — the footer itself can now split across a page boundary if it must, but a clause never splits mid-paragraph.

**Reason**: The branding pass had made the header logo large and generous section spacing, without checking whether real content fit on one page — a live invoice with a payment history and a 4-installment arrangement was overflowing to 2 pages, and root-causing it found the actual bug: the *whole* legal footer had `wrap={false}`, so whenever it was even a few points short of fitting in the remaining space on page 1, react-pdf pushed the *entire* footer (divider, tagline, both legal paragraphs) to page 2 rather than using the space that was there — producing a second page that was nearly empty except the fine print. That's a strictly worse failure mode than needing a second page for genuine content overflow (items, notes, a long arrangement schedule), which is expected and fine.

**Alternatives considered**: Keep `wrap={false}` on the whole footer and just shrink everything further to always avoid triggering it (rejected — chasing this for arbitrarily heavy content, like an invoice with full contact info plus two long note paragraphs plus a 4-installment arrangement, has diminishing returns and would eventually make the *typical* invoice look cramped just to accommodate rare edge cases); let the footer wrap freely with no `wrap` constraint anywhere (rejected — risks a clause's heading landing on one page and its body on the next, which reads as broken).

**Benefits**: Verified empirically (rendering real and representative mock invoices, counting actual PDF page objects): every "typical" scenario tested — no arrangement, one payment, one payment plus a 4-installment arrangement (matching the real Marvin Alexander invoice) — now renders on exactly one page for both the Master Invoice and Client Invoice. A deliberately extreme case (full customer contact fields, two long note paragraphs, an arrangement, discounts) still uses 2 pages, but only because page 1 is already genuinely full of real content — the footer following onto page 2 in that case is legitimate overflow, not an isolated disclaimer stranded for no reason.

**Drawbacks**: The header logo and body text are noticeably smaller than the previous branding-focused sizing. Judged an acceptable trade against the explicit "must fit on one page" requirement — still sized as a clear, legible brand mark, just not the maximal size the earlier pass used.
