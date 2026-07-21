# UI/UX Guidelines — Pepscore Design Language

Source of truth: `pepscore-landing.vercel.app` (the `landing` branch). Values below were pulled live from the deployed site (including live JS inspection of computed styles, not just the Tailwind config) — these are the actual tokens, not approximations. **Do not reference the old pre-landing storefront's styling, and do not reference the invoice module's own earlier light-theme UI** — it predates this guideline and has since been superseded (see `docs/Decisions.md` #10).

## Colors

Defined in `tailwind.config.ts` (shared across branches — the invoice module uses these directly, no new tokens needed):

| Token | Hex | Use |
|---|---|---|
| `gold` | `#C49A1A` | Primary accent — CTAs, active states, highlights |
| `gold-dark` | `#9E7C15` | Hover/pressed states, secondary emphasis |
| `gold-light` | `#E8C84A` | Gradient endpoint, subtle highlights, text-on-black accent (higher contrast than `gold` against black) |
| `cream` | `#FAFAF5` | Legacy light-surface background (PDF pages only — see below) |
| `cream-dark` | `#F0EDE4` | Section background variation (PDF/light-surface only) |
| `dark` | `#1A1A1A` | PDF body text on white pages |
| `g700` | `#424242` | PDF secondary text |
| `g500` | `#757575` | PDF muted/label text |
| `g300` | `#BDBDBD` | PDF borders |
| `g100` | `#F5F5F0` | PDF section-card fills |

**The invoice dashboard and builder (`app/admin/invoices/**`, `components/invoices/**`) use the landing page's actual dark theme**, not the `cream`/`g100` light surface the rest of `/admin` still uses. Live inspection of `pepscore-landing.vercel.app` confirmed the entire page — not just the hero — sits on a pure black `rgb(0,0,0)` background, with cards built from a near-invisible white tint plus a hairline gold border rather than a filled gray box:

| Token | Value | Use |
|---|---|---|
| page background | `bg-black` | Every invoice dashboard/builder page shell |
| card | `bg-white/[0.03]` + `border border-gold/10` + `rounded-[18px]`, no shadow | Every panel (`components/invoices/theme.ts` → `card`) |
| heading text | `text-white` | |
| muted text | `text-white/50` (labels), `text-white/40` (fine print), `text-white/70` (secondary body) | |
| input | `bg-white/5` + `border-white/10` + `text-white`, `focus:ring-gold/40` | `components/invoices/theme.ts` → `input` |
| divider | `border-white/10` (hairline), `border-white/15`–`/20` (stronger emphasis) | |

The `g100`/`g300`/`g500`/`cream` tokens are **not deprecated** — they're still exactly right for the PDF documents (`lib/invoice/pdf/`), which are printed white pages and must stay printer-friendly, not dark-themed. Reach for the black/glass tokens above in the on-screen dashboard/builder; reach for `g100`/`g300`/`g500`/`dark` in PDF layout code. `InvoicePreview.tsx` is a deliberate third case: it stays a literal white card even inside the dark dashboard, because it represents the actual white PDF page the customer will receive (see `docs/Decisions.md` #10).

## Typography

- **Headings** (`font-heading`): Montserrat, weights 300–800. Extra bold (800) for hero/KPI numbers, bold (700) for section headings.
- **Body** (`font-body`): Libre Franklin, weights 300–600.
- Both loaded via `@import` in `app/globals.css` — already available everywhere, no additional font loading needed for invoice pages.
- Small uppercase labels (KPI card labels, table headers) use `text-[11px] font-bold tracking-[0.1em] uppercase text-g500` — this exact pattern is already used in `app/admin/page.tsx` and should be reused for invoice dashboard labels.

## Spacing & Layout

- Page container: `max-w-[1400px] mx-auto p-8`.
- Invoice dashboard/builder cards: `components/invoices/theme.ts` → `card` (`bg-white/[0.03] border border-gold/10 rounded-[18px]`), `p-6` for content panels, `p-5` for KPI cards. No shadow — depth comes from the border/tint, matching the landing page's flat-depth cards exactly (landing measured no `box-shadow` on its capability cards).
- Generous gaps between sections (`mb-8`) — whitespace is a feature, not empty space to fill.

## Cards

Invoice dashboard/builder: `rounded-[18px]` (landing's measured card radius, close to but not identical to the `rounded-card` token) with a hairline `border-gold/10` and `bg-white/[0.03]` fill — no shadow. PDFs and the rest of `/admin` keep the older `rounded-2xl` (16px) + `shadow-sh` white-card convention, since those are light surfaces where a shadow reads as depth rather than a shadow-on-black artifact.

## Buttons

Landing page buttons are fully rounded (50px radius / pill), `padding: 16px 36px`, `font-size: 14px`, `font-weight: 700`, with a gold-tinted glow shadow. The invoice dashboard/builder uses a scaled-down variant defined once in `components/invoices/theme.ts` — pill-shaped (`rounded-full`), `text-sm font-bold`:
- `pillPrimary` — solid gold, white text (save/create actions)
- `pillSecondary` — `bg-white/10`, white text (add-row actions)
- `pillOutline` — `border-white/15`, `text-white/70` (duplicate/archive, less-emphasized actions)

## Border Radius

- Invoice dashboard/builder cards: 18px (`rounded-[18px]`, landing's measured value)
- Other admin cards / PDF section cards: 16px (`rounded-2xl` / `rounded-card`)
- Buttons/pills/badges: fully rounded (`rounded-full`)
- Inputs: `rounded-lg` (8px) — smaller than cards so form fields read as distinct from their container

## Animations

- `float` keyframe (6s ease-in-out, ±12px translateY) exists in the brand config for hero decoration — not relevant to invoice UI.
- Fade-in-on-scroll (`.fi` / `.fi.vis` utility classes in `globals.css`) is a landing-page pattern; the invoice UI is a data tool, not a marketing page, so it should favor **instant, snappy transitions** (150–200ms) over decorative motion. Respect `prefers-reduced-motion` everywhere.

## Tables

Invoice table (`InvoiceTable.tsx`): header row `bg-white/[0.02]`, uppercase small labels `text-white/50` matching the KPI card label style. Rows: hover state `hover:bg-white/[0.04]`, borders `border-b border-white/10` (not heavy grid lines). Status columns use `StatusBadge` — an outline-plus-tint pill (border + low-opacity fill + tinted text), not a solid-fill chip, so it reads clearly against black and follows the same hairline-border language as the cards (see `components/invoices/StatusBadge.tsx`; PAID is the one status that gets the gold accent treatment, everything else stays neutral gray-scale).

## PDF Styling

PDFs (`lib/invoice/pdf/`) pull colors and spacing constants from `lib/invoice/pdf/brand.ts`, which mirrors this palette so the printed document doesn't feel like a different product from the web app: gold accent for headings/totals emphasis (used sparingly — a small accent bar under the title, the grand-total figure, and the PAID status badge; everything else is black-on-white for print legibility), dark near-black body text, generous margins, a centered logo at the top, a status badge under the invoice number, and a normal-flow (never `fixed`) legal footer sourced from `lib/invoice/legal.ts` so it can never overlap the totals block. See [Decisions.md](./Decisions.md) for why the PDF isn't pixel-identical to the live preview, and #11 for the legal footer design.

## Icons

`lucide-react` is already a project dependency — use it for all invoice UI icons (status indicators, action buttons) rather than adding a second icon set.
