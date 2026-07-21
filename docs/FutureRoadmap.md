# Future Roadmap

Modules and capabilities named in Part 1's "Future Expansion" section, not yet built. None of the current invoice-system architecture should require a rewrite to add these — that constraint drove several of the decisions in [Decisions.md](./Decisions.md) (e.g. the `lib/invoices.ts` service seam, additive-only enums).

## Near-term (natural extensions of what exists)

- **Dark-theme the rest of `/admin`** — the invoice dashboard/builder now matches the landing page's black/glass theme (see `docs/Decisions.md` #10), but the base admin dashboard and orders table are still on the older light `cream`/`g100` theme, leaving a visible seam at the `/admin` → `/admin/invoices` boundary. Extending `components/invoices/theme.ts`'s tokens (or promoting them to a shared, non-invoice-specific location) to the rest of `/admin` would close that gap.
- **Packing Slips** — same `InvoiceItem` data, a third PDF document variant alongside Master/Recipient.
- **Quotes** — an `InvoiceStatus` of `DRAFT`/`PENDING` already covers "not yet a real sale"; a Quote could literally be an unconverted Invoice, or a thin sibling model that converts into one.
- **CSV / Excel export** — `xlsx` is already a project dependency (used by the CPA export); extending it to invoices is additive.
- **JSON export** — trivial once the data model is stable; mostly a route + `JSON.stringify` of `getInvoice()`.

## Medium-term

- **Customer CRM** — promote the customer fields currently snapshotted on each `Invoice` into a real `Customer` model, with `Invoice.customerId` replacing the duplicated name/email/phone columns (kept as a snapshot for historical accuracy even after the CRM exists).
- **Inventory Management** — `InvoiceItem.productId` already links optionally to `Product`; adding stock tracking to `Product` and decrementing on invoice creation is additive.
- **Multiple shipping addresses per customer** — once a `Customer` model exists, addresses move from inline JSON on `Invoice` to a proper `Address` model with a customer relation.
- **Recurring Invoices** — a `RecurringInvoiceTemplate` model that periodically calls the existing `createInvoice()` service function.
- **Analytics Dashboard** — `getInvoiceDashboardStats()` in `lib/invoices.ts` is already the seam; a dedicated analytics page would extend that function rather than querying Prisma directly.
- **Barcode / QR Code Generation** — printed on the PDF documents; would live in `lib/invoice/pdf/` alongside the existing document components.

## Longer-term

- **Wholesale / Clinic Accounts** — likely a `Role`/account-type extension on the existing `User` model plus wholesale-specific pricing, reusing the `Promotion` percentage-discount mechanism already built.
- **Purchase Orders** — inverse of an Invoice (money out vs. money in); could reuse `InvoiceItem`'s shape as `PurchaseOrderItem`.
- **Subscription Billing** — would sit alongside Stripe Checkout, generating recurring Invoices via the same `createInvoice()` path.
- **Email Integration** — Resend is already a project dependency (used for order confirmations); sending the Recipient Receipt PDF via email is a matter of piping the existing PDF stream into a Resend attachment.
- **Stripe / Square / QuickBooks / Shipping API integrations** — the standalone invoice model (`orderId` optional) was specifically designed so these can attach without forcing every invoice through a Stripe/Square order first.

## Explicitly deferred (per spec's own "(future)" markers)

- Tax calculation
- Chargeback payment status
- Crypto payment method (enum value exists; no processor integration)
- Discount expiration dates
- SKU column on invoice line items
