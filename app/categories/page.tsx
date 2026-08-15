// Category index -- the owner-directed merchandising taxonomy
// (lib/storefront/merchandisingTaxonomy.ts), not a raw dump of the
// database's free-text Product.category values. A category only renders
// when it has at least one live (non-INACTIVE) matching product, so an
// emptied-out category (e.g. after retiring a product line) never shows
// as a dead tile.
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { MERCHANDISING_TAXONOMY } from '@/lib/storefront/merchandisingTaxonomy'
import { breadcrumbSchema } from '@/lib/storefront/structuredData'
import { getCategoryAccent } from '@/lib/storefront/categoryAccents'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Research Peptide Categories | Pepscore Lab',
  description: 'Browse Pepscore Lab’s research peptide catalog by category.',
  alternates: { canonical: '/categories' },
}

export default async function CategoriesIndexPage() {
  const activeNames = new Set(
    (await prisma.product.findMany({ where: { pricingStatus: { not: 'INACTIVE' } }, select: { name: true }, distinct: ['name'] })).map((p) => p.name)
  )

  const categories = MERCHANDISING_TAXONOMY.map((c) => ({
    ...c,
    count: c.productNames.filter((n) => activeNames.has(n)).length,
  })).filter((c) => c.count > 0)

  const jsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Categories', url: '/categories' },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CartSidebar />
      <Header />
      <main className="bg-black min-h-screen">
        <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
          <nav aria-label="Breadcrumb" className="text-[12px] text-white/45 flex items-center gap-2">
            <Link href="/" className="hover:text-[#D4AF37] transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white font-semibold">Categories</span>
          </nav>
        </div>

        <div className="relative overflow-hidden py-12 px-6">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 900px 500px at 50% 0%, rgba(212,175,55,0.10) 0%, transparent 70%)' }}
          />
          <div className="max-w-[1200px] mx-auto relative">
            <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase bg-gradient-to-r from-[#F0D375] via-[#D4AF37] to-[#8A6B1A] bg-clip-text text-transparent mb-3 block">Explore the Catalog</span>
            <h1 className="font-heading text-[clamp(28px,4.5vw,44px)] font-extrabold mb-3">
              <span className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#8A6B1A] bg-clip-text text-transparent">Research Peptide</span>{' '}
              <span className="text-white">Categories</span>
            </h1>
            <p className="text-[15px] text-white/55 font-light mb-10 max-w-[640px]">
              Browse Pepscore Lab&apos;s catalog by research domain. Every compound is supplied for laboratory research use only.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((c, i) => {
                const Icon = c.icon
                // Same shared palette/rotation as the homepage Catalog
                // Directory (lib/storefront/categoryAccents.ts) -- only the
                // icon glyph's color changes below; the icon's own box
                // (bg/border), the card border, heading, and count label
                // all stay exactly as gold as before.
                const accent = getCategoryAccent(i)
                return (
                  // Gold-FILLED card (2026-08-14 correction) -- the prior pass
                  // put the gold gradient on the outer wrapper only, with a
                  // near-black bg-gradient-to-br from-[#141414] to-[#0a0a0a] on
                  // the inner div covering the entire visible surface (inset by
                  // just 1px), so the card read as black-with-a-gold-border in
                  // the browser despite the gold token technically being present
                  // in source (confirmed via getComputedStyle on the live page --
                  // inner backgroundImage was literally that dark gradient).
                  // The inner div now carries the SAME rich gold gradient the
                  // homepage Catalog Directory's tray tiles sit on top of
                  // (`linear-gradient(160deg, #F7DF72 0%, #F6D365 18%, #E8C24A 40%,
                  // #D4AF37 62%, #C99A20 85%, #E8C24A 100%)`, CatalogDirectory.tsx),
                  // so the card body itself is the dominant gold surface, not a
                  // border/trim accent. The icon's own chip is now a dark tile
                  // (matching CatalogDirectory's own dark tiles-on-gold-tray
                  // pattern exactly) so the colored jewel-tone icon still pops
                  // with real contrast instead of washing out against gold.
                  // lib/storefront/categoryAccents.ts's icon colors are otherwise
                  // completely untouched.
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="group relative block rounded-2xl p-px transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(212,175,55,0.35)]"
                    style={{ background: 'linear-gradient(155deg, #8A6B1A 0%, #C99A20 40%, #D4AF37 70%, #8A6B1A 100%)' }}
                  >
                    <div
                      className="relative overflow-hidden rounded-[15px] p-7 h-full"
                      style={{ background: 'linear-gradient(160deg, #F7DF72 0%, #F6D365 18%, #E8C24A 40%, #D4AF37 62%, #C99A20 85%, #E8C24A 100%)' }}
                    >
                      {/* Specular highlight sweeping the card's top edge --
                          same technique as the homepage tray's gold bar. */}
                      <div
                        className="absolute inset-x-4 top-0 h-px pointer-events-none opacity-80"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
                      />
                      {/* Ambient shimmer, always faintly present (matches the
                          homepage tray's own inner radial highlight) -- hover
                          brightens it further rather than introducing it from
                          nothing, since a gold-on-gold radial tint (the prior
                          hover treatment) is invisible once the surface itself
                          is gold. */}
                      <div
                        className="absolute inset-0 opacity-40 group-hover:opacity-80 transition-opacity pointer-events-none"
                        style={{ background: 'radial-gradient(ellipse 260px 140px at 15% 0%, rgba(255,255,255,0.45) 0%, transparent 65%)' }}
                      />
                      <div className="relative">
                        <div
                          className="relative w-12 h-12 rounded-xl bg-gradient-to-b from-[#1c1c1c] to-[#0a0a0a] border border-black/30 shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"
                          style={{ '--icon-accent': accent.base, '--icon-accent-hover': accent.hover } as React.CSSProperties}
                        >
                          <span
                            className="absolute inset-1.5 rounded-full blur-[7px] opacity-30 group-hover:opacity-50 transition-opacity"
                            style={{ backgroundColor: accent.glow }}
                            aria-hidden="true"
                          />
                          <Icon size={22} strokeWidth={1.75} className="relative text-[var(--icon-accent)] group-hover:text-[var(--icon-accent-hover)] transition-colors" />
                        </div>
                        <h2 className="font-heading text-[17px] font-bold text-black mb-1.5 transition-colors">{c.label}</h2>
                        <p className="text-[12.5px] text-black/65 leading-relaxed mb-3">{c.description}</p>
                        <div className="h-px w-full bg-gradient-to-r from-black/25 to-transparent mb-3" />
                        <p className="text-[11px] font-heading font-bold tracking-[0.08em] uppercase text-black/75">
                          {c.count} product{c.count === 1 ? '' : 's'} →
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
