// Clickable catalog directory -- a real, accessible, indexable web
// component replacing the old static catalog-image concept (see
// C:\Users\micha\Downloads\oldcatalog.png, used only as a visual/structural
// reference, never embedded). Every entry is a real <Link> to an existing
// route (product search or category page) -- no pricing, no mg/strength,
// no invented products. Horizontal on desktop, wraps on mobile, keyboard
// reachable via normal tab order (no custom widget/roving tabindex needed
// for a plain link list).
import Link from 'next/link'

interface DirectoryEntry {
  label: string
  href: string
}

// Owner-directed merchandising priority first (docs/ProductRoadmap.md /
// 2026-08-12 homepage sprint), then the remaining real catalog categories,
// left-to-right / top-to-bottom against the old catalog reference where
// that ordering still applies to the live catalog. "Botulinum Toxin" from
// the old reference is intentionally omitted -- not a live catalog
// product today (see docs/PendingOwnerActions.md).
const ENTRIES: DirectoryEntry[] = [
  { label: 'GLP-1 Products', href: '/#products' },
  { label: 'NAD+', href: '/search?q=NAD%2B' },
  { label: 'CJC-1295 / Ipamorelin', href: '/search?q=CJC-1295' },
  { label: 'GLOW70', href: '/search?q=GLOW70' },
  { label: 'Tesamorelin', href: '/search?q=Tesamorelin' },
  { label: 'Recovery & Healing', href: '/categories/healing-peptide' },
  { label: 'Anti-Aging & Longevity', href: '/categories/longevity-peptide' },
  { label: 'Cognitive & Mood', href: '/categories/nootropic' },
  { label: 'Hormonal & Reproductive', href: '/categories/reproductive-peptide' },
  { label: 'Cosmetic & Skin', href: '/categories/cosmetic-peptide' },
]

export function CatalogDirectory() {
  return (
    <nav aria-label="Product catalog directory" className="relative bg-black border-y border-[#D4AF37]/15 py-6 px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37]">
            Catalog Directory
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/30 to-transparent" />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory md:flex-wrap md:overflow-visible">
          {ENTRIES.map((entry) => (
            <Link
              key={entry.label}
              href={entry.href}
              className="snap-start flex-shrink-0 whitespace-nowrap border border-[#D4AF37]/25 bg-white/[0.03] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 rounded-full px-5 py-2.5 font-heading text-[12px] font-semibold tracking-[0.03em] text-white/85 hover:text-[#D4AF37] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:outline-offset-2"
            >
              {entry.label}
            </Link>
          ))}
          <Link
            href="/categories"
            className="snap-start flex-shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 font-heading text-[12px] font-bold tracking-[0.03em] text-[#D4AF37]/80 hover:text-[#D4AF37] underline underline-offset-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:outline-offset-2"
          >
            View All Categories →
          </Link>
        </div>
      </div>
    </nav>
  )
}
