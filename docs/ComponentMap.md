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
**Purpose**: Two download links ("Download Master Invoice", "Download Client Invoice") plus a manual "Email Invoice to Customer" button — always sends/resends the Client Invoice PDF regardless of whether the automatic one-time send already fired. Disabled with a tooltip when there's no `customerEmail` on file.
**Props**: `invoiceId: string`, `customerEmail?: string | null`.
**Dependencies**: plain links to `/api/admin/invoices/[id]/pdf?variant=...`; the email button calls `POST /api/admin/invoices/[id]/email`.

### `InvoiceSettingsForm.tsx`
**Purpose**: Radio-button form (30/60/90 Days, Never) for the auto-archive delay, on `app/admin/settings/invoices`.
**Props**: `initialArchiveAfterDays: number | null`.
**Dependencies**: `/api/admin/invoice-settings` PATCH.

### `InvoiceEmailSettingsForm.tsx`
**Purpose**: Single on/off toggle for automatically emailing the Client Invoice PDF the first time an invoice reaches Issued/Paid/Partially Paid, also on `app/admin/settings/invoices`. Off only disables the automatic trigger — the manual "Email Invoice to Customer" button always works.
**Props**: `initialEnabled: boolean`.
**Dependencies**: `/api/admin/invoice-settings` PATCH.

### `PaymentReceivedEmailSettingsForm.tsx`
**Purpose**: Single on/off toggle for automatically emailing the customer a "Payment Received" confirmation (with the updated invoice PDF attached) every time a payment is recorded, also on `app/admin/settings/invoices`.
**Props**: `initialEnabled: boolean`.
**Dependencies**: `/api/admin/invoice-settings` PATCH.

### `FulfillmentSettingsForm.tsx`
**Purpose**: Return address and default package weight/dimensions/carrier for label purchase, on `app/admin/settings/fulfillment`. Mirrors `InvoiceEmailSettingsForm.tsx`'s local-state/PATCH/toast pattern. A missing return address is what `lib/fulfillment/labels.ts`'s `getShippingRatesForInvoice()` rejects on before ever calling Shippo.
**Props**: `initialSettings: FulfillmentSettingsData`.
**Dependencies**: `/api/admin/fulfillment-settings` GET/PATCH.

### `PackagePresetsForm.tsx`
**Purpose**: CRUD list of named, reusable package templates (weight + dimensions, e.g. "Small Box"/"Padded Envelope"), also on `app/admin/settings/fulfillment` — mirrors the existing `Promotion` list-management pattern. Selecting a preset in `ShipmentsSection.tsx`'s label-purchase panel pre-fills the weight/dimension inputs, which stay editable afterward.
**Props**: `initialPresets: PackagePreset[]`.
**Dependencies**: `/api/admin/package-presets` GET/POST, `/api/admin/package-presets/[id]` PATCH/DELETE.

### `TrackingNotificationSettingsForm.tsx`
**Purpose**: Per-`ShippingStatus` checkboxes (the 8 notifiable statuses) for enabling/disabling customer shipment emails, also on `app/admin/settings/invoices`. A status missing from the saved map defaults to checked/enabled, mirroring `lib/invoiceSettings.ts`'s `isNotificationEnabled` default.
**Props**: `initialEnabled: Partial<Record<ShippingStatus, boolean>>`.
**Dependencies**: `/api/admin/invoice-settings` PATCH.

