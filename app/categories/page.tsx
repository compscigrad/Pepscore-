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
            <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Explore the Catalog</span>
            <h1 className="font-heading text-[clamp(28px,4.5vw,44px)] font-extrabold mb-3">
              <span className="bg-gradient-to-br from-[#D4AF37] via-[#E8C84A] to-[#8A6B1A] bg-clip-text text-transparent">Research Peptide</span>{' '}
              <span className="text-white">Categories</span>
            </h1>
            <p className="text-[15px] text-white/55 font-light mb-10 max-w-[640px]">
              Browse Pepscore Lab&apos;s catalog by research domain. Every compound is supplied for laboratory research use only.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((c) => {
                const Icon = c.icon
                return (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="group relative overflow-hidden rounded-2xl p-7 border border-[#D4AF37]/15 bg-gradient-to-br from-[#141414] to-[#0a0a0a] transition-all hover:-translate-y-1 hover:border-[#D4AF37]/50 hover:shadow-[0_16px_40px_rgba(212,175,55,0.12)]"
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: 'radial-gradient(circle at 20% 0%, rgba(212,175,55,0.10) 0%, transparent 60%)' }}
                    />
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 border border-[#D4AF37]/25 flex items-center justify-center mb-4 text-[#D4AF37] group-hover:scale-105 transition-transform">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h2 className="font-heading text-[17px] font-bold text-white mb-1.5 group-hover:text-[#E8C84A] transition-colors">{c.label}</h2>
                      <p className="text-[12.5px] text-white/50 leading-relaxed mb-3">{c.description}</p>
                      <p className="text-[11px] font-heading font-bold tracking-[0.08em] uppercase text-[#D4AF37]/70">
                        {c.count} product{c.count === 1 ? '' : 's'} →
                      </p>
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
