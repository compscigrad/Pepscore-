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
