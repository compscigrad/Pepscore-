// Shared jewel-tone icon accent system (2026-08-13) -- single source of
// truth for the category icon color rotation, used by both the homepage
// Catalog Directory (components/storefront/CatalogDirectory.tsx) and the
// full Categories page (app/categories/page.tsx) so the two surfaces stay
// visually consistent and neither hand-rolls its own palette. Deliberately
// desaturated/dimensional jewel tones, not neon -- these read as premium
// accents inside PepScore Lab's black/white/gold system, never a rainbow.
// Each entry backs three uses: `base` (idle icon color), `hover` (brighter
// on hover/focus), and `glow` (a very faint blurred tint behind the icon,
// never a fill on the icon's own container).
export interface CategoryAccent {
  base: string
  hover: string
  glow: string
}

export const CATEGORY_ACCENTS: readonly CategoryAccent[] = [
  { base: '#3FB6A8', hover: '#5ED4C6', glow: 'rgba(63,182,168,0.9)' }, // teal
  { base: '#8B7FE0', hover: '#A79BF5', glow: 'rgba(139,127,224,0.9)' }, // violet
  { base: '#4B9FDE', hover: '#6DB8ED', glow: 'rgba(75,159,222,0.9)' }, // electric blue
  { base: '#45B37E', hover: '#5FCB96', glow: 'rgba(69,179,126,0.9)' }, // emerald
  { base: '#BC6FBA', hover: '#D68AD3', glow: 'rgba(188,111,186,0.9)' }, // plum/magenta
  { base: '#3FB8C9', hover: '#5ED2E2', glow: 'rgba(63,184,201,0.9)' }, // cyan
] as const

// Cycles through the palette by position -- callers pass each entry's index
// within their own rendered list so adjacent items never repeat a color.
export function getCategoryAccent(index: number): CategoryAccent {
  return CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length]
}
