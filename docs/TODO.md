# TODO — Invoice System

Tracked by priority. Move items here when a `// TODO` comment is added to the code; remove when resolved.

## HIGH

- [ ] Build API routes (`app/api/admin/invoices/**`, `app/api/admin/promotions`)
- [ ] Build invoice dashboard + searchable/sortable table
- [ ] Build `InvoiceBuilder` + live preview + all form sections
- [ ] Build Master Invoice and Recipient Receipt PDF documents
- [ ] Walk the full create → pay → PDF → archive flow manually against the dev database before considering the module done

## MEDIUM

- [ ] Add drag-handle reordering to `InvoiceItemsTable` (currently planned as up/down buttons for v1)
- [ ] Add field-level inline validation errors in the builder UI (server-side zod validation lands first; client-side UX polish follows)
- [ ] Confirm mobile/tablet layout of the builder + live preview (likely needs the preview to collapse below the form on small screens rather than side-by-side)

## LOW

- [ ] CSV/Excel/JSON export for invoices (explicitly marked "(future)" in the spec)
- [ ] Tax field (explicitly marked "(future)" in the spec)
- [ ] Unify the two invoice-numbering schemes (`INV-YYYYMM-XXXXX` legacy vs `PS-YYYY-NNNNNN` new) if the Stripe-order invoice path is ever merged into this data model — see `docs/Decisions.md` #5
- [ ] Revisit on-demand PDF generation vs. cached blob storage if invoice volume grows — see `docs/Decisions.md` #4
