# Change Log — Invoice System

Notable changes to the invoice module. Ordinary commits don't all need an entry here — this tracks changes future engineers would want a summary of before digging into `git log`.

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
