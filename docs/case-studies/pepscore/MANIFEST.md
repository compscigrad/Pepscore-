# Pepscore Lab — Case Study Visual Asset Manifest

Established 2026-08-14 per the AOAI visual-documentation standard (see
`AO-AI-Solutions/docs/ProductStrategy.md`, "AOAI baseline delivery
standard"). This folder holds visual evidence for `docs/CaseStudy.md`
— screenshots and product imagery documenting Pepscore Lab's evolution,
organized by BEFORE / CURRENT / (future) AFTER state.

All assets below are copies of files already committed to this
repository's own history (`public/images/**`) or, for the pending
landing-page items, not yet captured. Nothing here contains secrets,
credentials, admin data, or customer PII — every asset is public
storefront/marketing imagery.

## before/ — superseded hero & Mission imagery

| File | Represents | Date (git history) | Milestone |
|---|---|---|---|
| `pepscore-hero-before-v1-2026-05-11.jpeg` | Original hero vial-lineup photo (`hero-vials.jpeg`) | 2026-05-11 | First hero photo replacement, commit "Replace hero image with vial lineup product photo" |
| `pepscore-hero-before-v2-2026-08-12.png` | Second-generation hero photo (`hero-vials-new.png`), superseded same day | 2026-08-12 | "Preview #7: hero/Mission image swap" |
| `pepscore-mission-before-2026-08-12.png` | Second-generation Mission-section photo (`mission-vials.png`), superseded same day | 2026-08-12 | "Preview #7: hero/Mission image swap" |

**Note:** `hero-vials.jpeg` is copied here as a historical snapshot, but is
**not actually retired** — a live-code check found `app/layout.tsx` still
references it directly as the Open Graph (social-share) image, unchanged
since the hero photo itself moved on to `pepscore-hero-v2.png`. This is a
real, separate gap outside this sprint's scope; flagged in the completion
report rather than fixed here.

## after/ — current production imagery (as of this sprint)

| File | Represents | Date | Source |
|---|---|---|---|
| `pepscore-hero-current-2026-08-12.png` | Current homepage hero image | 2026-08-12 | `public/images/pepscore-hero-v2.png`, live at `/` |
| `pepscore-mission-current-2026-08-12.png` | Current Mission-section image | 2026-08-12 | `public/images/pepscore-mission-v2.png`, live at `/` |

## assets/ — representative current single-vial product photography

A curated sample (not the full ~100-product catalog) demonstrating the
current label design and product-presentation standard:

| File | Product |
|---|---|
| `product-vial-semaglutide-current-2026-08.png` | Semaglutide |
| `product-vial-tirzepatide-current-2026-08.png` | Tirzepatide |
| `product-vial-retatrutide-current-2026-08.png` | Retatrutide |
| `product-vial-mots-c-current-2026-08.png` | MOTS-c |
| `product-vial-ghk-cu-current-2026-08.png` | GHK-Cu |

These vial photos will need a genuine "before" counterpart once the
catalog's product imagery is next updated — capture the outgoing set
the same way this sprint captured the outgoing hero/Mission images,
*before* the replacement deploys, not after.

## screenshots/ — PENDING (blocked, not skipped)

**Empty as of 2026-08-14.** The Chrome browser extension was not
connected this session (`tabs_context_mcp` failed both at the start
and end of this sprint), so the current public landing page
(`pepscore-landing` / `pepscorelab.com`) and the current `pepscore`
application's live rendered UI could not be captured. This is the
same limitation recorded earlier in `docs/CaseStudy.md` (PR "Pre-signup
RUO/21+ gate," 2026-08-12: "the Chrome browser extension was not
connected this session ... recommended as a follow-up").

**Follow-up required**: once the extension is reconnected, capture:
- Current `pepscore-landing` (pepscorelab.com): full desktop homepage,
  hero, key sections, and a mobile viewport pass — this is the
  legitimate BEFORE state for the eventual landing-page retirement,
  and must be captured before that retirement happens, not after.
- Current `pepscore` application: homepage, a product detail page,
  the admin Product Master table, and mobile views of each — a CURRENT
  baseline milestone shot, independent of the landing-page retirement.

Naming convention to follow when these are captured:
`pepscore-landing-before-desktop-YYYY-MM.png`,
`pepscore-landing-before-mobile-YYYY-MM.png`, etc.

## Asset-capture standard going forward

Documented centrally in `AO-AI-Solutions/docs/ProductStrategy.md`
("AOAI baseline delivery standard") rather than duplicated per-project:
capture representative screenshots at major stages (not every commit),
organize under `docs/case-studies/<project>/{before,after,assets,
screenshots}/`, use meaningful filenames (`<subject>-<state>-<context>-
<YYYY-MM[-DD]>.<ext>`), and never capture secrets, credentials, or
customer PII.
