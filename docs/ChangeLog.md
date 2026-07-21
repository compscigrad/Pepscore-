# Change Log — Invoice System

Notable changes to the invoice module. Ordinary commits don't all need an entry here — this tracks changes future engineers would want a summary of before digging into `git log`.

## Unreleased — Larger PDF header logo

- Enlarged the header logo in `lib/invoice/pdf/shared.tsx` (`DocumentHeader`, shared by both `MasterInvoiceDocument` and `RecipientReceiptDocument`) from 140×94 to 306×204 — same 1.5 (3:2) aspect ratio as the 1536×1024 source image, so it's a pure scale-up with no distortion. Sized so its width now reads roughly level with the "MASTER INVOICE"/"CLIENT INVOICE" heading beneath it, rather than looking small above it.
- No other spacing/margins/positioning touched — the header block is simply taller by the same amount the logo grew, which pushes the title down proportionally (an unavoidable, expected consequence of a taller logo in a vertical header stack), everything else is unchanged.
- Verified: `tsc`/`eslint`/`next build` clean; rendered both PDF variants directly (bypassing HTTP/auth via a script calling the same `getInvoice`/`MasterInvoiceDocument`/`RecipientReceiptDocument` the route uses) against a typical invoice (Micaela Soto, single item) and the heaviest real one (Marvin Alexander, with a 4-installment payment arrangement) — both PDFs, both invoices, still exactly 1 page each; visually confirmed the enlarged logo isn't stretched and the legal footer stayed on page 1.

## Unreleased — Invoice Trash (soft-delete) with recoverable two-step permanent delete

- Added `Invoice.deletedAt`, a new "Delete" button on the invoice edit page header (two-click confirm), and an `/admin/invoices/trash` page listing soft-deleted invoices with Restore and Delete Forever actions.
- New `lib/invoices.ts` functions: `trashInvoice`, `restoreFromTrash`, `listTrashedInvoices`, `permanentlyDeleteInvoice` — the last of which refuses to run unless the invoice is already trashed, enforcing the "delete, then a separate final delete" flow at the data layer.
- New routes: PATCH `action: 'trash' | 'restore-from-trash'` on the existing `/api/admin/invoices/[id]` route; new `DELETE /api/admin/invoices/[id]/permanent`; new `GET /api/admin/invoices/trash`.
- `listInvoices` and `getInvoiceDashboardStats` now exclude trashed invoices unconditionally.
- Distinct from the existing Archive feature (`archivedAt`) — Archive keeps a completed invoice fully visible for records; Delete/Trash is for "I probably don't need this," hidden everywhere except the dedicated Trash page. See `docs/Decisions.md` #20.
- Verified: `tsc`/`eslint`/`next build` clean.

## Unreleased — Automated invoice archival (Paid → Archived after a configurable delay)

- Paid invoices now auto-archive a configurable number of days after `paidAt` (30/60/90/Never, default 30) via a daily Vercel Cron job (`GET /api/cron/archive-invoices`, `vercel.json` schedule `0 6 * * *`) that reuses the existing manual Archive (`archivedAt`) mechanism — no new archival code path for search/reporting/PDFs to keep in sync.
- Added `Settings → Invoices` (`/admin/settings/invoices`) to configure the delay, backed by a new one-row `InvoiceSettings` table and `/api/admin/invoice-settings` route.
- `paidAt` is now a live countdown anchor rather than a "set once" timestamp: `updateInvoice` refreshes it to now on every save that leaves the invoice fully paid (an edit resets the countdown) and clears it — un-archiving too, if applicable — the moment the invoice is reopened, its balance increases, or its status moves off `PAID`. `recordPayment` already refreshed it correctly on every transition into fully-paid.
- Replaced the invoice list's raw status dropdown with `All / Outstanding / Paid / Overdue / Archived` filters (`lib/invoices.ts`'s new `buildFilterClause`); a search term now searches active *and* archived invoices together, ignoring whichever filter is selected. This filter also now excludes trashed invoices, consistent with the Trash feature above.
- Dashboard's Revenue KPI now includes archived (fully-paid) invoices — an auto-archived invoice's revenue is exactly as real as an active one's. Outstanding balance and the operational KPIs (pending shipments, delivered) stay scoped to active invoices.
- **One real assumption**: "Overdue" has no true per-invoice due date to check in this data model (only `PaymentArrangementInstallment.dueDate`, for installment plans) — implemented as a pragmatic stand-in (unpaid + issued 30+ days ago). See `docs/Decisions.md` #21 if this needs to be replaced with a real due-date field later.
- **Deployment note**: `CRON_SECRET` must be set in Vercel's Production and Preview environment variables for the deployed cron trigger to authenticate — this wasn't something this session could set on the project's behalf.
- Verified: `tsc`/`eslint`/`next build` clean; the cron endpoint's auth (missing/wrong/correct `Authorization` header) and default 30-day setting were smoke-tested directly against the local dev server.

