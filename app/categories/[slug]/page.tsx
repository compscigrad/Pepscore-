// Category detail page -- grid of every product in one category (the
// existing free-text Product.category field, slugified). Reuses the same
// ProductCard grid the homepage uses, not a parallel presentation.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { categoryToSlug } from '@/lib/storefront/categorySlug'
import { groupByName } from '@/lib/storefront/groupByName'
import { getCurrentCustomerSpaEligible } from '@/lib/storefront/spaEligibility'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

// The URL param is a slug, but the DB stores the real category string --
// resolve by finding which distinct category slugifies to the requested
// value, rather than trying to un-slugify (lossy: "GLP-1 Agonist" and a
// hypothetical "GLP 1 Agonist" would collide).
async function resolveCategory(slug: string): Promise<string | null> {
  const distinct = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { category: true },
    distinct: ['category'],
  })
  return distinct.find((d) => categoryToSlug(d.category) === slug)?.category ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await resolveCategory(slug)
  if (!category) return { title: 'Category Not Found | Pepscore' }
  return {
    title: `${category} Research Peptides | Pepscore`,
    description: `Browse Pepscore's ${category} research peptides — supplied for laboratory research use only.`,
    alternates: { canonical: `/categories/${slug}` },
  }
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { slug } = await params
  const category = await resolveCategory(slug)
  if (!category) notFound()

  const [rows, spaEligible] = await Promise.all([
    prisma.product.findMany({
      where: { category, pricingStatus: { not: 'INACTIVE' } },
      orderBy: { createdAt: 'asc' },
    }),
    getCurrentCustomerSpaEligible(),
  ])
  const products = groupByName(rows, { spaEligible })

  return (
    <>
      <CartSidebar />
      <Header />
      <main className="bg-cream min-h-screen">
        <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
          <nav aria-label="Breadcrumb" className="text-[12px] text-g500 flex items-center gap-2">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span>/</span>
            <Link href="/categories" className="hover:text-gold transition-colors">Categories</Link>
            <span>/</span>
            <span className="text-dark font-semibold">{category}</span>
          </nav>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">{category} Research Peptides</h1>
          <p className="text-[15px] text-g500 font-light mb-10 max-w-[640px]">
            Browse Pepscore&apos;s {category.toLowerCase()} research peptides — {rows.length} product{rows.length === 1 ? '' : 's'} available, supplied for laboratory research use only.
          </p>

          {products.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-6">
              {products.map((p) => (
                <ProductCard key={p.name} {...p} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-g500">No products currently listed in this category.</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
