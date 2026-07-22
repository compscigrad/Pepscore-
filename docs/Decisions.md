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

## 19. ZIP auto-population via a keyless third-party API; "same as billing" is ephemeral UI state, not a persisted field

**Decision**: Added `GET /api/admin/zip-lookup` — an admin-gated server proxy to Zippopotam.us (`https://api.zippopotam.us/us/{zip5}`) — and a shared `useZipLookup` client hook consumed identically by `CustomerInfoSection` (billing) and `ShippingSection` (shipping). Entering a complete 5-digit ZIP (a ZIP+4 suffix is tolerated, only the first 5 digits are looked up) auto-fills city/state while leaving both editable; a failed lookup shows an inline message and never clears existing address data. Separately, `ShippingSection` gained a "Same as billing address" checkbox and `InvoiceBuilder` gained a `shippingSameAsBilling` boolean `useState` — deliberately **not** part of `InvoiceDraft` or the save payload. While checked, editing billing address fields also copies into `draft.shipping.shippingAddress` in the same `setDraft` call (no `useEffect`), and the shipping address sub-fields render disabled; unchecking leaves the last-copied values in place as an independent starting point rather than clearing them.

**Reason**: Zippopotam.us was chosen specifically because it's free and keyless — provisioning a credentialed service (e.g. the USPS Web Tools API) isn't something an agent can do on the user's behalf, and the spec didn't require a specific provider. Proxying server-side (rather than calling it directly from the browser) keeps the third-party dependency swappable and puts it behind the same `isAdmin` gate as every other invoice-admin endpoint. The same-as-billing flag is UI convenience only — the data that actually needs to persist is the shipping address values themselves, which flow through the existing `draft.shipping` save path unchanged; there's no server-side concept of "linked" addresses to keep in sync later, matching how `paymentStatus` (#17) is also computed/ephemeral rather than stored.

**Alternatives considered**: A signed-up-for lookup provider (rejected — requires credentials this project doesn't have and an agent can't obtain); storing `sameAsBilling` as a persisted `Invoice` column (rejected — would require migrating existing invoices and gives the flag meaning it doesn't need; the copied address values are self-sufficient on their own once saved); syncing shipping from billing via a `useEffect` watching `draft.customer` (rejected — this codebase avoids `useEffect`-driven cross-field sync, per prior `react-hooks/set-state-in-effect` friction; a direct copy inside the existing `onChange` handler is simpler and has no render-order surprises).

**Benefits**: New invoices get city/state for free from a ZIP, cutting a common data-entry error (typoed or mismatched city/state/ZIP combinations). The same-as-billing checkbox removes the most common redundant retyping in the builder without adding any new persisted schema or migration risk. Existing invoices (saved before this feature existed) load unaffected — `street2` was already optional in both the type and the zod schema, so old records without it just render an empty field.

**Drawbacks**: Zippopotam.us is a third-party dependency with no SLA; a failed or slow lookup degrades gracefully (manual entry still works, existing data is never cleared) but isn't retried automatically. The same-as-billing flag resets to unchecked on every page load/reload (it's not persisted), so a user editing a saved invoice with billing == shipping by coincidence won't see the checkbox pre-checked — judged acceptable since the checkbox is a data-entry shortcut, not a fact about the invoice.

## 20. Delete is a new `deletedAt` column and Trash view, separate from the existing `archivedAt` Archive feature

