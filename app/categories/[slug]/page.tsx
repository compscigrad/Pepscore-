// Category detail page -- resolves against the owner-directed
// merchandising taxonomy (lib/storefront/merchandisingTaxonomy.ts) rather
// than the database's raw free-text Product.category. A product can
// belong to more than one merchandising category without being
// duplicated in the database (section 27) -- membership here is purely a
// name-match presentation lookup, live-filtered to active products the
// same way every other storefront query already is.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { getMerchandisingCategory, MERCHANDISING_TAXONOMY } from '@/lib/storefront/merchandisingTaxonomy'
import { groupByName } from '@/lib/storefront/groupByName'
import { getCurrentCustomerSpaEligible } from '@/lib/storefront/spaEligibility'
import { breadcrumbSchema } from '@/lib/storefront/structuredData'
import { ScientificBackground } from '@/components/storefront/ScientificBackground'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return MERCHANDISING_TAXONOMY.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = getMerchandisingCategory(slug)
  if (!category) return { title: 'Category Not Found | Pepscore Lab' }
  return {
    title: `${category.label} | Pepscore Lab`,
    description: `Browse Pepscore Lab's ${category.label.toLowerCase()} research peptides — supplied for laboratory research use only.`,
    alternates: { canonical: `/categories/${slug}` },
  }
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { slug } = await params
  const category = getMerchandisingCategory(slug)
  if (!category) notFound()

  const [rows, spaEligible] = await Promise.all([
    prisma.product.findMany({
      where: { name: { in: category.productNames }, pricingStatus: { not: 'INACTIVE' } },
      orderBy: { createdAt: 'asc' },
    }),
    getCurrentCustomerSpaEligible(),
  ])
  const products = groupByName(rows, { spaEligible })
  const Icon = category.icon
  const jsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Categories', url: '/categories' },
    { name: category.label, url: `/categories/${slug}` },
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
            <Link href="/categories" className="hover:text-[#D4AF37] transition-colors">Categories</Link>
            <span>/</span>
            <span className="text-white font-semibold">{category.label}</span>
          </nav>
        </div>

        <div className="relative overflow-hidden py-10 px-6">
          <ScientificBackground intensity="subtle" position="object-right" fadeLeft />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 800px 400px at 10% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
          />
          <div className="max-w-[1200px] mx-auto relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] flex-shrink-0">
                <Icon size={26} strokeWidth={1.75} />
              </div>
              <h1 className="font-heading text-[clamp(24px,4vw,36px)] font-extrabold text-white">{category.label}</h1>
            </div>
            <p className="text-[15px] text-white/55 font-light mb-10 max-w-[640px]">
              {category.description} {rows.length} product{rows.length === 1 ? '' : 's'} available, supplied for laboratory research use only.
            </p>

            {products.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-6">
                {products.map((p) => (
                  <ProductCard key={p.name} {...p} />
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-white/50">No products currently available in this category.</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
