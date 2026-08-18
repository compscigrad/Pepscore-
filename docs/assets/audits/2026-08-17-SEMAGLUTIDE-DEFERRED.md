# Semaglutide storefront image — DEFERRED — KNOWN ASSET ISSUE

**Status as of 2026-08-17: deferred by explicit owner instruction. Not a blocker for the rest of the launch sprint. Do not resume without being asked.**

## Current state (preserved, nothing deleted)

| Asset | Location | Status |
|---|---|---|
| Currently active storefront image | `public/images/products/families/Semaglutide.png` | Live — this IS the intended replacement's bytes (SHA-256 `06c1940734499b88cbf6c1ac15bc0e55021cff0e387a7eaddde3f6138e6e7eb7`, confirmed identical to the approved source on disk and via a fresh-tab `fetch()` + hash of the actual served response) |
| Intended-replacement source (owner-approved) | `C:\Users\micha\Downloads\Semaglutide.png` | Preserved, untouched. Same hash as the active asset above |
| Pre-correction legacy copy | `public/images/products/legacy/Semaglutide-pre-typography-fix-2026-08-17.png` | Preserved for before/after evidence |
| Original approved-package control copy | `public/images/products/legacy/Semaglutide.png` | Preserved (the very first control image, byte-identical to `public/images/products/masters/pepscore-vial-sample-approved.png`) |
| Stray mismatched file (flagged, not the real asset) | `C:\Users\micha\pepscore\Semaglutide.png` (repo root) | Preserved, unreferenced by any code — this was the WRONG file initially pointed to (white background, no Pepscore branding); not deleted, just dead weight sitting at repo root |
| Print labels (5 strengths) | `documents/labels/3ml/{png,pdf}/Semaglutide {5,10,15,20,30}mg - 3mL Label.*` | Untouched throughout, correctly separate from the storefront-image issue |
| Mapping record | `lib/storefront/productImages.ts`, `PRODUCT_IMAGE_MAP['Semaglutide']` | Points at `/images/products/families/Semaglutide.png` — correct, unchanged |

## What "the issue" actually is

Every content-level check (SHA-256 hash match, file size match, dimension match, direct `fetch()` of the live served bytes from a fresh browser tab, `naturalWidth` non-zero, visual screenshot) passed. The one open question is why the *owner's own browser session*, at the time of the last review, displayed something that didn't look like the corrected image — despite every mechanical check on this end coming back clean after a full `.next` cache wipe and rebuild. Two live hypotheses, neither confirmed:

1. The owner's browser had its own independent HTTP cache holding the pre-correction bytes from an earlier visit to the same unchanged URL, not yet invalidated on their end.
2. Something intermittent in the local dev/build cycle re-served stale optimizer output after my verification pass but before the owner's own check.

Not chased further per explicit instruction. If revisited later: start by having the owner hard-refresh (or open a private/incognito window) against a freshly built+started server, and re-confirm with the same `fetch()` + SHA-256 technique used here rather than a visual-only check.

## Do not

- Delete any of the files listed above.
- Recopy, regenerate, or re-map anything for Semaglutide without being asked.
- Let this block any other work.
