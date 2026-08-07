// Canonical product detail page — one route per Product row (each row is a
// specific strength/size, e.g. tesamorelin-10mg). Server-rendered so
// pricing/availability/description are always current and crawlable;
// ProductDetail.tsx is the client island for Add to Cart.
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { ProductDetail } from '@/components/storefront/ProductDetail'
import { getStorefrontPrice } from '@/lib/storefront/pricing'
import { getStorefrontAvailability } from '@/lib/storefront/availability'
import { resolveProductImage } from '@/lib/storefront/productImages'
import { getCurrentCustomerSpaEligible } from '@/lib/storefront/spaEligibility'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

// GLOW50 is discontinued (see scripts/seed-approved-pricing.ts) -- GLOW70 is
// its approved replacement. No public GLOW50 product-detail URL was ever
// live before this route existed, but redirecting the old slug is cheap
// insurance against any external link/bookmark/search-engine cache.
const DISCONTINUED_REDIRECTS: Record<string, string> = {
  'glow50-50mg': 'glow70-70mg',
}

async function getProduct(slug: string) {
  const redirectTarget = DISCONTINUED_REDIRECTS[slug]
  if (redirectTarget) redirect(`/products/${redirectTarget}`)

  // pricingStatus INACTIVE products (discontinued, e.g. GLOW50 itself once
  // reached directly) are treated as not found -- same exclusion rule as
  // the homepage catalog query.
  return prisma.product.findFirst({ where: { slug, pricingStatus: { not: 'INACTIVE' } } })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Product Not Found | Pepscore' }

  const title = `${product.name} ${product.size} | Pepscore Research Peptides`
  const description = product.description?.slice(0, 155) || `${product.name} ${product.size} — research-use-only peptide from Pepscore.`

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const [siblings, spaEligible] = await Promise.all([
    prisma.product.findMany({
      where: { name: product.name, pricingStatus: { not: 'INACTIVE' }, slug: { not: product.slug } },
      select: { slug: true, size: true },
      orderBy: { size: 'asc' },
    }),
    getCurrentCustomerSpaEligible(),
  ])

  return (
    <>
      <CartSidebar />
      <Header />
      <ProductDetail
        id={product.id}
        slug={product.slug}
        name={product.name}
        size={product.size}
        category={product.category}
        imageUrl={resolveProductImage(product.name, product.imageUrl)}
        description={product.description ?? ''}
        price={getStorefrontPrice(product, { spaEligible })}
        availability={getStorefrontAvailability(product)}
        relatedStrengths={siblings}
        sku={product.sku}
      />
      <Footer />
    </>
  )
}
