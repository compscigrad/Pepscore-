# Pepscore Asset Import — Directory Migration Report (2026-08-17)

Read-only-database, repo-only-writes sprint. No commit/push/deploy performed. Sources in `C:\Users\micha\Downloads\` were never modified or deleted — everything below is a COPY from Downloads into the repo, or an internal `git mv` of already-repo-tracked files.

## Approved package import (COPY from Downloads, originals untouched)

| Source (Downloads) | New permanent location | Verified? |
|---|---|---|
| `Pepscore_Storefront_Family_Images_APPROVED_CORRECTED.zip` → `families/*.png` (64 files) | `public/images/products/families/` | Yes — file count matches manifest (64), spot-checked Semaglutide.png (byte-identical to approved control) and GLOW70.png visually |
| `Pepscore_Storefront_Family_Images_APPROVED_CORRECTED.zip` → manifests/mapping | `docs/assets/manifests/approved-storefront-family-manifest.json`, `approved-storefront-family-mapping.csv` | Yes |
| `Pepscore_Print_Labels_APPROVED_CORRECTED.zip` → `3ml/png,pdf` (107 each) | `documents/labels/3ml/png/`, `documents/labels/3ml/pdf/` | Yes — count matches package's own VALIDATION.json |
| `Pepscore_Print_Labels_APPROVED_CORRECTED.zip` → `10ml/png,pdf` (10 each) | `documents/labels/10ml/png/`, `documents/labels/10ml/pdf/` | Yes — count matches |
| `Pepscore_Print_Labels_APPROVED_CORRECTED.zip` → manifests/validation/tabled | `docs/assets/manifests/approved-print-label-manifest.json`, `approved-print-label-mapping.csv`, `approved-print-label-validation.json`, `approved-print-label-tabled-items.json` | Yes |

**Note on location:** print labels were deliberately placed OUTSIDE `public/` (repo-root `documents/labels/`, not `public/documents/labels/`) per the owner's explicit correction this round — internal print-production files should not be publicly servable by the deployed website merely because earlier prototype work had put them there.

## Internal repo reorganization (`git mv`, full history preserved)

| Current location (before) | New permanent location | Reference updated? | Verified? | Original safe to retire? |
|---|---|---|---|---|
| 47 old per-product PNGs at `public/images/products/*.png` (flat) | `public/images/products/legacy/` | N/A — no code referenced these paths directly except via the map below | Yes | These ARE now the retired copies — nothing further to do |
| `public/images/{Semaglutide,Tirzepatide,Retatrutide,nad,epithalon,cjc1295,kisspeptin}.png` (7 files) | `public/images/products/legacy/` | Yes — `lib/storefront/productImages.ts`'s `PRODUCT_IMAGE_MAP` and `app/page.tsx`'s `STATIC_PRODUCTS` fallback both repointed to the new approved family images | Yes — build + 951 tests pass, live-rendered in browser | Yes |
| `public/documents/labels/previews/*` (dev-only prototype labels, never approved, never public-linked) | `scripts/assets/_rejected-prototypes/label-previews/` | N/A — nothing referenced these | Yes | Yes |
| `public/images/products/families/_rejected-v1/`, `_rejected-v2/`, `_rejected-v3-flat-compositing/` (this session's own rejected flat-compositing prototypes) | `scripts/assets/_rejected-prototypes/family-photos-v{1,2,3}*/` | N/A — nothing referenced these | Yes | Yes |
| `pepscore-production-asset-manifest.json` (repo root, from the prior ChatGPT-export turn) | `docs/assets/manifests/pepscore-production-asset-manifest.json` | N/A — not code-referenced | Yes | Yes |
| `pepscore-production-asset-audit.md` (repo root) | `docs/assets/audits/pepscore-production-asset-audit.md` | N/A | Yes | Yes |

## Known non-blocking stale reference (not fixed this round)

`prisma/seed.ts` still writes the OLD `/images/...` paths (e.g. `/images/Semaglutide.png`, `/images/ghk-cu.png`) into `Product.imageUrl` for a fresh seed. This is dead in practice — `resolveProductImage()` checks the curated `PRODUCT_IMAGE_MAP` first, which now always wins for every one of these names — but a future reseed will still write stale `imageUrl` values to the DB column itself (cosmetically stale, functionally inert). Recommend updating in a future pass; out of scope for this import (seed.ts is a local dev tool, not a live production surface, per the classification below).

## Absolute local-path audit (Section 7)

Searched the entire repository for `C:\Users\micha`, `C:/Users/micha`, `\Downloads\`, `/Downloads/`, `Desktop`, `OneDrive`, `attachments`.

- **Total absolute local path references found (before this sprint): 0.** The only matches were the English words "Desktop" (viewport-size comments) and "attachments" (email API parameter name) — no actual filesystem paths anywhere in the tracked codebase.
- **Total active production absolute local path references after this sprint: 0.**
- No comment/documentation provenance references needed to be preserved because none existed to begin with — this codebase was already clean of local-path dependencies before this sprint.

## Duplicate asset audit (re-run after import, Section 9)

- **1 byte-identical duplicate**, confirmed intentional: `public/images/products/families/Semaglutide.png` == `public/images/products/masters/pepscore-vial-sample-approved.png`. The approved package's own README states "Control image preserved exactly: Semaglutide.png" — this is the same file by design, not an accidental duplication.
- **33 same-basename-different-content pairs** between `families/` and `legacy/` (e.g. both directories have a `semaglutide.png`-family file). This is the expected old-vs-new pairing — every one of the 33 has genuinely different image content (old individual photo vs. new approved family photo), confirming the legacy migration correctly preserved distinct before/after evidence rather than silently duplicating one version.
- No unused, wasteful, or genuinely redundant files identified. No deletions recommended or performed.

## Not moved (out of scope, flagged for awareness only)

- `public/images/ghk-cu.png` (top-level, distinct file from the one moved out of `products/`) — still referenced only by `prisma/seed.ts`'s dead-in-practice `imageUrl` default. Left in place; harmless.
- `public/images/{ALL.png, hero-vials.jpeg, hero-vials-new.png, logo.png, hero-logo.png, email-logo-mark.png, invoice-logo.jpeg, mission-vials.png, pepscore-hero-v2.png, pepscore-mission-v2.png, pepscore-social-preview-v2.jpg, vial-placeholder.png}` — brand/hero/marketing assets, not per-product photography, out of scope for this sprint.
