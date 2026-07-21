# UI/UX Guidelines — Pepscore Design Language

Source of truth: `pepscore-landing.vercel.app` (the `landing` branch). Values below were pulled live from the deployed site and cross-checked against `tailwind.config.ts` on that branch — these are the actual tokens, not approximations. **Do not reference the old pre-landing storefront's styling.**

## Colors

Defined in `tailwind.config.ts` (shared across branches — the invoice module uses these directly, no new tokens needed):

| Token | Hex | Use |
|---|---|---|
| `gold` | `#C49A1A` | Primary accent — CTAs, active states, highlights |
| `gold-dark` | `#9E7C15` | Hover/pressed states, secondary emphasis |
| `gold-light` | `#E8C84A` | Gradient endpoint, subtle highlights |
| `cream` | `#FAFAF5` | Page background (light surfaces) |
| `cream-dark` | `#F0EDE4` | Section background variation |
| `dark` | `#1A1A1A` | Primary text, dark surfaces |
| `g700` | `#424242` | Secondary text |
| `g500` | `#757575` | Muted/label text |
| `g300` | `#BDBDBD` | Borders, disabled states |
| `g100` | `#F5F5F0` | Card backgrounds, subtle fills |

The landing page's hero uses a black/dark theme with gold accents; the **admin/invoice UI uses the light `cream`/`g100` surface variant** (already established in `app/admin/page.tsx`) — dark hero styling is a marketing-page treatment, not the app-shell treatment.

## Typography

- **Headings** (`font-heading`): Montserrat, weights 300–800. Extra bold (800) for hero/KPI numbers, bold (700) for section headings.
- **Body** (`font-body`): Libre Franklin, weights 300–600.
- Both loaded via `@import` in `app/globals.css` — already available everywhere, no additional font loading needed for invoice pages.
- Small uppercase labels (KPI card labels, table headers) use `text-[11px] font-bold tracking-[0.1em] uppercase text-g500` — this exact pattern is already used in `app/admin/page.tsx` and should be reused for invoice dashboard labels.

## Spacing & Layout

- Page container: `max-w-[1400px] mx-auto p-8`.
- Cards: `bg-white rounded-2xl p-5 shadow-sh` (KPI cards) or `p-6` (content cards).
- Generous gaps between sections (`mb-8`) — whitespace is a feature, not empty space to fill.

## Cards

`rounded-card` (16px) is the brand token; the existing admin dashboard uses Tailwind's built-in `rounded-2xl` (also 16px) interchangeably. Use `rounded-2xl` for consistency with existing admin components. Shadow: `shadow-sh` (`0 1px 3px rgba(0,0,0,.08)`) for resting cards, `shadow-sm2` for slightly elevated elements, `shadow-sl` for modals/popovers, `shadow-gold` (`0 4px 20px rgba(196,154,26,.25)`) for gold CTA emphasis.

## Buttons

Landing page buttons are fully rounded (50px radius / pill), `padding: 16px 36px`, `font-size: 14px`, `font-weight: 700`, with a gold-tinted glow shadow. For the denser admin/invoice UI, use a scaled-down variant: pill-shaped (`rounded-full`), `px-6 py-2.5`, `text-sm font-bold`, gold background for primary actions, `g100`/white with `g500` text for secondary actions.

## Border Radius

- Cards/panels: 16px (`rounded-2xl` / `rounded-card`)
- Buttons/pills/badges: fully rounded (`rounded-full`)
- Inputs: `rounded-lg` (8px) — smaller than cards so form fields read as distinct from their container

## Animations

- `float` keyframe (6s ease-in-out, ±12px translateY) exists in the brand config for hero decoration — not relevant to invoice UI.
- Fade-in-on-scroll (`.fi` / `.fi.vis` utility classes in `globals.css`) is a landing-page pattern; the invoice UI is a data tool, not a marketing page, so it should favor **instant, snappy transitions** (150–200ms) over decorative motion. Respect `prefers-reduced-motion` everywhere.

## Tables

Header row: `bg-g100`, uppercase small labels matching the KPI card label style. Rows: hover state `hover:bg-g100/50`, borders `border-b border-g100` (not heavy grid lines). Status columns use `StatusBadge` — a pill with a light background tint and matching dark text (see the existing `STATUS_COLORS` map pattern in `components/admin/AdminOrdersTable.tsx`).

## PDF Styling

PDFs (`lib/invoice/pdf/`) pull colors and spacing constants from `lib/invoice/pdf/brand.ts`, which mirrors this palette so the printed document doesn't feel like a different product from the web app: gold accent for headings/totals emphasis, dark near-black body text, generous margins, a centered logo at the top. See [Decisions.md](./Decisions.md) for why the PDF isn't pixel-identical to the live preview.

## Icons

`lucide-react` is already a project dependency — use it for all invoice UI icons (status indicators, action buttons) rather than adding a second icon set.
