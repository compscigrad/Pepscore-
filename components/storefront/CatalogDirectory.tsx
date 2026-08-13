// Clickable catalog directory -- a real, accessible, indexable web
// component replacing the old static catalog-image concept (see
// C:\Users\micha\Downloads\oldcatalog.png, used only as a visual/structural
// reference, never embedded). Every entry is a real <Link> to an existing
// route (product search or a merchandising-taxonomy category page) -- no
// pricing, no mg/strength, no invented products.
//
// Visual direction (2026-08-12 revision pass #2, section 3): a metallic
// gold "bullion bar" outer tray holding individually engraved dark
// tiles -- rich gradient + specular highlight + inset depth on the tray,
// each tile a distinct charcoal panel with a gold border/icon/text rather
// than plain yellow-background buttons, so it reads as worked metal
// rather than a flat-color rectangle.
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Scale, Hourglass, Dumbbell, Layers, Flame, Bandage, Brain, HeartHandshake, Sparkles } from 'lucide-react'
import { ScientificBackground } from './ScientificBackground'

interface DirectoryEntry {
  label: string
  href: string
  icon: LucideIcon
}

// Controlled jewel-tone accent rotation (2026-08-13) -- the tray/border/
// label treatment stays entirely gold (untouched below); only the icon
// glyph itself picks up color, cycling through 6 tones so no two adjacent
// tiles share one. Chosen deliberately desaturated/dimensional rather than
// neon so they read as premium accents inside a black/white/gold system,
// not a rainbow. `glow` backs a very faint, restrained radial tint behind
// each icon (barely visible at rest, a touch brighter on hover) -- never a
// background-color change on the tile itself, which stays the same dark
// engraved panel for every entry.
const ICON_ACCENTS = [
  { base: '#3FB6A8', hover: '#5ED4C6', glow: 'rgba(63,182,168,0.9)' }, // teal
  { base: '#8B7FE0', hover: '#A79BF5', glow: 'rgba(139,127,224,0.9)' }, // violet
  { base: '#4B9FDE', hover: '#6DB8ED', glow: 'rgba(75,159,222,0.9)' }, // electric blue
  { base: '#45B37E', hover: '#5FCB96', glow: 'rgba(69,179,126,0.9)' }, // emerald
  { base: '#BC6FBA', hover: '#D68AD3', glow: 'rgba(188,111,186,0.9)' }, // plum/magenta
  { base: '#3FB8C9', hover: '#5ED2E2', glow: 'rgba(63,184,201,0.9)' }, // cyan
] as const

// Owner-directed merchandising priority first (docs/ProductRoadmap.md /
// 2026-08-12 homepage sprint + revision pass #2), then the taxonomy's
// remaining research-domain categories. Multi-product families route to
// their merchandising-taxonomy category page (so e.g. GLP-1 shows
// Semaglutide, Tirzepatide, and Retatrutide together, not just one);
// single-hero-product tiles route to search, which resolves via an exact
// tier-1 name match. "Botulinum Toxin Type A" is intentionally omitted --
// archived (pricingStatus INACTIVE) since 2026-08-12 pending the supplier
// lab's availability, not a live product today (see docs/PendingOwnerActions.md).
const ENTRIES: DirectoryEntry[] = [
  { label: 'GLP-1 Products', href: '/categories/glp-1-weight-management', icon: Scale },
  { label: 'NAD+', href: '/search?q=NAD%2B', icon: Hourglass },
  { label: 'CJC-1295 / Ipamorelin', href: '/categories/growth-hormone-performance', icon: Dumbbell },
  { label: 'GLOW70', href: '/search?q=GLOW70', icon: Layers },
  { label: 'Tesamorelin', href: '/search?q=Tesamorelin', icon: Flame },
  { label: 'GHK-Cu Blends', href: '/categories/recovery-injury-research', icon: Bandage },
  { label: 'Anti-Aging & Longevity', href: '/categories/anti-aging-longevity', icon: Hourglass },
  { label: 'Cognitive & Mood', href: '/categories/brain-mood-cognitive', icon: Brain },
  { label: 'Hormonal & Reproductive', href: '/categories/sexual-health-hormonal', icon: HeartHandshake },
  { label: 'Cosmetic & Skin', href: '/categories/skin-hair-cosmetic', icon: Sparkles },
]

