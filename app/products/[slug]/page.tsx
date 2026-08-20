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
import { ProductDetail, type FaqEntry } from '@/components/storefront/ProductDetail'
import { getStorefrontPrice } from '@/lib/storefront/pricing'
import { getStorefrontAvailability } from '@/lib/storefront/availability'
import { resolveProductImage } from '@/lib/storefront/productImages'
import { getCurrentCustomerProEligible } from '@/lib/storefront/professionalAccess'
import { getCurrentCustomerAllPreferredPrices, preferredPriceRecordFor } from '@/lib/pricing/preferredPricing'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { productSchema, productGroupSchema, breadcrumbSchema, faqSchema } from '@/lib/storefront/structuredData'

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

// Below this length a description reads as a placeholder/incomplete stub
// rather than real content -- forces noindex regardless of the admin's
// manual noindex flag, so an accidentally-thin page never gets indexed
// (Phase 2B item 6: "do not let incomplete/placeholder content become
// indexable").
const MIN_INDEXABLE_DESCRIPTION_LENGTH = 20

async function getProduct(slug: string) {
  // A slug that used to belong to a product (admin renamed it via the
  // content editor, lib/productContent.ts) redirects to the product's
  // current slug -- checked before the discontinued-product table so a
  // renamed-then-discontinued product still resolves correctly either way.
  const redirectRow = await prisma.productSlugRedirect.findUnique({ where: { oldSlug: slug }, select: { product: { select: { slug: true, pricingStatus: true } } } })
  if (redirectRow && redirectRow.product.pricingStatus !== 'INACTIVE') {
    redirect(`/products/${redirectRow.product.slug}`)
  }

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
  if (!product) return { title: 'Product Not Found | Pepscore Lab' }

  const title = product.seoTitle || `${product.name} ${product.size} | Pepscore Lab Research Peptides`
  const shortDescription = product.metaDescription || product.description
  const description = shortDescription?.slice(0, 155) || `${product.name} ${product.size} — research-use-only peptide from Pepscore Lab.`

  const contentLength = (product.fullDescription || product.description || '').trim().length
  const noindex = product.noindex || contentLength < MIN_INDEXABLE_DESCRIPTION_LENGTH

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title, description, type: 'website' },
    robots: noindex ? { index: false, follow: true } : undefined,
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const [siblings, relatedProductRows, proEligible, allPreferredPrices] = await Promise.all([
    prisma.product.findMany({
      where: { name: product.name, pricingStatus: { not: 'INACTIVE' }, slug: { not: product.slug } },
      select: { slug: true, size: true },
      orderBy: { size: 'asc' },
    }),
    product.relatedProductSlugs.length > 0
      ? prisma.product.findMany({
          where: { slug: { in: product.relatedProductSlugs }, pricingStatus: { not: 'INACTIVE' } },
          select: { slug: true, name: true, size: true },
        })
      : Promise.resolve([]),
    getCurrentCustomerProEligible(),
    getCurrentCustomerAllPreferredPrices(),
  ])

  // Customer Preferred Pricing for this exact product, keyed by sell unit --
  // same shape ProductDetail/ProductCard expect (Price Match sprint,
  // 2026-08-20).
  const preferredPricesBySellUnit: Partial<Record<SellUnit, number>> = {}
  for (const unit of ['CASE_STANDARD', 'CASE_PRO', 'CASE_BULK', 'INDIVIDUAL_VIAL'] as const) {
    const preferred = preferredPriceRecordFor(allPreferredPrices, product.id, unit)
    if (preferred != null) preferredPricesBySellUnit[unit] = preferred
  }

  const imageUrl = resolveProductImage(product.name, product.imageUrl)
  const imageAlt = product.imageAltText || `${product.name} ${product.size}`
  // Sell-unit-level fulfillment (2026-08-15) -- Standard Case and Single
  // Vial are independent physical-stock pools; `availability` here stays
  // case-level since it also feeds the JSON-LD Offer schema below, which
  // represents the general product offer, not any one sell unit.
  const availability = getStorefrontAvailability(product, 'CASE')
  const individualVialAvailability = getStorefrontAvailability(product, 'INDIVIDUAL_VIAL')
  const displayDescription = product.fullDescription || product.description || ''
  const faq = (product.faq as unknown as FaqEntry[] | null) ?? []

  // Structured data always uses the public (non-SPA) price -- a search
  // engine crawler is never an authenticated SPA-eligible customer, so the
  // Offer block must reflect what an anonymous visitor would actually pay.
  const jsonLd = [
    productSchema({
      name: product.name,
      size: product.size,
      slug: product.slug,
      sku: product.sku,
      description: product.description ?? '',
      imageUrl,
      price: getStorefrontPrice(product),
      availability,
      hasSiblingVariants: siblings.length > 0,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/#products' },
      { name: `${product.name} ${product.size}`, url: `/products/${product.slug}` },
    ]),
    ...(faq.length > 0 ? [faqSchema(faq)] : []),
    // Links this product's real active sibling strengths together as one
    // ProductGroup -- omitted for a genuinely single-strength product
    // rather than emitting a fabricated one-member group.
    ...(siblings.length > 0
      ? [productGroupSchema({ name: product.name, variants: [{ slug: product.slug, size: product.size }, ...siblings] })]
      : []),
  ]

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <CartSidebar />
      <Header />
      <ProductDetail
        key={product.id}
        id={product.id}
        slug={product.slug}
        name={product.name}
        size={product.size}
        category={product.category}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        description={displayDescription}
        price={getStorefrontPrice(product, { proEligible })}
        caseAvailability={availability}
        individualVialAvailability={individualVialAvailability}
        availabilityMessageOverride={product.availabilityMessageOverride}
        relatedStrengths={siblings}
        relatedProducts={relatedProductRows}
        faq={faq}
        sku={product.sku}
        preferredPricesBySellUnit={preferredPricesBySellUnit}
      />
      <Footer />
    </>
  )
}
