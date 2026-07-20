# Architecture — Invoice System

## Layer Responsibilities

```
app/admin/invoices/*           UI pages (server components — fetch data, pass to client components)
components/invoices/*          Presentational + interactive components (client)
lib/invoice/calculations.ts    Pure math — no I/O, no framework dependency
lib/invoice/validation.ts      zod schemas — payload shape + business rules
lib/invoice/numbering.ts       Sequential invoice number generation
lib/invoice/pdf/*              @react-pdf/renderer documents + shared brand constants
lib/invoices.ts                Data access — the ONLY module that queries Prisma for invoice data
lib/promotions.ts              Data access for the reusable Promotion catalog
app/api/admin/invoices/*       HTTP boundary — auth check, parse/validate, call lib/invoices.ts
prisma/schema.prisma           Source of truth for the data model
```

The rule that matters most: **UI components never call Prisma, and API routes never contain business logic.** An API route's job is: check `isAdmin`, parse the request, call a `lib/` function, return the result. If a route starts accumulating `if` statements around money or status, that logic belongs in `lib/invoice/calculations.ts` or `lib/invoices.ts` instead.

## Data Flow — Creating an Invoice

1. `app/admin/invoices/new/page.tsx` (server component) fetches the product catalog and active promotions, passes them as props to `InvoiceBuilder`.
2. `InvoiceBuilder` (client component) owns all form state. Every keystroke updates that state, which flows straight into `InvoicePreview` — no network round-trip, no reload. This is what the spec means by "live preview."
3. On Save, the full form state is POSTed to `/api/admin/invoices`.
4. The route validates the payload with `lib/invoice/validation.ts`, then calls `createInvoice()` in `lib/invoices.ts`.
5. `createInvoice()` generates the invoice number (`lib/invoice/numbering.ts`), runs the same calculation functions the preview used (`lib/invoice/calculations.ts`), and writes the Invoice + InvoiceItem + InvoiceDiscount rows in one Prisma call.
6. The route returns the created invoice; the UI redirects to `/admin/invoices/[id]`.

## Component Relationships

`InvoiceBuilder` is the composition root — it owns state and renders the section components (`CustomerInfoSection`, `ShippingSection`, `InvoiceItemsTable`, `DiscountsSection`, `PaymentSection`, `TotalsSummary`) plus `InvoicePreview` side-by-side. Section components are controlled: they receive their slice of state and an `onChange` callback, they never hold their own copy of the data. See [ComponentMap.md](./ComponentMap.md) for the full breakdown.

## PDF Generation Flow

`GET /api/admin/invoices/[id]/pdf?variant=master|recipient` → `lib/invoices.ts getInvoice()` → passes the invoice into either `MasterInvoiceDocument` or `RecipientReceiptDocument` (both in `lib/invoice/pdf/`) → `@react-pdf/renderer` streams the PDF back as the response body. Nothing is written to disk or blob storage (see [Decisions.md](./Decisions.md)).

## Invoice Lifecycle

```
DRAFT → PENDING → APPROVED → ISSUED → PARTIALLY_PAID → PAID
                                    ↘ CANCELLED / REFUNDED / VOID
```

`deliveryStatus` (PREPARING → PACKED → SHIPPED → IN_TRANSIT → DELIVERED, or RETURNED/LOST/DAMAGED) is tracked independently of invoice/payment status — a fully paid invoice can still be awaiting shipment, and vice versa.

## State Management

No global state library for the invoice module — `InvoiceBuilder`'s local React state is sufficient since the whole editing session lives on one page. (The existing `zustand` dependency is used elsewhere for the storefront cart; there was no reason to pull it into the admin builder too.)

## Future Database Integration

All persistence already routes through `lib/invoices.ts`. If storage ever needs to move off Postgres/Prisma (e.g. a dedicated invoicing service), that module is the only file that changes — API routes, pages, and components are unaffected.