export function CatalogDirectory() {
  return (
    <nav aria-label="Product catalog directory" className="relative overflow-hidden bg-black py-10 px-6">
      {/* Faint scientific-art layer around the gold tray -- a contrast
          beat between "luxury gold" and "research science", kept well
          clear of the tray itself (fades to nothing before reaching it)
          so it never competes with the metallic treatment or the tile
          labels. */}
      <ScientificBackground intensity="medium" position="object-right" fadeLeft fadeRight />
      <div className="max-w-[1200px] mx-auto relative">
        <div className="flex items-center gap-3 mb-5">
          <span className="font-heading text-[11px] font-bold tracking-[0.18em] uppercase bg-gradient-to-r from-[#F0D375] via-[#D4AF37] to-[#8A6B1A] bg-clip-text text-transparent">
            Catalog Directory
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
        </div>

        {/* The "gold bar" tray — the FULL container reads as polished
            bullion / 24k jewelry gold (2026-08-12 gold-system revision),
            using the global luxury-gold token progression (app/globals.css
            .bg-gold-luxury) instead of the flatter mustard/ochre/brown
            tones this used before. Tiles inside stay dark/charcoal (an
            "engraved plate set into gold") so label text stays legible
            rather than gold-on-gold. */}
        <div
          className="relative rounded-2xl p-[3px] shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          style={{ background: 'linear-gradient(115deg, #C99A20 0%, #F6D365 22%, #FFF1A8 45%, #F6D365 68%, #E8C24A 88%, #C99A20 100%)' }}
        >
          {/* Specular highlight sweeping the top edge of the bar */}
          <div
            className="absolute inset-x-3 top-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)' }}
          />
          <div
            className="relative rounded-[13px] px-4 py-5 sm:px-6 sm:py-6"
            style={{ background: 'linear-gradient(160deg, #F7DF72 0%, #F6D365 18%, #E8C24A 40%, #D4AF37 62%, #C99A20 85%, #E8C24A 100%)' }}
          >
            {/* Inner ambient shimmer */}
            <div
              className="absolute inset-0 rounded-[13px] pointer-events-none opacity-60"
              style={{ background: 'radial-gradient(ellipse 500px 200px at 30% 0%, rgba(255,255,255,0.35) 0%, transparent 60%)' }}
            />
            <div className="relative flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory sm:flex-wrap sm:overflow-visible">
              {ENTRIES.map((entry, i) => {
                const Icon = entry.icon
                const accent = ICON_ACCENTS[i % ICON_ACCENTS.length]
                return (
                  <Link
                    key={entry.label}
                    href={entry.href}
                    className="group snap-start flex-shrink-0 flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-black/20 bg-gradient-to-b from-[#1c1c1c] to-[#0a0a0a] px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all hover:border-[#F0D375]/60 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
                  >
                    {/* Restrained per-icon accent: a faint blurred tint sits
                        behind the glyph (barely visible at rest, a touch
                        brighter on hover) while the tile itself, its gold
                        border, and the label all stay exactly as before. */}
                    <span
                      className="relative flex-shrink-0 flex items-center justify-center w-6 h-6"
                      style={{ '--icon-accent': accent.base, '--icon-accent-hover': accent.hover } as React.CSSProperties}
                    >
                      <span
                        className="absolute inset-0 rounded-full blur-[6px] opacity-25 group-hover:opacity-50 transition-opacity"
                        style={{ backgroundColor: accent.glow }}
                        aria-hidden="true"
                      />
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className="relative transition-colors text-[var(--icon-accent)] group-hover:text-[var(--icon-accent-hover)]"
                      />
                    </span>
                    <span className="font-heading text-[12px] font-semibold tracking-[0.03em] text-white/90 group-hover:text-[#F0D375] transition-colors">
                      {entry.label}
                    </span>
                  </Link>
                )
              })}
              {/* Deliberately the opposite treatment of the gold tiles above
                  -- a solid dark/graphite button so it stays unmistakably
                  visible and clickable against the now fully-gold tray,
                  never gold-on-gold. */}
              <Link
                href="/categories"
                className="snap-start flex-shrink-0 flex items-center whitespace-nowrap rounded-xl border border-black/30 bg-gradient-to-b from-[#2a2a2a] to-[#141414] px-4 py-3 font-heading text-[12px] font-bold tracking-[0.03em] text-[#F5E6C8] shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all hover:border-[#F0D375]/50 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
              >
                View All Categories →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
