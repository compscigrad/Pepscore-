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
**Purpose**: Captures name, company, phone, email, billing address (including Address Line 2), internal/public notes. The billing ZIP field is wired through `useZipLookup` to auto-populate city/state.
**Props**: `value: CustomerFields`, `onChange: (value: CustomerFields) => void`, `errors?: FieldErrors`.
**Dependencies**: `useZipLookup.ts`.

### `ShippingSection.tsx`
**Purpose**: Captures shipping address (including Address Line 2), carrier, tracking number, cost, ship/delivery dates, delivery status. Shipping ZIP is wired through `useZipLookup` the same way as billing. Renders the "Same as billing address" checkbox; while checked, the address sub-fields (street1/street2/city/state/zip) are disabled and driven by `InvoiceBuilder`'s cross-section sync — carrier/tracking/cost/dates/delivery status stay independently editable regardless.
**Props**: `value: ShippingFields`, `onChange`, `sameAsBilling: boolean`, `onSameAsBillingChange: (checked: boolean) => void`, `errors?`.
**Dependencies**: `ShippingCarrier` / `DeliveryStatus` enums from Prisma client, `useZipLookup.ts`.

### `useZipLookup.ts`
**Purpose**: Shared hook for ZIP → city/state auto-fill, used identically by `CustomerInfoSection` (billing) and `ShippingSection` (shipping). Debounces to the first complete 5-digit ZIP (tolerates a ZIP+4 suffix without re-fetching per keystroke), exposes `status`/`message` for a loading/error indicator near the field, and never clears existing address data on a failed lookup.
**Dependencies**: `/api/admin/zip-lookup` route.

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
**Purpose**: Shows payment history, a computed Payment Status badge (Pending/Partial/Paid — derived from `amountPaid`/`total`, never stored), lets the admin record a new payment against the balance, and renders `PaymentArrangementSection` beneath it.
**Props**: `invoiceId: string`, `payments: InvoicePayment[]`, `amountPaid: number`, `total: number`, `balanceDue: number`, `paymentArrangement: (PaymentArrangement & { installments }) | null`, `onPaymentRecorded: () => void`.
**Dependencies**: `/api/admin/invoices/[id]/payments` route, `lib/invoice/paymentArrangement.ts` (`computePaymentStatus`).
**Note**: only rendered in edit mode (an unsaved draft has no invoice ID to attach a payment to). Method dropdown defaults to `NA` — submission is blocked while it's still selected.

### `PaymentArrangementSection.tsx`
**Purpose**: Installment-plan setup and display. Shows a "+ Set Up Payment Arrangement" form only when Payment Status is Partial and no arrangement exists yet (live-previews the generated schedule as the admin types); once an arrangement exists, shows its full schedule table + summary regardless of current status.
**Props**: `invoiceId: string`, `arrangement`, `canCreate: boolean`, `invoiceTotal`, `amountPaid`, `balanceDue`, `payments: InvoicePayment[]`, `onArrangementCreated: () => void`.
**Dependencies**: `/api/admin/invoices/[id]/payment-arrangement` route, `lib/invoice/paymentArrangement.ts` (`generateInstallmentSchedule`) for the live client-side preview — the exact same function the server uses, so the preview never disagrees with what actually gets saved.

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

### `InvoiceHeaderActions.tsx`
**Purpose**: Duplicate / Archive-or-Restore / Delete actions on the invoice edit page header. Delete uses a two-click confirm (first click arms it for 4s, second click sends the request) rather than a native `confirm()` dialog, matching this UI's toast-driven conventions — moves the invoice to Trash (`deletedAt` set), it is not a hard delete.
**Props**: `invoiceId: string`, `archived: boolean`.
**Dependencies**: `/api/admin/invoices/[id]` PATCH (`action: 'trash' | 'restore' | 'duplicate'`), `/api/admin/invoices/[id]` DELETE (archive).

### `TrashTable.tsx`
**Purpose**: Lists soft-deleted invoices (`app/admin/invoices/trash`). Restore clears `deletedAt` and returns the invoice to the normal list. "Delete Forever" is a second, separately-confirmed two-click action that calls the permanent-delete route — genuinely unrecoverable, so it's the only action in the invoice module that removes a row rather than flipping a flag.
**Props**: `initialInvoices: { id, invoiceNumber, customerName, total, status, deletedAt }[]`.
**Dependencies**: `/api/admin/invoices/[id]` PATCH (`action: 'restore-from-trash'`), `/api/admin/invoices/[id]/permanent` DELETE.

### `InvoiceTable.tsx`
**Purpose**: Dashboard list — search box, column-header sorting, status filter, pagination.
**Props**: `initialInvoices`, `initialTotal`.
**Dependencies**: `/api/admin/invoices` (GET) for search/sort/filter re-fetches, `StatusBadge`, `formatCurrency`.

### `InvoiceDashboardStats.tsx`
**Purpose**: KPI card row (total/paid/partial/outstanding/pending shipments/delivered/revenue).
**Props**: `stats: InvoiceDashboardStats` (from `lib/invoices.ts getInvoiceDashboardStats`).
**Dependencies**: none — pure presentational, follows the KPI card pattern already in `app/admin/page.tsx`.

## `lib/` — payment arrangements

### `lib/invoice/paymentArrangement.ts`
**Purpose**: Pure, framework-agnostic business logic — `generateInstallmentSchedule()` (weekly/biweekly date math, final-installment rounding correction) and `computePaymentStatus()` (Pending/Partial/Paid, derived from `amountPaid`/`total`). Imported client-side (for the builder's live schedule preview) and server-side (`lib/paymentArrangements.ts`), so the preview and the persisted schedule are always the same calculation.

### `lib/paymentArrangements.ts`
**Purpose**: Data access for `PaymentArrangement`/`PaymentArrangementInstallment` — `createPaymentArrangement()` (derives "Initial Payment Amount/Date" from the invoice's own payment history, generates and persists the future schedule) and `matchPaymentToNextPendingInstallment()` (called from `lib/invoices.ts`'s `recordPayment()` — any payment on an invoice with an arrangement satisfies the earliest pending installment). Deliberately never touches `Invoice.amountPaid`/`balanceDue` itself — those stay owned by `lib/invoices.ts`.

## Reuse from the existing codebase

- `formatCurrency` — `lib/orders.ts`
- Admin auth gate pattern (`userId === process.env.ADMIN_CLERK_USER_ID`) — `app/admin/page.tsx`, `app/api/admin/invoices/route.ts`
- `react-hot-toast` for success/error feedback — already used in `AdminOrdersTable.tsx`
- KPI card and table styling conventions — `app/admin/page.tsx`
