# TODO — Invoice System

Tracked by priority. Move items here when a `// TODO` comment is added to the code; remove when resolved.

## HIGH

- [x] Build API routes (`app/api/admin/invoices/**`, `app/api/admin/promotions`)
- [x] Build invoice dashboard + searchable/sortable table
- [x] Build `InvoiceBuilder` + live preview + all form sections
- [x] Build Master Invoice and Recipient Receipt PDF documents
- [x] Walk the full create → pay → PDF → archive flow signed in as the real Clerk admin user — done on the live Vercel Preview deployment itself (not just locally): create, live preview, item add/duplicate/remove, discount stacking, save, reload, payment recording, duplicate, archive/restore, both PDFs, dashboard search/sort/filter/stats. All passed.
- [x] Fix Preview-environment "Internal Error" (missing env var scope — see `docs/Decisions.md`)
- [x] Add visible navigation to the invoice dashboard (`Admin` link in the header — it was previously URL-only)
- [x] Fix invoice logo/branding (was using the pre-rebrand site logo — see `docs/Decisions.md` #8)
- [x] Fix `eslint.config.mjs` flat-config crash so `eslint .` actually runs — see `docs/Decisions.md` #9

## MEDIUM

- [ ] Add drag-handle reordering to `InvoiceItemsTable` (currently planned as up/down buttons for v1)
- [ ] Add field-level inline validation errors in the builder UI (server-side zod validation lands first; client-side UX polish follows)
- [ ] Confirm mobile/tablet layout of the builder + live preview (likely needs the preview to collapse below the form on small screens rather than side-by-side)
- [ ] The native `<select>` Carrier dropdown in `ShippingSection` didn't respond to automated browser-tool clicks during testing — unconfirmed whether this is a real bug or a testing-tool artifact (other native dropdowns on the same page worked fine once keyboard navigation was used instead of clicking). Needs a manual check.
- [ ] API routes return raw `err.message` to the client on failure (a pre-existing pattern from before this module). Low risk today, but worth tightening to generic messages + server-side logging only, especially as the admin surface grows.

## LOW

- [ ] CSV/Excel/JSON export for invoices (explicitly marked "(future)" in the spec)
- [ ] Tax field (explicitly marked "(future)" in the spec)
- [ ] Unify the two invoice-numbering schemes (`INV-YYYYMM-XXXXX` legacy vs `PS-YYYY-NNNNNN` new) if the Stripe-order invoice path is ever merged into this data model — see `docs/Decisions.md` #5
- [ ] Revisit on-demand PDF generation vs. cached blob storage if invoice volume grows — see `docs/Decisions.md` #4
- [ ] Retire `public/images/logo.png` in favor of `invoice-logo.jpeg` once the storefront's own visual redesign (matching `landing`) happens — see `docs/Decisions.md` #8
- [ ] Consider a separate Preview database (Neon branch) instead of sharing Production data with every Preview deployment — see `docs/Decisions.md`
