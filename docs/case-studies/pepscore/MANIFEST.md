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

**Note (resolved 2026-08-14):** `hero-vials.jpeg` was flagged above as
still live as the Open Graph image despite being superseded in the UI —
that gap was closed the same day, first by pointing `og:image` at
`pepscore-hero-v2.png` (matching the live hero), then later the same day
superseded again by a purpose-built social-preview asset (see the `og/`
entries below). `hero-vials.jpeg` is now genuinely retired everywhere,
including social metadata.

## og/ — Open Graph / social-link-preview image evolution (2026-08-14)

| File | Represents | Classification | Reason retired / notes |
|---|---|---|---|
| `pepscore-og-social-preview-before-2026-08-14.png` | `pepscore-hero-v2.png`, the `og:image`/`twitter:image` value immediately before this change (itself already a same-session fix from the original stale `hero-vials.jpeg`) | BEFORE | Superseded by a purpose-built social-preview asset rather than reusing the on-page hero photo |
| `pepscore-og-image-live-render-before-2026-08-14.jpg` | Browser screenshot of the live, rendered old `og:image` (fetched directly from production at its resolved URL) | BEFORE (visual evidence) | Direct visual proof of what a link preview would have shown before this change |
| `pepscore-og-social-preview-after-2026-08-14.jpg` | `pepscore-social-preview-v2.jpg` — the owner-supplied banner (PEPSCORE LAB wordmark + tagline + vial trio), installed unaltered | AFTER | New `og:image`/`twitter:image` value; 1652×490px, deliberately wide banner aspect ratio (not cropped to fit the 1.91:1 platform convention, per explicit instruction not to creatively alter the supplied asset) |

Source of the AFTER asset: owner-supplied file at
`C:\Users\micha\Downloads\Pepscore Main Hero clean.jpg`, installed
unmodified (no crop/resize/re-encode) at
`public/images/pepscore-social-preview-v2.jpg`.

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

## Explore the Catalog card redesign (2026-08-14, same-day correction)

The gold-frame pass documented earlier in this manifest turned out to
be visually insufficient once actually viewed in a browser rather than
just read from source: `getComputedStyle()` on the live page confirmed
the outer wrapper carried the gold gradient, but the inner `<div>` --
the entire visible card surface, inset by only 1px -- had
`background-image: linear-gradient(to right bottom, rgb(20,20,20),
rgb(10,10,10))`, i.e. still black. Corrected the same day: the inner
div now carries the rich gold gradient itself (reusing
`linear-gradient(160deg, #F7DF72 0%, #F6D365 18%, #E8C24A 40%, #D4AF37
62%, #C99A20 85%, #E8C24A 100%)`, the homepage Catalog Directory tray's
own token), title/description/count text switched to black/charcoal
for contrast, and the icon's own chip inverted to a dark tile (matching
the homepage's dark-tiles-on-gold-tray pattern) so the alternating
jewel-tone icon colors keep real contrast instead of washing out.

| File | Represents | Classification |
|---|---|---|
| `pepscore-explore-catalog-black-cards-before-2026-08-14.jpg` | Production page before the fix — gold border only, black card body | BEFORE |
| `pepscore-explore-catalog-gold-cards-after-2026-08-14.jpg` | First 3 cards, gold-filled, local pre-deploy verification | AFTER |
| `pepscore-explore-catalog-gold-cards-full-list-after-2026-08-14.jpg` | Final two cards (Advanced/Specialty Compounds, Blends/Stacks), confirming the fix applies to the entire list, not just the first row | AFTER |

## screenshots/ — live application captures

| File | Represents | Viewport |
|---|---|---|
| `pepscore-app-homepage-desktop-2026-08-14.jpg` | Current `pepscore` application homepage (hero, nav, client sign-in CTA) | Desktop (~1568px) |
| `pepscore-app-categories-desktop-2026-08-14.jpg` | Current Explore the Catalog page, gold card treatment + alternating jewel-tone icons | Desktop (~1568px) |

Captured 2026-08-14 once the Chrome browser extension reconnected mid-
session (was disconnected for the several sprints immediately prior —
see `docs/CaseStudy.md`'s "Pre-signup RUO/21+ gate" entry for the same
recorded limitation).

**Still pending — not fabricated:**
- **Current public landing page** (`pepscore-landing` / pepscorelab.com)
  desktop + mobile — this is the legitimate BEFORE state for the
  eventual landing-page retirement and must be captured before that
  retirement happens, not after. Not yet captured; no `pepscore-landing`
  URL was visited this session (out of this sprint's scope — Part
  E explicitly excludes touching the public landing project, and
  capturing it wasn't reached before this sprint's time was spent on
  the app-side verification pass).
- **True mobile-width (390–430px) captures of the `pepscore` app.** The
  browser automation tool's screenshot viewport was observed to stay
  fixed at ~933px through most of this session regardless of
  `resize_window` calls, only actually widening to a true desktop
  viewport (~1568px) later in the same session after repeated resize
  attempts — a tool-timing quirk, not a site issue. A dedicated
  narrow-viewport pass was not completed before this sprint's time ran
  out. Functional mobile behavior (hamburger menu, mobile predictive
  search, mobile Client Sign In link) WAS interactively verified at the
  ~933px tablet-equivalent width reached earlier in the session — see
  the sprint's completion report for exactly what was and wasn't
  confirmed.
- Admin Product Master table (deferred — lower priority than the
  public-facing captures above, and admin screenshots need care to
  exclude any real customer/order data before being added to a public
  case-study folder).
- **Finance Center (Dashboard/P&L, Expense Ledger, Discounts & Credits,
  Inventory/COGS, Refunds, Vendors, Reconciliation, Owner Transactions,
  Tax Center, Vendor 1099s) — attempted 2026-08-18, not captured.** Live
  browser access confirmed a real screenshot of the Finance Dashboard tab
  can be taken (visually verified the corrected $1,431.00 Gross Revenue
  figure from that same session's P0 verification pass), but this
  session's toolset has no mechanism to persist raw screenshot image
  bytes to a file path on disk — the capture exists only as an
  in-conversation image, not a file this manifest can reference or a
  future reader can open. A dedicated pass with a tool that can save
  captures to `docs/case-studies/pepscore/screenshots/` is needed to
  actually close this gap; each tab needs care taken to exclude any real
  customer name/email/order total before being added to a public-facing
  case-study folder (the Finance Center shows live, real business
  figures, unlike the public storefront pages already captured above).

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
