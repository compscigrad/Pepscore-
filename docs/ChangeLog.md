# Change Log — Invoice System

Notable changes to the invoice module. Ordinary commits don't all need an entry here — this tracks changes future engineers would want a summary of before digging into `git log`.

## Unreleased — Initial build (`feature/invoice-system`)

- Extended `Invoice` Prisma model to stand alone from `Order` (optional `orderId`), added customer/shipping/financial fields directly on the model.
- Added `InvoiceItem`, `Promotion`, `InvoiceDiscount`, `InvoicePayment` models and their supporting enums (`ShippingCarrier`, `DeliveryStatus`, `PromotionType`, `PaymentMethod`). All `InvoiceStatus` changes are additive.
- Added `lib/invoice/calculations.ts`, `numbering.ts`, `validation.ts` — pure business logic, no framework dependency.
- Added `lib/invoices.ts` and `lib/promotions.ts` as the sole Prisma-facing data-access layer for the module.
- Added `prisma/seed-invoices.ts` (manual seed) reproducing the spec's Marvin Alexander sample invoice and the 7 example promotions — verified totals match the spec exactly ($814 total / $214 balance).
- Added `docs/` — this documentation system.
- *(subsequent entries added as the API routes, dashboard, builder UI, and PDF generation land)*
