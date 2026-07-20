# Folder Structure — Invoice System

Only new/notably-extended folders are listed; everything else follows the existing project layout (see root `SETUP.md`).

```
app/
  admin/
    invoices/
      page.tsx            Dashboard: KPI stats + searchable/sortable table
      new/
        page.tsx           Create-invoice page (server component → InvoiceBuilder)
      [id]/
        page.tsx           Edit-invoice page (server component → InvoiceBuilder)
  api/
    admin/
      invoices/
        route.ts           GET (list) / POST (create)
        [id]/
          route.ts          GET / PATCH / DELETE (archive)
          payments/
            route.ts        POST (record payment)
          pdf/
            route.ts        GET ?variant=master|recipient — streams PDF
      promotions/
        route.ts           GET (list) / POST (create reusable promotion)

components/
  invoices/                One component per file, matches ComponentMap.md exactly

lib/
  invoices.ts              Data access — the only file that queries Prisma for Invoice/InvoiceItem/etc.
  promotions.ts            Data access for the Promotion catalog
  invoice/
    calculations.ts        Pure money math (no I/O)
    numbering.ts            Sequential invoice number generation
    validation.ts            zod schemas + business-rule guards
    pdf/
      brand.ts               Shared constants (logo, colors, fonts) for both PDF documents
      MasterInvoiceDocument.tsx
      RecipientReceiptDocument.tsx

prisma/
  schema.prisma            Invoice, InvoiceItem, Promotion, InvoiceDiscount, InvoicePayment models
  seed-invoices.ts         Manual sample-data seed (Marvin Alexander invoice + 7 promotions) — NOT run by default db:seed

docs/                      This folder — permanent project memory (see docs/README.md)
```

## Why this shape

- **`lib/invoice/` (business logic) is separate from `lib/invoices.ts` (data access)** — calculations and validation have zero dependency on Prisma or Next.js and can be unit-tested in isolation; `lib/invoices.ts` is the only place those pure functions meet the database.
- **`components/invoices/` mirrors the spec's named component list almost exactly** (InvoiceItemsTable, TotalsCard→TotalsSummary, etc.) so there's a direct line from spec to file.
- **API routes nest under `app/api/admin/invoices/`**, matching the existing `app/api/admin/orders/`, `app/api/admin/*` convention rather than inventing a new top-level API namespace.
- **No new top-level folders** (`/features`, `/services`, etc. from Part 1's suggested list) were introduced — the existing `app/lib/components` structure already covers everything needed, and Part 1 itself says "only introduce new folders when they improve organization."
