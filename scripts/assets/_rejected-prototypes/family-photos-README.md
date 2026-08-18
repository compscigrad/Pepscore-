# public/images/products/families/ — STATUS

**No file in this directory or its `_rejected-v*/` subfolders is approved for
Stage B or for production use.** As of 2026-08-17, storefront family
photography moved to an external image-generation workflow (see
`docs/assets/family-photo-brief.md` for the full brief). Nothing here should
be wired into `ProductCard`/`ProductDetail` for a real, non-preview page.

## Why the programmatic approach was rejected

Three rounds of `scripts/assets/compose_family_photo.py` (flat text
compositing onto a blank vial photo) were rejected in sequence:

- **v1** — family name anchored too high, not centered in the real safe zone.
- **v2** — correctly centered but used an oversized font and left strength
  (mg) visible on the front for blend products.
- **v3** — recalibrated font/placement to closely match the owner-approved
  Semaglutide reference numerically (position, breathing room, no
  strength on front) — but the owner rejected the entire approach on
  visual-realism grounds, not the numbers: flat 2D text pasted onto a
  photo cannot reproduce cylindrical label wrapping, perspective, or the
  reflections a real (or well-generated) printed label has. This is a
  ceiling of the compositing technique itself, not a tuning problem.

## What's still valid here

- The folder hierarchy itself (`masters/`, `families/`, `legacy/`).
- `masters/master-vial-blank.png` and `masters/pepscore-vial-sample-approved.png`
  — the approved reference remains the visual quality bar for the externally
  generated batch.
- The measurement work in `compose_family_photo.py`'s docstring (safe-zone
  coordinates, LAB/RUO clearances, no-strength-on-front rule) — useful
  reference numbers even though the compositing technique itself is
  retired for storefront photography.

## What happens next

Real family images arrive from an external image-generation workflow
capable of cylindrical wrap/perspective/reflections. See
`docs/assets/family-photo-brief.md` for exact expected filenames,
directory, and spec. Claude's role on receipt: validate filenames against
the manifest, drop files into this directory, wire up `ProductCard`/
`ProductDetail` image paths, verify archived/hidden handling, verify live
rendering. Claude does not attempt to recreate the photography itself.
