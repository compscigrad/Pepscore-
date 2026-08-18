# Pepscore Production Asset Audit

Exported 2026-08-17, from the live production database. 120 product/variant rows queried directly via Prisma -- not seed data, not a prior report, not an assumed count.

## Summary

- **Total product/variant rows:** 120
- **Total unique product families (raw Product.name):** 68
- **Normalized storefront family images needed:** 66 (see note below -- derived, not a raw DB fact)
- **Active:** 100
- **Archived (pricingStatus = INACTIVE):** 20
- **Hidden (separate from archived):** 0 -- no such state exists in the schema; see note below
- **Asset-ready rows (no blockers):** 113
- **Rows requiring owner review (genuine blockers):** 7

### Resolving the 119/66 vs 120/68 discrepancy

The live database right now contains **120 product/variant rows** across **68 distinct product names** -- matching the later "120/68" report, not the earlier "119/66" figures. Confirmed by direct query just now, not carried over from a prior report.

Separately, this export's own family-display-name normalization (Section 5 of the request -- merging strength-variant blend pairs into one shared storefront image) brings the number of **distinct storefront family PHOTOS actually needed down to 66**. Do not confuse this with the 68 figure above: 68 is the real database fact; 66 is this export's own derived recommendation for image generation, and one of the two merges behind it (BPC10+TB10 / BPC5+TB5) is still flagged as unconfirmed below.

### On "hidden" vs "archived"

The Product schema has no dedicated "hidden" boolean distinct from archived. The only field that removes a product from every customer-facing surface is `pricingStatus` (`ACTIVE` / `INACTIVE`); every storefront query in the codebase filters on `pricingStatus !== 'INACTIVE'`. There is a separate `noindex` boolean, but it only suppresses search-engine indexing metadata -- a noindexed product still lists normally on the storefront. All 120 current rows have `noindex = false`. So "archived" and "hidden" are the same state in this schema today; reported as 0 separately rather than inventing a distinction that isn't real.

## Combination products

6 rows across 4 families have explicit per-component strength embedded in the database name and were parsed into a `components` array:

- **BPC 10mg + GHK-Cu 50mg + TB500 10mg** (bpc-ghk-tb-70mg, ARCHIVED) -> family "BPC 157 + GHK-Cu + TB500" -- components: BPC 157 10mg, GHK-Cu 50mg, TB500 10mg
- **BPC10 + TB10** (bpc10-tb10-20mg, ARCHIVED) -> family "BPC 157 + TB500" -- components: NONE PARSED
- **BPC5 + TB5** (bpc5-tb5-10mg, ARCHIVED) -> family "BPC 157 + TB500" -- components: NONE PARSED
- **CJC-1295 without DAC 5mg + Ipamorelin 5mg** (cjc1295-ipa-10mg, active) -> family "CJC-1295 + Ipamorelin" -- components: CJC-1295 without DAC 5mg, Ipamorelin 5mg
- **Cagrilintide 2.5mg + Semaglutide 2.5mg** (cagri-sema-2-5mg, active) -> family "Cagrilintide + Semaglutide" -- components: Cagrilintide 2.5mg, Semaglutide 2.5mg
- **Cagrilintide 5mg + Semaglutide 5mg** (cagri-sema-5mg, active) -> family "Cagrilintide + Semaglutide" -- components: Cagrilintide 5mg, Semaglutide 5mg

3 additional rows are categorized "Combination" but do NOT record per-component strength in the name -- their component makeup is not in the database and was NOT guessed:

- **GLOW50** (glow50-50mg, ARCHIVED) -- 50mg total, no component breakdown available
- **GLOW70** (glow70-70mg, active) -- 70mg total, no component breakdown available
- **KLOW** (klow-80mg, active) -- 80mg total, no component breakdown available

## Ambiguities and open decisions (flagged, not auto-resolved)

- **CJC-1295 No DAC**: Distinct molecule from CJC-1295 With DAC and from the CJC-1295+Ipamorelin blend -- "No DAC" is a real structural variant, not a strength qualifier. Do not merge.
- **CJC-1295 With DAC**: Distinct molecule from CJC-1295 No DAC and from the CJC-1295+Ipamorelin blend -- "With DAC" is a real structural variant, not a strength qualifier. Do not merge.
- **GLOW50**: Distinct product identity from GLOW70, not a strength variant of one "GLOW" family -- confirmed by existing site-wide usage (homepage priority, search tests, category taxonomy) treating "GLOW70" as one proper noun. Archived/INACTIVE (superseded by GLOW70 per app/page.tsx comment).
- **GLOW70**: Distinct product identity from GLOW50, not a strength variant of one "GLOW" family. See GLOW50 note.

