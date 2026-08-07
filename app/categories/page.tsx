// Category index -- one curated, crawlable list of the real categories in
// the catalog (grouped by the existing Product.category string), not a
// faceted-filter explosion. Links every category into its own detail page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { categoryToSlug } from '@/lib/storefront/categorySlug'
import { breadcrumbSchema } from '@/lib/storefront/structuredData'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Research Peptide Categories | Pepscore',
  description: 'Browse Pepscore’s research peptide catalog by category.',
  alternates: { canonical: '/categories' },
}

export default async function CategoriesIndexPage() {
  const groups = await prisma.product.groupBy({
    by: ['category'],
    where: { pricingStatus: { not: 'INACTIVE' } },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  })

  const jsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Categories', url: '/categories' },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CartSidebar />
      <Header />
      <main className="bg-cream min-h-screen">
        <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
          <nav aria-label="Breadcrumb" className="text-[12px] text-g500 flex items-center gap-2">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span>/</span>
            <span className="text-dark font-semibold">Categories</span>
          </nav>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">Research Peptide Categories</h1>
          <p className="text-[15px] text-g500 font-light mb-10 max-w-[640px]">
            Browse Pepscore&apos;s catalog by category. Every compound is supplied for laboratory research use only.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((g) => (
              <Link
                key={g.category}
                href={`/categories/${categoryToSlug(g.category)}`}
                className="bg-white border border-gold/15 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-sl hover:border-gold"
              >
                <h2 className="font-heading text-[17px] font-bold text-dark mb-1">{g.category}</h2>
                <p className="text-[12px] text-g500">{g._count._all} product{g._count._all === 1 ? '' : 's'}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