### `ShipmentsSection.tsx`
**Purpose**: Replaces `TrackingSection.tsx` now that `Shipment` is one-to-many (`docs/Decisions.md` #24). Edit-mode only (same reasoning as `PaymentSection`). Renders every shipment for the invoice newest-first — the derived primary is marked "Current" with the full action set (Refresh, Mark Delivered, Resend Last Email, Stop Monitoring, Override Status); every non-voided shipment (primary or not) gets a two-click "Void Shipment" button; voided shipments stay listed, dimmed, never removed. Keeps the existing manual "Add Tracking Manually" form unchanged. Adds a "Create Shipping Label" panel: a Fulfillment Gate eligibility banner (with a two-click "Fulfill Anyway" override when ineligible), a package-preset dropdown, weight/dimension inputs, a "Get Rates" step, a rate radio-list, and "Purchase Label" — on success opens the label PDF via `window.open`.
**Props**: `invoiceId: string`, `shipments: (Shipment & { events: TrackingEvent[] })[]`, `onTrackingUpdated: () => void`.
**Dependencies**: `/api/admin/invoices/[id]/tracking` (POST add, PATCH actions, DELETE remove), `/api/admin/invoices/[id]/fulfillment/eligibility` (GET), `/api/admin/invoices/[id]/fulfillment/override` (POST), `/api/admin/invoices/[id]/shipments/rates` (GET), `/api/admin/invoices/[id]/shipments` (POST purchase), `/api/admin/invoices/[id]/shipments/[shipmentId]/void` (POST), `/api/admin/package-presets` (GET), `lib/shipments/primary.ts` (to determine which shipment is primary for display).

### `InvoiceHeaderActions.tsx`
**Purpose**: Duplicate / Archive-or-Restore / Delete actions on the invoice edit page header. Delete uses a two-click confirm (first click arms it for 4s, second click sends the request) rather than a native `confirm()` dialog, matching this UI's toast-driven conventions — moves the invoice to Trash (`deletedAt` set), it is not a hard delete.
**Props**: `invoiceId: string`, `archived: boolean`.
**Dependencies**: `/api/admin/invoices/[id]` PATCH (`action: 'trash' | 'restore' | 'duplicate'`), `/api/admin/invoices/[id]` DELETE (archive).

### `TrashTable.tsx`
**Purpose**: Lists soft-deleted invoices (`app/admin/invoices/trash`). Restore clears `deletedAt` and returns the invoice to the normal list. "Delete Forever" is a second, separately-confirmed two-click action that calls the permanent-delete route — genuinely unrecoverable, so it's the only action in the invoice module that removes a row rather than flipping a flag.
**Props**: `initialInvoices: { id, invoiceNumber, customerName, total, status, deletedAt }[]`.
**Dependencies**: `/api/admin/invoices/[id]` PATCH (`action: 'restore-from-trash'`), `/api/admin/invoices/[id]/permanent` DELETE.

### `InvoiceTable.tsx`
**Purpose**: Dashboard list — search box, column-header sorting, All/Outstanding/Paid/Overdue/Archived filter, pagination. A search term ignores the selected filter and searches active + archived invoices together.
**Props**: `initialInvoices`, `initialTotal`.
**Dependencies**: `/api/admin/invoices` (GET) for search/sort/filter re-fetches, `StatusBadge`, `formatCurrency`.

### `InvoiceDashboardStats.tsx`
**Purpose**: KPI card row (total/paid/partial/outstanding/pending shipments/delivered/revenue).
**Props**: `stats: InvoiceDashboardStats` (from `lib/invoices.ts getInvoiceDashboardStats`).
**Dependencies**: none — pure presentational, follows the KPI card pattern already in `app/admin/page.tsx`.

## `lib/invoiceIssuedEmail.tsx` — automatic "invoice issued" customer email

**Purpose**: `sendInvoiceIssuedEmailIfNeeded(invoice)` — called from `createInvoice`/`updateInvoice`/`recordPayment` in `lib/invoices.ts` — emails the Client Invoice PDF to `customerEmail` the first time an invoice reaches Issued/Paid/Partially Paid, gated by `InvoiceSettings.autoEmailInvoiceOnIssue` and by whether an `INVOICE_ISSUED_EMAIL_SENT` row already exists in `InvoiceActivityLog` for that invoice (not a boolean flag — see `docs/Decisions.md` #23). `sendInvoiceEmailManually(invoice, userId)` is the separate always-sends path behind the "Email Invoice to Customer" button, regardless of whether the auto-send already fired. `isInvoiceEmailTriggerStatus()` is the pure, unit-tested predicate for which `InvoiceStatus` values count as "issued or beyond."
**Dependencies**: `emails/InvoiceIssued.tsx` (template), `lib/invoice/pdf/RecipientReceiptDocument.tsx` (attached PDF), `lib/resend.ts`.

## `lib/paymentReceivedEmail.tsx` — automatic "payment received" customer email

**Purpose**: `sendPaymentReceivedEmailIfNeeded(invoice, payment)` — called once from `lib/invoices.ts`'s `recordPayment()` right after each `InvoicePayment` row is created — emails a payment confirmation with the updated Client Invoice PDF attached, gated by `InvoiceSettings.autoEmailPaymentReceived`. Deliberately has no dedup guard, unlike the invoice-issued email above: each call already corresponds to exactly one real, distinct payment event, so there's no double-send risk to guard against.
**Dependencies**: `emails/PaymentReceived.tsx` (template), `lib/invoice/pdf/RecipientReceiptDocument.tsx` (attached PDF), `lib/resend.ts`, `lib/customers.ts` (`recordCustomerActivity`).

## `lib/` — payment arrangements

### `lib/invoice/paymentArrangement.ts`
**Purpose**: Pure, framework-agnostic business logic — `generateInstallmentSchedule()` (weekly/biweekly date math, final-installment rounding correction) and `computePaymentStatus()` (Pending/Partial/Paid, derived from `amountPaid`/`total`). Imported client-side (for the builder's live schedule preview) and server-side (`lib/paymentArrangements.ts`), so the preview and the persisted schedule are always the same calculation.

### `lib/paymentArrangements.ts`
**Purpose**: Data access for `PaymentArrangement`/`PaymentArrangementInstallment` — `createPaymentArrangement()` (derives "Initial Payment Amount/Date" from the invoice's own payment history, generates and persists the future schedule) and `matchPaymentToNextPendingInstallment()` (called from `lib/invoices.ts`'s `recordPayment()` — any payment on an invoice with an arrangement satisfies the earliest pending installment). Deliberately never touches `Invoice.amountPaid`/`balanceDue` itself — those stay owned by `lib/invoices.ts`.

## `lib/shipments/` — shared shipment helpers

### `lib/shipments/primary.ts`
**Purpose**: `getPrimaryShipment(shipments)` — the single pure function that derives which of an invoice's (possibly many) shipments is "current": the most recent non-voided one, falling back to the single most recent if every shipment is voided. Never a stored pointer (`docs/Decisions.md` #24). Used by `lib/tracking/service.ts`, `lib/tracking/notifications.tsx`, the PDF's `ShipmentTrackingSection`, the admin tracking API route, and `ShipmentsSection.tsx`.
**Dependencies**: none — pure function, unit tested directly (`primary.test.ts`).

## `lib/fulfillment/` — Fulfillment Gate, label purchase, settings

### `lib/fulfillment/gate.ts`
**Purpose**: `checkFulfillmentEligibility(invoiceId)` — the one centralized "can this invoice ship" check (paid in full, OR an active payment arrangement, OR a manual override), called both by the UI and again inside the purchase service itself. `computeFulfillmentEligibility()` is the pure decision logic underneath it, unit tested for override/paid/arrangement priority ordering with no database. `overrideFulfillmentEligibility(invoiceId, userId, note)` records a manual "fulfill anyway" as a permanent, attributed record on `Invoice` and logs it to both the invoice and customer activity timelines.
**Dependencies**: `lib/paymentArrangements.ts` (`hasActivePaymentArrangement`), `lib/customers.ts` (`syncCustomerFromInvoiceEvent`).

### `lib/fulfillment/labels.ts`
**Purpose**: Real Shippo rate-shopping and label purchase for invoices. `getShippingRatesForInvoice(invoiceId, weight, dimensions)` builds the from/to addresses and parcel from `FulfillmentSettings` + the invoice's shipping address and calls `lib/shippo.ts`'s existing `getRates()`. `purchaseShippingLabelForInvoice(invoiceId, input, actor)` re-checks the Fulfillment Gate, guards against trashed/archived/cancelled invoices, purchases the label via `lib/shippo.ts`'s `purchaseLabel()` (requesting the `PDF_4x6` thermal format) *before* any database write, then calls `lib/tracking/service.ts`'s `registerShipmentForMonitoring()` with `origin: 'LABEL_PURCHASE'` and logs both timelines. `voidShipment(shipmentId, userId)` marks a shipment voided and stops monitoring it — never deletes the row. `FulfillmentLabelError` deliberately surfaces the real Shippo error text to the admin (contrast with `lib/tracking/shippoProvider.ts`'s `sanitizedShippoError` — this is a money-spending action the admin needs exact detail on to fix and retry).
**Dependencies**: `lib/shippo.ts` (`getRates`, `purchaseLabel`), `./gate.ts`, `./settings.ts`, `lib/tracking/service.ts` (`registerShipmentForMonitoring`), `lib/tracking/carrierUrls.ts`.

### `lib/fulfillment/settings.ts`
**Purpose**: `getFulfillmentSettings()`/`updateFulfillmentSettings()` for the `FulfillmentSettings` singleton (return address, default carrier/service/weight/dimensions) — mirrors `lib/invoiceSettings.ts`'s get/update shape. `returnAddress` is full-replace-only in v1 (no null-clear support), sidestepping Prisma's nullable-Json ambiguity for a field the UI never needs to blank out.
**Dependencies**: none beyond Prisma.

### `lib/fulfillment/presets.ts`
**Purpose**: `listPackagePresets()`/`createPackagePreset()`/`updatePackagePreset()`/`deletePackagePreset()` for the `PackagePreset` list table — mirrors `lib/promotions.ts`'s list/create shape.
**Dependencies**: none beyond Prisma.

## `lib/tracking/` — carrier-agnostic shipment tracking

### `lib/tracking/types.ts`
**Purpose**: The `ShippingProvider` interface every carrier adapter implements (`registerTracking`, `getTrackingStatus`, `verifyWebhook`, `normalizeWebhookPayload`), `NormalizedTrackingEvent`/`TrackingResult` shapes, and `isTrackableCarrier()`/`TRACKABLE_CARRIERS` (USPS/UPS/FEDEX/DHL — PICKUP/HAND_DELIVERY/COURIER/OTHER have no automated tracking).

### `lib/tracking/shippoProvider.ts`
**Purpose**: The only `ShippingProvider` implementation today. Maps our `ShippingCarrier` enum to Shippo's carrier tokens, and Shippo's own coarse status vocabulary (`UNKNOWN/PRE_TRANSIT/TRANSIT/DELIVERED/RETURNED/FAILURE`) plus keyword heuristics on `status_details` into the full 16-value `ShippingStatus` enum. `verifyWebhook` checks a shared-secret query-param token (Shippo doesn't sign payloads like Stripe does).
**Dependencies**: `SHIPPO_API_KEY`, `SHIPPO_WEBHOOK_SECRET` env vars.

### `lib/tracking/registry.ts`
**Purpose**: `getProviderForCarrier()` — the single place resolving which provider handles a given carrier. Adding a carrier via a different provider later means adding one adapter + one line here.

### `lib/tracking/service.ts`
**Purpose**: The only module that mutates `Shipment`/`TrackingEvent`/`InvoiceActivityLog` rows. `registerShipmentForMonitoring()` is the shared "create a new Shipment row and denormalize its status onto the invoice" helper — called by both `addTrackingToInvoice()` (manual entry, `origin: 'MANUAL_ENTRY'`) and `lib/fulfillment/labels.ts`'s `purchaseShippingLabelForInvoice()` (`origin: 'LABEL_PURCHASE'`), so there's exactly one implementation of that concern. Since `Shipment` became one-to-many (`docs/Decisions.md` #24), a new physical package is always a new row — there's no "replace the existing shipment" branch anymore. `processTrackingEvents()` (dedup via `(shipmentId, eventHash)`, recomputes current status from whichever event is chronologically latest — not last-in-array, since carrier events can arrive out of order — then re-derives the primary shipment via `lib/shipments/primary.ts` and only cascades onto the invoice's denormalized fields if the updated shipment is primary), `refreshShipmentTracking()` (polling/manual refresh entry point), `markDeliveredManually()`/`overrideShippingStatus()`/`removeTracking()` (admin overrides on the primary shipment, all logged).

### `lib/tracking/orderStatus.ts`
**Purpose**: `computeOrderStatus()` — the spec's "paid + delivered = completed" rule as a pure function, callable from both the payment side (`lib/invoices.ts`) and the shipping side without either module depending on the other.

### `lib/tracking/notifications.tsx`
**Purpose**: `sendShipmentNotificationIfNeeded()` — gated by the notifiable-status list, the per-status settings toggle, and a dedup check against `ShipmentNotification` keyed on `(shipmentId, notificationType)` (never re-sends the same status twice for the *same shipment* — since `Shipment` became one-to-many, a second shipment on the same invoice reaching e.g. `DELIVERED` must still notify, so the dedup key had to move off `invoiceId` alone); regenerates the Client Invoice PDF in-process and attaches it. Failures are recorded (`ShipmentNotification.status = 'FAILED'`), never thrown — a failed email never rolls back the tracking update that triggered it. `resendLastNotification()` is the admin manual-resend control, using `lib/shipments/primary.ts` to resolve the current shipment.

### `lib/tracking/validation.ts`, `eventHash.ts`, `sanitize.ts`, `carrierUrls.ts`
**Purpose**: Small pure helpers — advisory (non-blocking) tracking-number format checks per carrier, the deterministic dedup hash for a tracking event, HTML/control-character stripping for carrier-provided text before it's stored or rendered, and the carrier tracking-page URL builder. All covered by unit tests (`*.test.ts` alongside each) — see `docs/ChangeLog.md`.

## Reuse from the existing codebase

- `formatCurrency` — `lib/orders.ts`
- Admin auth gate pattern (`userId === process.env.ADMIN_CLERK_USER_ID`) — `app/admin/page.tsx`, `app/api/admin/invoices/route.ts`
- `react-hot-toast` for success/error feedback — already used in `AdminOrdersTable.tsx`
- KPI card and table styling conventions — `app/admin/page.tsx`
