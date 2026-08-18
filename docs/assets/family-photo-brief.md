# Storefront Family Photography — External Generation Brief

Status: **ACTIVE — replaces programmatic compositing.** See
`public/images/products/families/README.md` for why `compose_family_photo.py`
was retired for this purpose (kept only for experimentation).

This is the spec for the externally-generated image batch. Claude's role on
receipt is limited to: validate filenames against this list, drop files
into the permanent asset structure, wire up `ProductCard`/`ProductDetail`
image paths, verify archived/hidden product handling, verify live storefront
rendering. Claude does not attempt to recreate the photography.

## Visual quality bar

`public/images/products/masters/pepscore-vial-sample-approved.png` is the
reference. Every generated family image should read as a physically printed
label on a real cylindrical vial, matching that reference's:

- **Cylindrical label wrap** — the label visually curves around the vial;
  the front projects toward camera, the sides recede.
- **Perspective** — consistent with a single vial photographed head-on,
  slightly above eye level (matches the approved reference's angle).
- **Reflections/lighting** — soft studio lab lighting, gold cap catchlight,
  faint glass reflections at the base — same mood as the reference.
- **Label content, top to bottom**: PEPSCORE logo mark (gold "P"), PEPSCORE
  (white, bold, all-caps), LAB (gold, small, letter-spaced), family name
  (gold, mixed-case, the visual hero of the label), RESEARCH USE ONLY /
  NOT FOR HUMAN CONSUMPTION (white, small, two lines).
- **No strength/dosage anywhere on the front** — no mg, mg/mL, mL,
  concentration, or variant dosage. The front represents the product
  FAMILY only; strength lives on the physical wraparound label's 3 o'clock
  panel (separate, paused work).
- **Blend/combo families** (see naming section below): render as two
  stacked lines of roughly equal visual weight, no "+" symbol between them,
  e.g. "CJC-1295" / "Ipamorelin" — not a single cramped line, not the raw
  strength-qualified database string.

Output format: PNG, sRGB, no transparency needed (opaque background
matches the reference). Longest edge at least 1600px so the image still
reads sharp at `ProductDetail`'s larger display size. Consistent aspect
ratio across the whole batch is preferred (doesn't need to match the
blank-master's 1620×971 exactly — the flat-compositing pipeline that
constraint came from is retired — but keeping one ratio makes
`ProductCard`/`ProductDetail` layout predictable across all 68 cards).

## Filenames — 68 families, from the existing Stage A manifest

Directory: `public/images/products/families/` (flat, no subfolders — the
`_rejected-v1/`, `_rejected-v2/`, `_rejected-v3-flat-compositing/`
subfolders are dead prototypes, not part of this batch).

These filenames come directly from `docs/assets/generation-manifest.json`
(`storefrontFamilyImage`, already audited against all 120 live product
rows in Stage A) — use them as-is so no remapping work is needed on
receipt.

**One correction to make before generating:** the manifest's own filename
for NAD+ is `nadplus.png` (no hyphen) — use that exact spelling, not
`nad-plus.png` (an inconsistent name that only ever existed in this
session's now-retired dev-preview scratch work, never in the manifest).

| Family (DB name) | Expected filename |
|---|---|
5-Amino-1MQ | `5-amino-1mq.png`
AOD 9604 | `aod-9604.png`
Ara-290 | `ara-290.png`
B12 1mg/ml | `b12-1mg-ml.png`
BAC Water | `bac-water.png`
BPC 10mg + GHK-Cu 50mg + TB500 10mg | `bpc-10mg-plus-ghk-cu-50mg-plus-tb500-10mg.png`
BPC 157 | `bpc-157.png`
BPC10 + TB10 | `bpc10-plus-tb10.png`
BPC5 + TB5 | `bpc5-plus-tb5.png`
Botulinum Toxin Type A | `botulinum-toxin-type-a.png`
CJC-1295 No DAC | `cjc-1295-no-dac.png`
CJC-1295 With DAC | `cjc-1295-with-dac.png`
CJC-1295 without DAC 5mg + Ipamorelin 5mg | `cjc-1295-without-dac-5mg-plus-ipamorelin-5mg.png`
Cagrilintide | `cagrilintide.png`
Cagrilintide 2.5mg + Semaglutide 2.5mg | `cagrilintide-2-5mg-plus-semaglutide-2-5mg.png`
Cagrilintide 5mg + Semaglutide 5mg | `cagrilintide-5mg-plus-semaglutide-5mg.png`
Cerebrolysin (6 vials) | `cerebrolysin-6-vials.png`
DSIP | `dsip.png`
Dermorphin | `dermorphin.png`
EPO 3000IU | `epo-3000iu.png`
Epithalon | `epithalon.png`
G610 | `g610.png`
GA = AA Water | `ga-aa-water.png`
GHK-Cu | `ghk-cu.png`
GHRP-6 Acetate | `ghrp-6-acetate.png`
GLOW50 | `glow50.png`
GLOW70 | `glow70.png`
Glutathione | `glutathione.png`
HCG | `hcg.png`
HGH | `hgh.png`
HMG | `hmg.png`
Humanin | `humanin.png`
IGF-DES | `igf-des.png`
IGF-ILR3 | `igf-ilr3.png`
Ipamorelin | `ipamorelin.png`
KLOW | `klow.png`
KPV (Lysine-Proline-Valine) | `kpv-lysine-proline-valine.png`
KissPeptin-10 | `kisspeptin-10.png`
LC Custom Ingredients | `lc-custom-ingredients.png`
LC120 | `lc120.png`
LC216 | `lc216.png`
LL37 | `ll37.png`
Lemon Bottle | `lemon-bottle.png`
MOTS-c | `mots-c.png`
MT-2 | `mt-2.png`
MT1 | `mt1.png`
Mazdutide | `mazdutide.png`
NAD+ | `nadplus.png`
Oxytocin | `oxytocin.png`
PNC 27 | `pnc-27.png`
PT-141 | `pt-141.png`
Pinealon | `pinealon.png`
Retatrutide | `retatrutide.png`
SLU-PP-332 | `slu-pp-332.png`
SS-31 | `ss-31.png`
Selank | `selank.png`
Semaglutide | `semaglutide.png`
Semax | `semax.png`
Sermorelin Acetate | `sermorelin-acetate.png`
Snap-8 | `snap-8.png`
Survodutide | `survodutide.png`
TB500 | `tb500.png`
Tesamorelin | `tesamorelin.png`
Thymalin | `thymalin.png`
Thymosin Alpha-1 | `thymosin-alpha-1.png`
Tirzepatide | `tirzepatide.png`
VIP10 | `vip10.png`
VIP5 | `vip5.png`

## Family name text vs. filename (open decision, carried from prior round)

The filenames above are slugified from the raw `Product.name`. The TEXT
printed on the label front doesn't have to be the raw name — the prior
correction round proposed a normalization table stripping embedded
strength/dosage from a handful of blend names (full table in that round's
report; not reproduced here). Two ways to handle this batch:

1. **Generate 68 images, 1:1 with the table above, using the proposed
   display names where one exists** (e.g. print "CJC-1295" / "Ipamorelin"
   on the front of `cjc-1295-without-dac-5mg-plus-ipamorelin-5mg.png`,
   "Cagrilintide" / "Semaglutide" on both of the two Cagrilintide+Semaglutide
   strength variants). This is the **recommended path** — it never forecloses
   consolidating images later (two manifest rows can point at the same file
   with zero extra photography), whereas generating fewer images now and
   deciding against consolidation later would mean regenerating.
2. Alternatively, generate the raw, un-normalized name as printed text —
   safer if the normalization table itself isn't approved yet, but less
   polished (a few labels would show the full strength-qualified string,
   e.g. "Cagrilintide 2.5mg + Semaglutide 2.5mg" on the front, which the
   prior round's owner review flagged as visually undesirable).

Either is fine to start from; this only affects the TEXT baked into the
image, not the filename or file count.

## What Claude will do on receipt of the batch

1. Validate every delivered filename against the table above (flag any
   missing/extra/misnamed file rather than silently guessing).
2. Move files into `public/images/products/families/` (no code changes
   needed for this step — the manifest already points there).
3. Wire `storefrontFamilyImage` into `ProductCard`/`ProductDetail` — this
   requires adding the actual DB/schema plumbing (currently
   `docs/assets/generation-manifest.json` is a planning document; the
   `Product` model doesn't yet have a family-image field). Flagged as
   Stage B work, not yet built.
4. Verify archived/hidden products don't surface an image for a
   discontinued family, and that sibling strengths of the same family all
   resolve to the one shared image.
5. Verify live rendering across the storefront (`ProductCard` grid,
   `ProductDetail` page, search results) at desktop and mobile widths.
6. Report back with a verification table before anything is marked
   Stage B complete.

## What stays paused

Physical wraparound print labels (`scripts/assets/generate_label.py`) —
paused until the family front-design standard is finalized from the
approved external imagery, per the owner's original Section 11/17
instructions. The 12 o'clock (true 50%/75% vs. the previously-unapproved
46%/83%) geometry decision is also still open and unrelated to this batch.