## Unreleased — ZIP code auto-population and "same as billing" shipping address sync

- Added `GET /api/admin/zip-lookup` (admin-gated proxy to the free/keyless Zippopotam.us API) and a shared `useZipLookup` client hook — entering a complete 5-digit ZIP in either the billing (`CustomerInfoSection`) or shipping (`ShippingSection`) address auto-fills city/state (both stay editable), tolerates a ZIP+4 suffix, shows a loading/error state inline, and never clears existing address data on a failed lookup.
- Added an "Address Line 2" input to both billing and shipping address blocks — the `street2` field already existed in the data model/PDF/zod validation but had no UI input until now; `InvoicePreview`'s Ship To display line was also fixed to include it (it was already rendered in the PDF via `formatAddress`, just missing from the live preview).
- Added a "Same as billing address" checkbox to `ShippingSection`. While checked, editing the billing address live-syncs into shipping and the shipping address sub-fields (street1/street2/city/state/zip) render disabled — carrier/tracking/cost/dates/delivery status stay independently editable. Unchecking preserves the last-synced values as an independent starting point rather than clearing them; re-checking replaces shipping with whatever billing currently holds. This flag is ephemeral `useState` in `InvoiceBuilder`, not part of the saved `InvoiceDraft` — see `docs/Decisions.md` #19.
- Verified: `tsc`/`eslint`/`next build` clean; live-tested all 8 scenarios from the spec (valid/invalid ZIP lookups on both address blocks, checkbox copy/sync/lock, uncheck-preserves/recheck-replaces, save+reload of a new invoice with the synced address, and load of a pre-existing invoice created before this feature — no regression).

## Unreleased — PDF layout: fit a typical invoice on one page, rename Recipient Receipt to Client Invoice

- Tightened page margins, header logo size, and section/table spacing throughout `lib/invoice/pdf/shared.tsx` so a typical invoice (a few items, a payment history or arrangement, the legal footer) renders on exactly one LETTER page instead of two.
- Root-caused the actual overflow bug: `LegalFooter`'s `wrap={false}` was on the whole footer, so it jumped *entirely* to page 2 whenever even a few points short of fitting — moved `wrap={false}` down to each individual legal clause instead, so the footer fills remaining space on the current page and only a clause that doesn't fit (never split mid-paragraph) moves on. See `docs/Decisions.md` #18.
- Master Invoice no longer shows a separate Payment History table when a payment arrangement exists — the arrangement's own schedule table already lists every payment as "Payment N," so both together just repeated the same rows.
- Renamed the customer-facing PDF's visible header from "Receipt" to **"Client Invoice"** (document title, download button label, and the Invoice Status helper text all updated to match) — the underlying `RecipientReceiptDocument`/`variant=recipient` identifiers are unchanged, only user-visible text.
- Verified empirically (rendering real and representative invoices, counting actual PDF page objects, not guessing): no-arrangement, single-payment, and payment-plus-4-installment-arrangement scenarios (matching the real Marvin Alexander sample) all now render as exactly 1 page for both PDFs; a deliberately extreme scenario (full contact info, two long notes, an arrangement) still uses 2 pages, but only because page 1 is already genuinely full — legitimate overflow, not a stranded footer.