**Decision**: Added `Invoice.deletedAt DateTime?`, distinct from the existing `archivedAt`. "Archive" (#unnumbered, pre-dates this decision log) is for a completed invoice you keep around for records — still fully visible via `includeArchived`. "Delete" is for "get this off my list, I probably don't need it" — it drops out of every normal view immediately and only lives in a dedicated `/admin/invoices/trash` page, with two actions: Restore (clears `deletedAt`) or Delete Forever (an actual `prisma.invoice.delete()`, cascading to items/discounts/payments/payment arrangement). `permanentlyDeleteInvoice()` refuses to run unless `deletedAt` is already set — the "trash first, then a separate final action" two-step is enforced at the data layer, not just hidden behind two button clicks in the UI. Both the initial Delete button and the Trash page's Delete Forever button use an in-page two-click confirm (arm on first click, 4s window, second click executes) rather than a native `confirm()` dialog, matching this UI's existing toast-driven conventions.

**Reason**: User request: "there needs to be an option to delete an invoice and it go into a holding spot for a secondary and final delete in case of an accidental delete, it can be recovered." Reusing `archivedAt` for this would conflate two different intents (a keeper vs. a mistake) and break the existing Archive/Restore UI's assumption that an archived invoice is a real, complete record.

**Alternatives considered**: Overloading `archivedAt` with a second flag distinguishing "archived" from "deleted" (rejected — two independent boolean-ish states are clearer as two independent nullable timestamps than one column with contextual meaning); immediate hard delete with no holding period (rejected — directly contradicts the explicit "recoverable" requirement); a native `window.confirm()` for the permanent-delete step (rejected — inconsistent with the rest of the dashboard, which has no native browser dialogs anywhere, and reads as a jarring UX regression against the app's otherwise consistent dark-themed, toast-driven interaction pattern).

**Benefits**: Accidental deletes are recoverable right up until someone deliberately visits Trash and confirms Delete Forever twice. Cascading FK `onDelete: Cascade` was already in place on every child table (items, discounts, payments, payment arrangement + installments) from the original schema design, so the hard-delete path needed no schema changes beyond the new `deletedAt` column itself.

**Drawbacks**: Trash has no auto-purge — an invoice sits there indefinitely until an admin manually empties it. Acceptable for now given invoice volume is low; worth revisiting (a scheduled sweep) if Trash ever accumulates enough rows to matter.

## 21. Automated Paid → Archived transition after a configurable number of days, driven by a daily Vercel Cron sweep

**Decision**: Extended the existing manual Archive feature with an automatic path: once an invoice's `status` is `PAID`, a background sweep (`GET /api/cron/archive-invoices`, run daily via Vercel Cron, `Authorization: Bearer CRON_SECRET`) archives it (`archivedAt = now`) once `paidAt` is older than the configured `archiveAfterDays` (default 30; 60/90/never also supported). The setting lives in a new one-row `InvoiceSettings` table (fixed id `'singleton'`), editable from a new `Settings → Invoices` page. `paidAt` is now actively maintained rather than "set once": `updateInvoice` recomputes `isPaid = payload.status === 'PAID' && balanceDue <= 0` on every save and sets `paidAt` to *now* whenever that's true (so editing a still-paid invoice resets the countdown, per spec) or clears both `paidAt` and `archivedAt` the moment it isn't (reopened, balance increased, status moved off PAID — un-archiving it too, since a no-longer-fully-paid invoice shouldn't stay hidden in Archived). `recordPayment` already refreshed `paidAt` to now on every transition into fully-paid, so the "additional payment" reset trigger needed no change there. The invoice list's status dropdown was replaced with a `filter` param — `all | outstanding | paid | overdue | archived` — mapped to `buildFilterClause()` in `lib/invoices.ts`, which also excludes trashed (`deletedAt`) invoices consistent with decision #20; a search term ignores the current filter and searches active + archived together, per the spec's "search both" requirement.

**Reason**: User request for QuickBooks/Stripe/Shopify-style automatic archival, driven by a configurable delay, with every listed reset trigger (edit, reversal, refund, reopen, additional payment, balance change) restarting the countdown — modeled as "recompute `paidAt` on every relevant write" rather than a separate mutable "archive date" field, so there's exactly one source of truth for when the countdown started and no way for it to drift out of sync with the invoice's actual payment history.

**Alternatives considered**: A `nextArchiveAt` field computed and stored at payment time (rejected — redundant with `paidAt + archiveAfterDays`, and could drift from `paidAt` if the setting changes after the invoice was paid — computing at sweep time always uses the *current* setting); an in-process `setTimeout`/cron-in-Node scheduler (rejected — this app is deployed as Vercel serverless functions with no persistent long-running process to host a timer; hitting an API route via Vercel Cron is the standard pattern here); computing archived-vs-active on every read instead of writing `archivedAt` (rejected — the spec explicitly asks for an actual flag flip, and a stored flag keeps the existing `archivedAt`-based list filtering/search/reporting index-friendly instead of computing a date comparison on every row on every request); keeping the old raw `InvoiceStatus` dropdown alongside the new All/Outstanding/Paid/Overdue/Archived filter (rejected — two overlapping filter UIs on the same table read as confusing; the new set covers what the spec asks for, and "All" still surfaces every non-archived status).

**Benefits**: Reuses the entire existing Archive infrastructure (list filtering, restore, still fully searchable/viewable/exportable/PDF-able — none of that changes for an auto-archived invoice vs. a manually archived one, since it's the same `archivedAt` column). No new archival code path for reporting/PDFs/search to keep in sync. The dashboard's Revenue KPI now includes archived invoices (previously excluded) since a fully-paid, auto-archived invoice's revenue is exactly as real as an active one's; outstanding balance and the operational KPIs (pending shipments, delivered) stay scoped to active invoices since those describe current workflow state.

**Drawbacks**: "Overdue" as a filter has no natural definition on this data model — there's no due-date field on `Invoice` itself (only `PaymentArrangementInstallment.dueDate` for installment plans). Implemented as a pragmatic stand-in (`balanceDue > 0` and `issuedAt` more than 30 days ago, independent of the configurable archive delay) rather than leaving the filter out; this is the one real assumption in this feature and is worth revisiting if a true per-invoice due date is ever added. Vercel's cron scheduling grain is daily, not real-time — an invoice can sit up to ~24h past its exact archive moment before the sweep catches it, immaterial at a 30+ day granularity. `CRON_SECRET` must be set in Vercel's project environment variables (Production and Preview) for the deployed cron trigger to authenticate — not something this session can do on the user's behalf, so it's called out as a manual deployment step.

## 22. Carrier-agnostic shipment tracking built on Shippo (already an existing dependency), with a `ShippingProvider` abstraction so it isn't hard-coded to one API

**Decision**: Added a full tracking subsystem under `lib/tracking/` behind a `ShippingProvider` interface (`registerTracking`, `getTrackingStatus`, `verifyWebhook`, `normalizeWebhookPayload`) — `shippoProvider` is the only implementation today, resolved per-carrier through `registry.ts` so a future direct-carrier adapter (or a different multi-carrier vendor) only needs a new adapter file plus one line in the registry; nothing in invoice code, the UI, or the webhook/cron routes would need to change. Chose Shippo specifically because it's already a dependency (`lib/shippo.ts`, used today for Order shipping-label purchases) and is itself a multi-carrier aggregator covering USPS/UPS/FedEx/DHL and more under one API — exactly the "prefer a multi-carrier API" guidance, with zero new third-party accounts to provision. New Prisma models: `Shipment` (1:1 with Invoice, the current tracking state), `TrackingEvent` (append-only history, deduped via a `(shipmentId, eventHash)` unique constraint), `ShipmentNotification` (email send history), and `InvoiceActivityLog` (a dedicated shipment/tracking-focused activity log, deliberately separate from the existing admin-action-shaped `AdminAuditLog`, since this one needs an optional `userId` to cover webhook/polling/system-sourced entries). Every carrier event is normalized into a fixed 16-value `ShippingStatus` enum, while the original carrier text is always preserved alongside it (`TrackingEvent.carrierStatus`/`description`), never discarded. A new `InvoiceOrderStatus` enum (`OPEN/IN_PROGRESS/COMPLETED/CANCELLED`) implements the spec's completion rule (`computeOrderStatus()` in `lib/tracking/orderStatus.ts`, a pure function callable from both the payment side and the shipping side) as its own 4th status dimension, independent of the existing `InvoiceStatus` (payment) and `deliveryStatus` (legacy fulfillment, left untouched for back-compat — the new `shippingStatus` field is what the tracking system actually drives, with a lookup table keeping the old field in a sensible state too). Webhooks (`/api/webhooks/shippo`) are the primary update path; a daily-quantized polling cron (`/api/cron/poll-tracking`, `CRON_SECRET`-gated like the archive sweep) is the fallback for shipments that miss one, with retry/backoff and per-shipment failure isolation so one bad shipment never blocks the batch.

**Reason**: The spec explicitly asks for a carrier abstraction ("do not place carrier-specific logic directly inside the invoice component") and prefers a multi-carrier API "to reduce duplicated carrier logic" — Shippo satisfies both without adding a new vendor relationship, since it's the exact tool this codebase already trusts for label purchases. The dedicated `InvoiceActivityLog` (rather than folding shipment events into `AdminAuditLog`) exists because the spec's activity-log shape (previous/new value, carrier, tracking number, and a `source: Manual|Webhook|Polling|System` with an *optional* user) doesn't fit `AdminAuditLog`'s admin-action shape (mandatory `adminId`, generic `details: Json`) — reusing it would mean either fabricating a fake admin id for system-sourced events or loosening a constraint that's correct for every other use of that table.

**Alternatives considered**: Direct per-carrier APIs (USPS Web Tools, UPS/FedEx/DHL developer APIs) instead of Shippo (rejected — 4 separate credentialed integrations instead of 1, each with its own auth/rate-limit/webhook quirks, for no benefit over the multi-carrier aggregator the spec itself recommends); folding shipment tracking into the existing `ShippingLabel` model (rejected — `ShippingLabel` is a 1:1, Order-only, purchase-transaction snapshot with no history/versioning concept; invoices don't have Orders in the manual-sale case this whole invoice module exists for, and a tracking timeline is a fundamentally different shape than a label receipt); a single combined `orderStatus`/`shippingStatus` field (rejected — the spec is explicit that payment/shipping/fulfillment/order must stay separate dimensions, and collapsing any of them back together would silently violate the "do not mark an invoice paid merely because a package was delivered" rule).

**Benefits**: Adding a new carrier (or swapping providers) never touches `TrackingSection.tsx`, the webhook route, the cron route, or `service.ts`'s orchestration logic — only `registry.ts` and a new file implementing `ShippingProvider`. The event-hash dedup constraint is enforced at the database layer (a duplicate webhook or overlapping poll fails the unique constraint and is caught, not re-processed), not just by application-level bookkeeping that could drift. `computeOrderStatus()` being a pure function meant the paid+delivered completion rule (and its unpaid+delivered non-completion counterpart) could be verified with plain unit tests with no database at all.

**Drawbacks**: Shippo doesn't sign webhook payloads with an HMAC secret the way Stripe does — the auth boundary here is a shared-secret token embedded in the webhook URL itself (`?token=<SHIPPO_WEBHOOK_SECRET>`), which is weaker than true signature verification (a leaked URL is a leaked secret) but is Shippo's own documented pattern for this exact problem. The project's configured `SHIPPO_API_KEY` is a sandbox/test-mode key, which only accepts Shippo's fake `'shippo'` test carrier for tracking registration (confirmed empirically — a real `USPS`/`UPS`/etc. token is rejected with `"usps is not a valid test tracking carrier"`); this is a Shippo sandbox-mode limitation, not a bug in the adapter, but it does mean the real registration path against live carriers couldn't be exercised end-to-end in this environment — verified instead via direct calls to `processTrackingEvents`/`computeOrderStatus` with synthetic events, and the full error-handling path was confirmed live (the sandbox rejection surfaces correctly as a toast in the UI). Vercel Cron on the Hobby plan only supports daily schedules; the `poll-tracking` cron is configured for every 4 hours (`0 */4 * * *`), which requires a Pro-plan project to actually run at that cadence — on Hobby it will silently run at whatever cadence Vercel allows instead, which is a deployment-environment fact this session can't change, only flag.

## 23. Automatic "invoice issued" customer email, gated by activity-log presence rather than a boolean flag

**Decision**: The first time an invoice reaches `ISSUED`, `PAID`, or `PARTIALLY_PAID` — checked from all three places that can cause that transition (`createInvoice`, `updateInvoice`, `recordPayment` in `lib/invoices.ts`) — `sendInvoiceIssuedEmailIfNeeded()` (`lib/invoiceIssuedEmail.tsx`) emails the Client Invoice PDF to `customerEmail`, if one is on file and `InvoiceSettings.autoEmailInvoiceOnIssue` is enabled (default on). Whether the one-time send has already happened is determined by querying `InvoiceActivityLog` for an existing `INVOICE_ISSUED_EMAIL_SENT` row for that invoice — not a separate boolean column — so a later manual resend (the new "Email Invoice to Customer" button, `sendInvoiceEmailManually()`, always sends regardless of this check) can never be mistaken for "the auto-send hasn't fired yet." Denormalized `lastInvoiceEmailSentAt`/`Status`/`FailureReason` columns on `Invoice` mirror the existing `lastNotification*` pattern from the tracking system, for quick display without a join.

**Reason**: Requested directly — invoices should sync to the customer automatically on the basics (issued, payment status, arrangement schedule, tracking once added) without requiring an admin to remember to click "download PDF" and attach it to a manual email every time, while keeping the existing manual PDF-download/send workflow fully available as a fallback or for ad-hoc resends.

**Alternatives considered**: A boolean `invoiceEmailSent` flag on `Invoice` (rejected — indistinguishable from "manually resent since," which would make a legitimate resend look like the auto-send already happened, silently suppressing it if a status ever reverted and re-advanced); firing only from `updateInvoice` (rejected — `recordPayment` can independently drive a `DRAFT` invoice straight to `PAID`/`PARTIALLY_PAID` without ever passing through an explicit "Save" on `ISSUED`, which would silently skip the customer email for that path).

**Benefits**: Reuses the exact Client Invoice PDF generation and Resend-attachment pattern already proven out in `lib/tracking/notifications.tsx`, so there's no new PDF-rendering or email-delivery code to trust. The trigger check is a single pure predicate (`isInvoiceEmailTriggerStatus`), unit-testable with no database.

**Drawbacks**: `RESEND_FROM_EMAIL` is still Resend's own sandbox default (`onboarding@resend.dev`) rather than a verified Pepscore domain, since domain verification was intentionally tabled — every automatic email (this one and the tracking notifications) sends from that address until a custom domain is verified and the env var updated, which is an operational follow-up, not a code change.

## 24. `Shipment` becomes a true one-to-many under `Invoice`, with a derived (never stored) primary shipment, plus a centralized Fulfillment Gate for label purchase

**Decision**: Dropped the `@unique` constraint on `Shipment.invoiceId` (`Invoice.shipment Shipment?` → `Invoice.shipments Shipment[]`) so an invoice can have any number of shipments — a manually-typed tracking number, a purchased label, a replacement after a mistake, a returned package — each its own permanent row. Nothing is ever deleted, including voided shipments. Which shipment is "current" is never a stored pointer; `lib/shipments/primary.ts`'s `getPrimaryShipment()` derives it on read (most recent non-voided, falling back to the single most recent if every shipment is voided), and `Invoice`'s denormalized fields (`shippingStatus`, `trackingNumber`, etc., used for quick list/PDF display) are refreshed from whichever shipment is currently primary — a status update landing on a superseded/voided shipment never overwrites what the invoice shows. Alongside this, real Shippo label purchase was added (`lib/fulfillment/labels.ts`, reusing the existing `lib/shippo.ts` client built for storefront Orders) gated by a new centralized Fulfillment Gate (`lib/fulfillment/gate.ts`'s `checkFulfillmentEligibility()`): a shipment may be created when the invoice is paid in full, OR has an active payment arrangement, OR carries a manual override. The override is a permanent, attributed record (`Invoice.fulfillmentOverrideAt/By/Note`, set only via `overrideFulfillmentEligibility()`), not a plain boolean, and both the invoice and customer activity timelines log it.

**Reason**: Requested directly, with two explicit constraints from the outset: (1) real physical packages for one invoice are not always exactly one shipment — a mis-typed tracking number, a split package, or a replaced label are all legitimate, recurring cases that a hard 1:1 model can't represent without either overwriting history or bolting on a parallel log table later; (2) a shipping label is real money spent through Shippo, so "is this invoice allowed to ship" needed to be one function checked in exactly one place — never trusting a client-side-only check, and never re-implemented slightly differently in a second call site later.

**Alternatives considered**: Keeping `Shipment` 1:1 and adding a separate `ShipmentHistory`/`ShipmentLabel` log table for anything beyond "the current shipment" (rejected — introduces two tables representing overlapping information, and every consumer of shipment data would need to know which one is authoritative for what); storing a `primaryShipmentId` pointer on `Invoice` instead of deriving it (rejected — a stored pointer can silently drift out of sync with reality, e.g. if a shipment is voided without the pointer being reassigned, whereas a pure derivation function is always correct by construction and is unit-testable with no database); scattering the "can this ship" check inline into the UI component and the purchase API route separately (rejected — exactly the kind of duplicated business rule that drifts the moment one call site is updated and the other isn't, for a check that gates spending real postage money).

**Benefits**: Every existing consumer of the old singular `invoice.shipment` (`lib/tracking/service.ts`, `lib/tracking/notifications.tsx`, the PDF's `ShipmentTrackingSection`, the admin tracking API route) was migrated by following `tsc --noEmit` compile errors as an exhaustive checklist, so nothing was missed silently. The Fulfillment Gate being one pure function (`computeFulfillmentEligibility`) plus one thin database-fetching wrapper (`checkFulfillmentEligibility`) meant the override-priority ordering (manual override beats paid-in-full beats active-arrangement beats nothing) could be verified with plain unit tests. Label purchase deliberately writes nothing to the database until Shippo confirms success, so a failed purchase never leaves a partial `Shipment` row, and the admin's entered package form is left untouched in local component state for an easy retry.

**Drawbacks**: `Shipment`'s label-purchase-specific fields (`shippoShipmentId`, `postageAmount`, `labelUrl`, weight/dimensions, etc.) are `null` for manually-entered tracking (`origin: MANUAL_ENTRY`) and only populated for a purchased label (`origin: LABEL_PURCHASE`) — a wider table than either use case alone needs, accepted since the two origins share every other field (carrier, tracking number, status, notifications) and a separate table per origin would have meant duplicating all of that tracking/notification machinery twice. Per-shipment UI actions (voiding, refreshing, resending an email for a *specific* non-primary shipment) were deliberately scoped to only the primary shipment for v1 — every shipment is visible and preserved, but only the current one has the full action set; expanding that is straightforward later since the data model already supports it.
