# Component Map — Invoice System

## `components/invoices/`

### `theme.ts`
**Purpose**: Shared Tailwind class-string tokens for the invoice dashboard/builder's dark theme (`card`, `input`, `label`, `sectionHeading`, `pillPrimary`, `pillSecondary`, `pillOutline`, `divider`, `mutedText`) — every form section and the dashboard/table import from here instead of redefining the same class strings locally. Not a component; exports plain strings. See `docs/UIUXGuidelines.md` and `docs/Decisions.md` #10.
**Dependencies**: none.

### `InvoiceBuilder.tsx`
**Purpose**: Composition root for creating/editing an invoice. Owns all form state in one place so the live preview always reflects the current draft.
**Props**: `mode: 'create' | 'edit'`, `initialInvoice?: InvoiceWithRelations`, `products: Product[]`, `promotions: Promotion[]`.
**Dependencies**: all section components below, `InvoicePreview`, `lib/invoice/calculations.ts` (to derive totals for display before save), `lib/invoice/validation.ts` (client-side pre-check before POST).
**Future improvements**: autosave drafts; multi-shipping-address support once that data model lands.

### `CustomerInfoSection.tsx`
**Purpose**: Captures name, company, phone, email, billing address, internal/public notes.
**Props**: `value: CustomerFields`, `onChange: (value: CustomerFields) => void`, `errors?: FieldErrors`.
**Dependencies**: none beyond shared form primitives.

### `ShippingSection.tsx`
**Purpose**: Captures shipping address, carrier, tracking number, cost, ship/delivery dates, delivery status.
**Props**: `value: ShippingFields`, `onChange`, `errors?`.
**Dependencies**: `ShippingCarrier` / `DeliveryStatus` enums from Prisma client.

### `InvoiceItemsTable.tsx`
**Purpose**: Unlimited-row line-item editor — add, duplicate, delete, reorder, inline-edit. Recalculates line totals as the user types.
**Props**: `items: InvoiceItemDraft[]`, `onChange`, `products: Product[]` (for the autocomplete — items don't require a catalog match).
**Dependencies**: `lib/invoice/calculations.ts` (`lineItemTotal`).
**Future improvements**: drag-handle reordering (currently up/down buttons); SKU column once inventory exists.

### `DiscountsSection.tsx`
**Purpose**: Apply one or more promotions (from the reusable catalog) and/or ad-hoc discounts.
**Props**: `discounts: InvoiceDiscountDraft[]`, `onChange`, `promotions: Promotion[]`, `itemsTotal: number` (to preview resolved $ amounts for percentage discounts).
**Dependencies**: `lib/invoice/calculations.ts` (`resolveDiscountAmount`).

### `PaymentSection.tsx`
**Purpose**: Shows payment history and lets the admin record a new payment against the balance.
**Props**: `invoiceId: string`, `payments: InvoicePayment[]`, `balanceDue: number`, `onPaymentRecorded: (invoice) => void`.
**Dependencies**: `/api/admin/invoices/[id]/payments` route.
**Note**: only rendered in edit mode (an unsaved draft has no invoice ID to attach a payment to).

### `TotalsSummary.tsx`
**Purpose**: Read-only display of items total, subtotal, discount total, shipping, final total, amount paid, balance due.
**Props**: `totals: InvoiceTotals` (from `lib/invoice/calculations.ts`).
**Dependencies**: `lib/orders.ts formatCurrency`.

### `InvoicePreview.tsx`
**Purpose**: Live, styled rendering of the invoice as the customer/admin will see it — styled with Tailwind using the same values as `lib/invoice/pdf/brand.ts` so it stays visually close to the generated PDF.
**Props**: full invoice draft + computed totals.
**Dependencies**: `StatusBadge`, `formatCurrency`.

### `StatusBadge.tsx`
**Purpose**: Shared status pill for invoice status and delivery status — one component, two color maps, so status styling never needs reinventing per table. Outline-plus-tint style (border + low-opacity fill, not a solid chip) to read clearly against the dashboard's black background; `PAID`/`DELIVERED` get the gold accent, every other status stays neutral gray-scale.
**Props**: `status: string`, `variant: 'invoice' | 'delivery'`.
**Dependencies**: none. Follows the existing `STATUS_COLORS` object pattern from `components/admin/AdminOrdersTable.tsx`, adapted for a dark surface.

### `PDFExportButtons.tsx`
**Purpose**: Two buttons ("Download Master Invoice", "Download Recipient Receipt") linking to the PDF API route.
**Props**: `invoiceId: string`.
**Dependencies**: none — plain links to `/api/admin/invoices/[id]/pdf?variant=...`.

### `InvoiceTable.tsx`
**Purpose**: Dashboard list — search box, column-header sorting, status filter, pagination.
**Props**: `initialInvoices`, `initialTotal`.
**Dependencies**: `/api/admin/invoices` (GET) for search/sort/filter re-fetches, `StatusBadge`, `formatCurrency`.

### `InvoiceDashboardStats.tsx`
**Purpose**: KPI card row (total/paid/partial/outstanding/pending shipments/delivered/revenue).
**Props**: `stats: InvoiceDashboardStats` (from `lib/invoices.ts getInvoiceDashboardStats`).
**Dependencies**: none — pure presentational, follows the KPI card pattern already in `app/admin/page.tsx`.

## Reuse from the existing codebase

- `formatCurrency` — `lib/orders.ts`
- Admin auth gate pattern (`userId === process.env.ADMIN_CLERK_USER_ID`) — `app/admin/page.tsx`, `app/api/admin/invoices/route.ts`
- `react-hot-toast` for success/error feedback — already used in `AdminOrdersTable.tsx`
- KPI card and table styling conventions — `app/admin/page.tsx`