## Unreleased — Payment arrangements available on any invoice, not just Partial ones

- `PaymentArrangementSection` no longer requires an invoice to already have a payment before an arrangement can be set up — the "+ Set Up Payment Arrangement" option now shows on any invoice with `balanceDue > 0` (Draft/Pending included), so it's uniformly available "just in case" rather than only after a payment happens to already exist.
- For invoices with no payment yet, the form asks for a **Start Date** (there's no history to derive one from) instead of showing read-only Initial Payment Amount/Date; the entire schedule is generated fresh from that date, with every installment created `PENDING` — the first real payment recorded through the normal Record Payment flow satisfies installment #1 automatically via the existing `matchPaymentToNextPendingInstallment()`.
- `generateInstallmentSchedule()` generalized to take a `firstDueDate` (the due date of the first installment it generates) and a `startInstallmentNumber`, so the same function serves both the has-a-payment case (installments #2+, anchored one interval after the existing payment) and the no-payment-yet case (installments #1+, anchored on the chosen start date). See `docs/Decisions.md` #16 (updated).
- Verified: `tsc`/`eslint` clean; live-tested both paths — a fresh Draft invoice with $0 paid (schedule correctly split the full total starting today) and the existing Partially Paid sample invoice (unchanged behavior, re-verified no regression).

## Unreleased — Payment arrangements (installment plans)

- Extended `PaymentMethod` (schema + validation + the picker) with `NA` (new default), `DEBIT_CARD`, `PAYPAL`, `BANK_TRANSFER` — existing values kept, per the "at minimum" requirement.
- Added a computed **Payment Status** (Pending/Partial/Paid) shown as a badge in `PaymentSection` — derived from `amountPaid`/`total`, never stored, and distinct from the existing `InvoiceStatus` workflow field (which is untouched). See `docs/Decisions.md` #17.
- New `PaymentArrangement`/`PaymentArrangementInstallment` models (real relational rows, not JSON — see `docs/Decisions.md` #15) support setting up an installment plan once an invoice is Partial: `components/invoices/PaymentArrangementSection.tsx` shows a "+ Set Up Payment Arrangement" form (Number of Remaining Payments + Frequency, with a live schedule preview using the same `generateInstallmentSchedule()` the server uses) or, once created, the full schedule + summary stats.
- `lib/invoice/paymentArrangement.ts` — pure schedule-generation math: splits the remaining balance evenly across the chosen frequency (Every Week / Every Two Weeks), with the final installment absorbing any rounding remainder so the schedule always sums to exactly the remaining balance.
- `lib/paymentArrangements.ts` — `createPaymentArrangement()` derives the "initial payment" info from the invoice's existing payment history rather than recording a new transaction (see `docs/Decisions.md` #16); `matchPaymentToNextPendingInstallment()`, wired into `lib/invoices.ts`'s `recordPayment()`, marks the next pending installment paid whenever any payment is recorded on an invoice with an arrangement.
- New `POST /api/admin/invoices/[id]/payment-arrangement` route.
- PDF: `MasterInvoiceDocument` gets a full "Payment Arrangement" table (Payment #/Due Date/Amount/Status) plus a summary (Original Total/Payments Received/Remaining Balance/Next Payment Due/Frequency); `RecipientReceiptDocument` gets a customer-facing subset only (Remaining Balance, Next Payment Due, Upcoming Payment Schedule) — no internal notes or full payment history.
- Verified: `npx tsc --noEmit`, `npx eslint`, `npm run build` all clean; scripted schedule generation against the spec's own example (July 20 initial → Aug 3/17/31 biweekly, all $250, matches exactly) and a rounding edge case ($100 / 3 → $33.33/$33.33/$33.34, sums to exactly $100.00); rendered both PDFs with a mock arrangement and confirmed the no-arrangement case still renders correctly.

## Unreleased — Product pricing audit + picker fix

- Corrected Tesamorelin 1-box prices in `prisma/seed.ts` (5mg: $312 → $400, 10mg: $531 → $750) and reseeded the shared database. Audited all other ~119 catalog products against the current master price sheet — everything else already matched exactly.
- Deleted one stale, unreferenced duplicate product (`cjc1295-ipamorelin-10mg`, $50 with inverted bulk pricing) superseded by the current `cjc1295-ipa-10mg` ($297).
- Fixed a real bug in `InvoiceItemsTable.tsx`'s product picker: it matched (and saved) on the bare product `name`, which the catalog reuses across strengths (e.g. "Tesamorelin" 5mg/10mg) — selection could silently resolve to the wrong same-named row, and the mg strength was dropped from the saved line item regardless. Added `formatProductLabel()` (`lib/invoice/format.ts`) producing a unique `Name — Size — 1 Box` label used for both the dropdown options and the persisted line-item name, so the dropdown, live preview, and PDF always show the same, unambiguous text. See `docs/Decisions.md` #13, #14.
- Verified: `npx tsc --noEmit`, `npx eslint`, `npm run build` all clean; scripted the picker's matching logic against the live database (confirmed zero duplicate composed labels across all 119 products, Tesamorelin 5mg/10mg resolve to $400/$750) and rendered a two-line-item Master Invoice PDF confirming both product names (with strength) and the $1,150 subtotal.

## Unreleased — Branding refresh (`feature/invoice-branding-refresh`)

UI/UX and PDF-presentation enhancement only — no changes to business logic, calculations, data model, routing, or auth. Scoped to `app/admin/invoices/**`, `components/invoices/**`, `lib/invoice/pdf/**`.

- Added `lib/invoice/legal.ts` (`INVOICE_LEGAL_SECTIONS`) — centralized RUO and Customer-Responsibility-After-Delivery legal copy, previously not present in either PDF.
- Added `LegalFooter` to `lib/invoice/pdf/shared.tsx`, shared by both `MasterInvoiceDocument.tsx` and `RecipientReceiptDocument.tsx`, replacing the old one-line `fixed` `DocumentFooter`. Renders in normal document flow (never `fixed`) so it can't overlap totals by construction. See `docs/Decisions.md` #11.
- PDF accent polish: small gold accent bar under the document title, a bordered/tinted status badge under the invoice number (gold only for `PAID`), a thin gold underline on the Bill To / Ship To section labels. See `docs/Decisions.md` #12.
- Added `components/invoices/theme.ts` — centralized Tailwind class tokens for the dashboard/builder's dark theme, removing the `inputClass`/`labelClass` duplication previously repeated across `CustomerInfoSection`, `ShippingSection`, `InvoiceItemsTable`, `DiscountsSection`, and `PaymentSection`.
- Converted the invoice dashboard (`app/admin/invoices/page.tsx`, `InvoiceDashboardStats`, `InvoiceTable`) and builder (all section components, both page shells, `InvoiceHeaderActions`, `PDFExportButtons`) to the landing page's actual dark theme (black background, hairline-bordered glass cards) — see `docs/Decisions.md` #10. `InvoicePreview.tsx` deliberately stays a white card, since it represents the literal white PDF page.
- Converted `StatusBadge.tsx` to an outline-plus-tint pill style suited to the dark background, in place of the old solid-fill light-theme chips.
- Verified: `npx tsc --noEmit`, `npx eslint`, and `npm run build` all clean; both PDFs re-rendered locally against the seeded sample invoice data with no runtime errors.

## Unreleased — Initial build (`feature/invoice-system`)

- Extended `Invoice` Prisma model to stand alone from `Order` (optional `orderId`), added customer/shipping/financial fields directly on the model.
- Added `InvoiceItem`, `Promotion`, `InvoiceDiscount`, `InvoicePayment` models and their supporting enums (`ShippingCarrier`, `DeliveryStatus`, `PromotionType`, `PaymentMethod`). All `InvoiceStatus` changes are additive.
- Added `lib/invoice/calculations.ts`, `numbering.ts`, `validation.ts` — pure business logic, no framework dependency.
- Added `lib/invoices.ts` and `lib/promotions.ts` as the sole Prisma-facing data-access layer for the module.
- Added `prisma/seed-invoices.ts` (manual seed) reproducing the spec's Marvin Alexander sample invoice and the 7 example promotions — verified totals match the spec exactly ($814 total / $214 balance).
- Added `docs/` — this documentation system.
- Added `app/api/admin/invoices/**`, `app/api/admin/promotions` — CRUD, payment recording, PDF streaming, promotion catalog.
- Fixed the existing Stripe checkout invoice creation (`app/api/checkout/route.ts`), which broke once `Invoice` gained required customer/financial fields.
- Added `lib/invoice/pdf/` (`MasterInvoiceDocument`, `RecipientReceiptDocument`, shared layout/brand constants) using `@react-pdf/renderer`. Found and fixed two bugs while smoke-testing against the seeded sample invoice: the logo failing to embed (needed a base64 data URI, not a bare filesystem path) and payment/delivery dates rendering a day early (local-timezone formatting of UTC-midnight dates — fixed by forcing UTC in `lib/invoice/format.ts`, shared by both the PDFs and the live preview).
- Added the invoice dashboard (`app/admin/invoices`, `InvoiceDashboardStats`, `InvoiceTable`) and the invoice builder (`InvoiceBuilder` + all section components + `InvoicePreview`) at `app/admin/invoices/new` and `app/admin/invoices/[id]`.
- Verified: `npx tsc --noEmit` clean across the whole project; dev server boots and all new routes/API endpoints respond correctly (redirect under the admin auth gate, no server errors); PDF output visually inspected against the sample invoice. Full interactive click-through of the builder UI was not performed — that requires signing in as the real Clerk admin user.

## PR #1 preview troubleshooting

- **Root cause of the "Internal Error" on the Vercel preview**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ADMIN_CLERK_USER_ID`, `DATABASE_URL`, and `DIRECT_URL` were only enabled for the Production environment in Vercel, not Preview — this is the first PR/branch ever deployed as a Preview that actually needed them (`landing`, the only prior Preview traffic, has no Clerk/Prisma dependency). `clerkMiddleware()` needs the publishable key just to initialize, so it 500'd on every single request, not just admin routes. Fixed by adding Preview scope to all five variables in the Vercel dashboard. Preview and Production now share one Neon database (deliberate choice, not a default — see `docs/Decisions.md`).
- Added a visible **Admin** link in the site header (`components/storefront/ClerkAuthButtons.tsx`, new `app/api/admin/whoami` route) — the invoice dashboard was previously only reachable by typing the URL directly.
- Fixed the invoice logo: PDFs and the live preview were using the site's old pre-rebrand `logo.png`. Added a dedicated `public/images/invoice-logo.jpeg` (the asset actually named in the original spec's placeholder comment) and switched the PDF/preview header to a centered logo-above-title layout matching the owner's reference invoice.
- Fixed `eslint.config.mjs`: `eslint-config-next@16.2.6` ships native flat-config, but the file was routing it through `FlatCompat.extends()` (a legacy-eslintrc shim), which crashed on `eslint .`. Fixed by importing the flat exports directly — see `docs/Decisions.md` #9. Fixing it surfaced and resolved 4 real findings in this PR's code.
- End-to-end tested the full workflow on the live Preview deployment itself (not just locally): create → live-preview updates → save → reload → edit items/discounts → record payment → duplicate → archive/restore → both PDFs → dashboard search/sort/filter/stats accuracy. All passed; test data cleaned up (archived) afterward.
