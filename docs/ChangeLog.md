# Change Log — Invoice System

Notable changes to the invoice module. Ordinary commits don't all need an entry here — this tracks changes future engineers would want a summary of before digging into `git log`.

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
