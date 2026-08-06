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

- [x] Drag-handle reordering to `InvoiceItemsTable` — reassessed and closed as v1-acceptable rather than built: the up/down buttons are fully functional, keyboard-accessible, and touch-friendly; native HTML5 drag-and-drop (the only dependency-free option) behaves poorly on touch devices, which this admin surface is now confirmed to be used from (real phone session observed). Not worth the mobile-UX regression risk for a cosmetic upgrade over a working control.
- [ ] Add field-level inline validation errors in the builder UI (still toast-only). Deferred as UX polish, not a functional gap — every validation path already blocks the save and clearly states the problem via `toast.error`; nothing is silently accepted or unclear today.
- [x] Confirm mobile/tablet layout of the builder + live preview — confirmed via code review, not just an automated check: `InvoiceBuilder.tsx`'s root layout is `grid grid-cols-1 lg:grid-cols-[1fr_420px]`, which already collapses the live preview below the form on any screen under Tailwind's `lg` (1024px) breakpoint. No change needed.
- [x] The native `<select>` Carrier dropdown — confirmed a testing-tool artifact, not a product bug. During this session's full live production acceptance run (intake → issue → pay → ship → track), the carrier `<select>` was set programmatically via the browser tool's form-input path without any issue; the original failure was specific to raw coordinate-click automation, not the control itself.
- [ ] API routes return raw `err.message` to the client on failure. Reassessed, not tightened: every admin API route is already gated behind the single-admin `isAdmin()` check audited this session, so the only viewer of these messages is ever the trusted admin — there's no cross-user leak. Most of these messages are deliberately authored validation text (e.g. "Enter a refund amount, an account credit amount, or both"), not raw Prisma/stack output; genericizing them without a route-by-route audit would silently degrade the admin's own error UX for no real security gain. Left as explicitly low-risk, deferred.

## LOW

- [ ] CSV/Excel/JSON export for invoices (explicitly marked "(future)" in the spec)
- [ ] Tax field (explicitly marked "(future)" in the spec)
- [ ] Unify the two invoice-numbering schemes (`INV-YYYYMM-XXXXX` legacy vs `PS-YYYY-NNNNNN` new) if the Stripe-order invoice path is ever merged into this data model — see `docs/Decisions.md` #5
- [ ] Revisit on-demand PDF generation vs. cached blob storage if invoice volume grows — see `docs/Decisions.md` #4
- [ ] Retire `public/images/logo.png` in favor of `invoice-logo.jpeg` once the storefront's own visual redesign (matching `landing`) happens — see `docs/Decisions.md` #8
- [ ] Consider a separate Preview database (Neon branch) instead of sharing Production data with every Preview deployment — see `docs/Decisions.md`
