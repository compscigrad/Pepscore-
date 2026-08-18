# Pepscore Asset Import — Mapping Report (2026-08-17)

## Addendum — owner correction round 2

Five items reconciled after owner review of the first pass:

1. **Semaglutide typography mismatch (confirmed, not yet fixable in-repo).** `Semaglutide.png` is the preserved original control image (per the approved package's own README: "Control image preserved exactly"), predating a typography standardization visible across the other 63 images (bold sans-serif, larger scale) — Semaglutide alone uses a lighter, different typeface. Confirmed via direct pixel/visual comparison. This needs a regenerated Semaglutide from the same external image-generation workflow that produced the other 64 — it is not something achievable by editing files in this repo (flat-text compositing onto the existing photo was already rejected earlier in this sprint for the same reason it doesn't work here: it can't reproduce the photographic label integration the rest of the set has). No Downloads source was found containing a corrected version. **Not fixed — owner/external action required.**
2. **GLOW50 fully audited and retired from the one remaining live surface.** Already `pricingStatus = INACTIVE` (one-time correction already applied in `scripts/seed-approved-pricing.ts`, confirmed zero linked order/invoice rows), already excluded from every storefront query, already redirects at the page level (`glow50-50mg` → `glow70-70mg`). The one remaining gap: `lib/storefront/merchandisingTaxonomy.ts`'s "Blends / Stacks" category still listed it by name (inert today, since the category page also filters archived rows, but would have resurfaced it if ever reactivated without this cleanup) — removed. Also fixed `prisma/seed.ts`, which never set `pricingStatus` for GLOW50 and would have reseeded it as fully active on a fresh database — now explicitly seeds it `INACTIVE`.
3. **False standalone "BPC 157 + GHK-Cu + TB500" identity removed from the same taxonomy list** (same line as #2) — it was never a separate image or product-card, but the category array listed the legacy name as if it were its own catalog member.
4. **CJC-1295/Ipamorelin and Cagrilintide+Semaglutide images were never actually missing — root cause found and fixed.** `next/image`'s optimizer silently fails to load any static path containing a space-surrounded `+` (e.g. `CJC-1295 + Ipamorelin.png`) — `naturalWidth: 0`, no console error, even though the raw static file serves fine at the same URL. This affected three of the 64 approved filenames: `CJC-1295 + Ipamorelin.png`, `Cagrilintide + Semaglutide.png`, `BPC 157 + TB500.png` (confirmed `NAD+.png` is unaffected — its `+` has no surrounding spaces, so it isn't the same trigger). Renamed all three to use "and" instead of "+" and updated every reference (`lib/storefront/productImages.ts`, `app/page.tsx`'s DB-down fallback). Live-verified on the real `/products/cjc1295-ipa-10mg` and `/products/cagri-sema-2-5mg` pages, and confirmed zero broken images (`naturalWidth: 0`) across all 26 images on the full preview page after the fix.
5. **Canonicalization matrix** added below, per owner request.

## Summary counts

| | |
|---|---|
| Database product rows | 120 |
| Canonical storefront families (raw distinct `Product.name`) | 68 |
| Approved family images imported | 64 |
| Product rows successfully mapped to an approved image | 119 |
| Missing mappings | 1 (GLOW50 — see below) |
| Ambiguous mappings | 0 |
| Archived/hidden rows among the 119 mapped | 19 |
| Active rows among the 119 mapped | 100 |
| 3mL print labels imported | 107 |
| 10mL print labels imported | 10 |
| Dimension validation failures | **0** (confirmed by the approved package's own `VALIDATION.json`: `bad3mlDimensionsAfterCorrection: []`, `bad10mlDimensionsAfterCorrection: []`) |

64 approved images cover 67 of the 68 raw family names because two owner-approved image-sharing decisions consolidate pairs into one file: Cagrilintide 2.5mg+Semaglutide 2.5mg / 5mg+5mg share `Cagrilintide + Semaglutide.png`, and BPC10+TB10 / BPC5+TB5 share `BPC 157 + TB500.png` (this second merge, flagged as unconfirmed in the prior export round, is now confirmed approved — see the package's `ownerCorrections`). The 68th name, the legacy `BPC 10mg + GHK-Cu 50mg + TB500 10mg` record, maps to the existing `GLOW70.png` rather than a new file of its own.

## GLOW70 verification (Section 16)

| | DB name | Status | Resolved image |
|---|---|---|---|
| Modern record | `GLOW70` (slug `glow70-70mg`) | ACTIVE | `/images/products/families/GLOW70.png` |
| Legacy record | `BPC 10mg + GHK-Cu 50mg + TB500 10mg` (slug `bpc-ghk-tb-70mg`) | ARCHIVED | `/images/products/families/GLOW70.png` |
| Negative control | `GLOW50` (slug `glow50-50mg`) | ARCHIVED | `/images/products/default-single-vial.png` (correctly NOT GLOW70) |

Both storefront vial front and print-label front read **GLOW70 only** — confirmed visually (screenshots this session) and via the approved print label's own 4 o'clock panel: GHK-Cu 50mg, BPC-157 10mg, TB-500 10mg. No separate "BPC 157 + GHK-Cu + TB500" storefront image or print label exists in the approved package.

### Database identity issue (Section 2 — reported, not auto-fixed)

The live database has TWO separate `Product` rows for what the owner has confirmed is the same physical 70mg GHK-Cu/BPC-157/TB-500 blend:
- `bpc-ghk-tb-70mg` — name "BPC 10mg + GHK-Cu 50mg + TB500 10mg", archived (`pricingStatus = INACTIVE`)
- `glow70-70mg` — name "GLOW70", active

**Not merged or deleted** — per your explicit instruction, since doing so could affect pricing history, orders, or inventory records tied to `bpc-ghk-tb-70mg`'s `productId`. The image-resolution layer now treats both consistently (both show GLOW70 imagery), but the underlying DB rows remain distinct.

**A second, related drift found in application code** (not just images): `lib/storefront/merchandisingTaxonomy.ts`'s "Blends / Stacks" category (`slug: 'blends-stacks'`) still lists the legacy name `'BPC 10mg + GHK-Cu 50mg + TB500 10mg'` as a separate category member alongside `'GLOW70'` and `'GLOW50'`. This is currently inert — `app/categories/[slug]/page.tsx` filters `pricingStatus !== 'INACTIVE'` before querying by name, so the archived legacy row never actually surfaces on the category page today. But if that row were ever reactivated without also being cleaned up here, it would incorrectly reappear as a second, separate "Blends / Stacks" entry next to GLOW70. **Not edited this round** (out of scope for an image-import sprint) — flagged for a future small fix: remove the legacy name from that array.

Also worth noting: `app/products/[slug]/page.tsx` already has its own, unrelated `DISCONTINUED_REDIRECTS` map sending `glow50-50mg` → `glow70-70mg` at the page-routing level, with a comment confirming "GLOW50 is discontinued... GLOW70 is its approved replacement." This is pre-existing, correct, and consistent with the image-mapping decision above — no change needed there.

## Sibling-strength spot checks (full table in the local preview's audit section)

| Family | Variant rows | Shared image confirmed |
|---|---|---|
| Semaglutide | 5mg, 10mg, 15mg, 20mg, 30mg | ✅ all 5 → `Semaglutide.png` |
| Retatrutide | 10 strength rows | ✅ all → `Retatrutide.png` |
| Tirzepatide | 8 strength rows | ✅ all → `Tirzepatide.png` |
| Cagrilintide + Semaglutide | 2.5mg+2.5mg, 5mg+5mg | ✅ both → `Cagrilintide and Semaglutide.png` (renamed from `+`, see addendum #4) |
| BPC 157 + TB500 | BPC10+TB10, BPC5+TB5 | ✅ both → `BPC 157 and TB500.png` (renamed from `+`, see addendum #4) |
| NAD+, Glutathione | 2 and 3 rows respectively | ✅ correct shared image, 10mL vial size |

## Missing mapping: GLOW50

`GLOW50` (slug `glow50-50mg`, archived) has no approved replacement image — it was explicitly excluded by the owner from the approved package (`excludedByOwner: ['GLOW50']` in the manifest). It falls through to the generic single-vial placeholder rather than any storefront family photo. Confirmed correct behavior, not a defect: this product is already archived and already redirects to GLOW70 at the page level, so it has no live customer-facing surface today regardless of its image.

## Visibility integrity check (Section 10/16)

Importing images did not change any product's visibility. `pricingStatus` was never read or written by this sprint's code changes — `resolveProductImage()` only changes what image a row displays, never whether it displays. Confirmed: 19 of the 119 newly-mapped rows are archived (`pricingStatus = INACTIVE`) and remain excluded from every storefront listing query exactly as before.

## Product Master / admin architecture (Section 14)

**What exists today:** `lib/storefront/productImages.ts`'s `PRODUCT_IMAGE_MAP` is the one authoritative image-resolution path, already used by every storefront and admin surface that needs a product image (`groupByName.ts` → homepage/category grids, `app/products/[slug]/page.tsx` → detail pages, `app/api/storefront/search-index/route.ts` → search/predictive search, `lib/adminProductMaster.ts` → Product Master). This module already existed before this sprint (built in an earlier phase) — this sprint only updated its data, not its architecture. No new image-management system was built, per your instruction not to over-build.

**What doesn't exist yet:** there's no admin UI to edit this mapping — it's a code-level constant, changed via a commit, not a database row an admin can edit from Product Master. There's also no distinct DB field for "print label asset" at all; `documents/labels/` is purely filesystem-organized by filename convention (`{familyName} {strength} - {vialSize}mL Label.{png,pdf}`), not linked to any Product row in the database.

**Recommendation (smallest clean addition, not built this round):** if/when an admin needs to change a family image or attach a label file without a code deploy, add two nullable string columns to `Product` — `familyImagePath` and `printLabelPath` — read by `resolveProductImage()` as an override ahead of the static map, defaulting to today's code-level resolution when null. This is additive (no existing behavior changes) and keeps the family-vs-variant distinction intact (`familyImagePath` would logically repeat across sibling-strength rows, same as the image itself does today). Not implemented — flagged only, since nothing today requires it.

## Canonicalization matrix (Section E)

| Database identity | Canonical product family | Storefront display name | Storefront image | Variant/strength | Print label | Status |
|---|---|---|---|---|---|---|
| `Semaglutide` (5 rows) | Semaglutide | Semaglutide | `Semaglutide.png` **(typography mismatch — needs external regeneration, see addendum #1)** | 5mg–30mg | 5× 3mL labels imported | Active |
| `GLOW70` | GLOW70 | GLOW70 | `GLOW70.png` | 70mg | 1× 3mL label imported | Active |
| `BPC 10mg + GHK-Cu 50mg + TB500 10mg` (legacy) | GLOW70 (canonicalized, not a separate family) | — (no separate display) | `GLOW70.png` (same file, no second image) | 70mg | None generated — "No separate BPC/GHK/TB storefront vial or print label exists" per the approved package | **Archived** — DB row retained (historical integrity, zero FK impact confirmed but not deleted), fully excluded from every live surface |
| `GLOW50` | — (retired) | — | None (falls through to placeholder) | 50mg | None generated — owner-excluded | **Archived, retired from storefront/search/predictive search/merchandising/categories.** DB row retained (see addendum #2 for why not deleted); flagged as a candidate for outright deletion given zero linked records, but not deleted without your explicit go-ahead |
| `CJC-1295 without DAC 5mg + Ipamorelin 5mg` | CJC-1295 + Ipamorelin | CJC-1295 / Ipamorelin (stacked, no strength) | `CJC-1295 and Ipamorelin.png` | 10mg (5mg+5mg components) | 1× 3mL label imported | Active — image restored, see addendum #4 |
| `Cagrilintide 2.5mg + Semaglutide 2.5mg` / `5mg + Semaglutide 5mg` | Cagrilintide + Semaglutide | Cagrilintide / Semaglutide (stacked, no strength) | `Cagrilintide and Semaglutide.png` | 5mg, 10mg totals | 2× 3mL labels imported | Active — image restored, see addendum #4 |
| `BPC10 + TB10` / `BPC5 + TB5` | BPC 157 + TB500 | BPC 157 / TB500 (stacked, no strength) | `BPC 157 and TB500.png` | 20mg, 10mg totals | None generated (both archived) | Archived — image path fixed, see addendum #4 |