- **BPC10 + TB10 / BPC5 + TB5**: proposed as one family ("BPC 157 + TB500") in the manifest, but this is unconfirmed -- same open question as GLOW50/70 (is the embedded number a strength suffix or part of a distinct branded identity?). Both rows are archived/INACTIVE, lowering urgency but not resolving it.
- **CJC-1295+Ipamorelin blend component naming**: the blend's embedded component reads "CJC-1295 without DAC," but the standalone product for the same molecule is named "CJC-1295 No DAC" -- same compound, inconsistent phrasing across two DB records. Not corrected in this export (read-only).
- **"GA = AA Water"**: the "=" character in this product name looks like a data-entry artifact (possibly meant to be "GA/AA Water"). Passed through as-is, not corrected.
- **LC120 / LC216**: size is recorded as a plain mL volume with no separate strength figure. Category "Lipolytic" suggests a proprietary blend, but no component or total-mg data exists in the database to describe what's actually in the vial.

## Missing / unparseable data

- **LC Custom Ingredients** (lc-custom): size = "custom" -- could not parse a numeric value + known unit.

## Unit diversity (do not assume mg)

- **iu**: 7 rows, e.g. EPO 3000IU, HCG, HGH, HMG
- **mg**: 104 rows, e.g. 5-Amino-1MQ, AOD 9604, Ara-290, BPC 10mg + GHK-Cu 50mg + TB500 10mg
- **ml**: 7 rows, e.g. B12 1mg/ml, BAC Water, GA = AA Water, LC120
- **units**: 1 rows, e.g. Botulinum Toxin Type A

## Duplicate check

No duplicate slugs found. No duplicate (name, size) pairs found across all 120 rows.

## Vial-size exceptions

10mL: NAD+ (2 variants), Glutathione (3 variants). Volume-described products use their own recorded mL size directly rather than the 3/10mL rule: BAC Water, GA = AA Water, LC120, LC216. Every other row defaults to 3mL per the owner-approved manufacturing configuration (not read from any database field -- none exists yet).

## Rows requiring owner review before ChatGPT generates their asset

7 of 120 rows carry at least one flag (see each row's own `notes` field in the JSON manifest for the exact reason). Full list:

- **BPC10 + TB10** 20mg (cmp1x0zaz001ibot9h12tu0lb)
  - Family grouping with the other BPC10+TB10/BPC5+TB5 row is proposed but unconfirmed -- owner must confirm before ChatGPT treats these as one shared family image.
  - Combination product but no per-component strengths could be parsed from the raw name -- components left empty. Do not collapse to a single total; get owner input.
- **BPC5 + TB5** 10mg (cmp1x0zai001hbot99755vfiv)
  - Family grouping with the other BPC10+TB10/BPC5+TB5 row is proposed but unconfirmed -- owner must confirm before ChatGPT treats these as one shared family image.
  - Combination product but no per-component strengths could be parsed from the raw name -- components left empty. Do not collapse to a single total; get owner input.
- **Cerebrolysin (6 vials)** 60mg (cmp1x103f002qbot9gogq41g6)
  - What "60mg" + "(6 vials)" together mean physically (total across 6 vials? per vial?) is not recorded -- confirm before printing strength panel.
- **GLOW50** 50mg (cmp1x0zdc001nbot9v9l8x6de)
  - Category is "Combination" but the database does not record explicit per-component strengths for this product (unlike the CJC/Cagrilintide/BPC blends, which embed them in the name). Do not guess component makeup -- owner input required before the strength panel can be finalized.
- **GLOW70** 70mg (cmsida3m30000a3jeo3wwem23)
  - Category is "Combination" but the database does not record explicit per-component strengths for this product (unlike the CJC/Cagrilintide/BPC blends, which embed them in the name). Do not guess component makeup -- owner input required before the strength panel can be finalized.
- **KLOW** 80mg (cmp1x0zdu001obot94kvwjm4l)
  - Category is "Combination" but the database does not record explicit per-component strengths for this product (unlike the CJC/Cagrilintide/BPC blends, which embed them in the name). Do not guess component makeup -- owner input required before the strength panel can be finalized.
- **LC Custom Ingredients** custom (cmp1x106t002zbot9a5hv4hsp)
  - size field "custom" could not be parsed into a numeric value + known unit (mg/mcg/iu/ml/units). Concentration cannot be computed. Requires owner input before a label can be generated.

## What this export does NOT include

- No images or labels were generated. This is data only.
- No database writes, schema changes, or visibility changes were made.
- currentImagePath reflects today's actual Product.imageUrl values -- most rows still point at a generic placeholder (`/images/ALL.png`); a handful have distinct legacy paths. None of this is the target family-photo system.