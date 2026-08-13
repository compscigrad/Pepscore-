// JSON-LD builders for the storefront. Every builder here only ever emits
// customer-visible, already-approved data -- never supplier cost, internal
// margin, suggested/formula pricing, hidden individual-vial pricing, or
// internal stock counts. A product with no approved price never gets an
// Offer block at all (schema.org requires either a real price or omitting
// Offer entirely -- inventing one would be exactly the "fake Offer
// pricing" the spec explicitly forbids).
import type { StorefrontPrice } from './pricing'
import type { StorefrontAvailability } from './availability'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore-compscigrads-projects.vercel.app'

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Pepscore Lab',
    url: APP_URL,
    logo: `${APP_URL}/images/logo.png`,
    email: 'contact@pepscorelab.com',
    description: 'Precision-grade research peptides supplied for laboratory research use only.',
  }
}

// Site-wide (2026-08-12 AOAI SEO sprint) -- lets Google understand the
// site has an internal search engine, the real prerequisite for a
// sitelinks search box in results. Points at the real, already-live
// /search?q={query} route (lib/storefront/search.ts), never a fabricated
// endpoint.
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Pepscore Lab',
    url: APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

// A stable, non-fabricated group identifier for a product family --
// derived from the real Product.name every variant already shares (e.g.
// every "Retatrutide" row), not an invented SKU/ID. Slugified the same
// way lib/storefront/categorySlug.ts's now-removed helper used to (lowercase,
// non-alphanumeric collapsed to hyphens) so it stays URL-safe and stable.
export function productGroupId(productName: string): string {
  return productName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Links a product family's real active strengths together so Google can
// understand "Retatrutide 10mg" and "Retatrutide 20mg" as variants of one
// ProductGroup (varying by strength) rather than unrelated pages -- the
// structural gap the 2026-08-12 SEO sprint specifically asked to close
// for exact product+strength search targeting. Every entry here must be a
// real, active catalog row; never invents a strength that doesn't exist.
export function productGroupSchema(input: {
  name: string
  variants: { slug: string; size: string }[]
}) {
  const groupId = productGroupId(input.name)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    name: `${input.name} Research Peptide`,
    brand: { '@type': 'Brand', name: 'Pepscore Lab' },
    productGroupID: groupId,
    variesBy: ['size'],
    hasVariant: input.variants.map((v) => ({
      '@type': 'Product',
      name: `${input.name} ${v.size}`,
      url: `${APP_URL}/products/${v.slug}`,
    })),
  }
}

const AVAILABILITY_SCHEMA_URL: Record<StorefrontAvailability, string> = {
  AVAILABLE: 'https://schema.org/InStock',
  LIMITED: 'https://schema.org/LimitedAvailability',
  BACKORDERED: 'https://schema.org/BackOrder',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
  COMING_SOON: 'https://schema.org/PreOrder',
}

export function productSchema(input: {
  name: string
  size: string
  slug: string
  sku: string | null
  description: string
  imageUrl: string
  price: StorefrontPrice | null
  availability: StorefrontAvailability
  // True when this product has at least one sibling strength -- adds
  // isVariantOf pointing back to the ProductGroup (see productGroupSchema
  // below) so Google can connect "Retatrutide 10mg" back to the
  // "Retatrutide" family. Omitted (not a fabricated single-member group)
  // for a genuinely single-strength product.
  hasSiblingVariants?: boolean
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${input.name} ${input.size}`,
    description: input.description,
    image: `${APP_URL}${input.imageUrl}`,
    brand: { '@type': 'Brand', name: 'Pepscore Lab' },
    url: `${APP_URL}/products/${input.slug}`,
  }
  if (input.hasSiblingVariants) {
    base.isVariantOf = { '@type': 'ProductGroup', productGroupID: productGroupId(input.name) }
  }
  if (input.sku) base.sku = input.sku
  // Only ever the Standard Case price -- SPA/individual pricing are
  // eligibility-gated and never appear in public structured data, even
  // when the current visitor happens to be eligible (a search engine
  // crawler is never an authenticated SPA customer).
  if (input.price) {
    base.offers = {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: input.price.standardCasePrice,
      availability: AVAILABILITY_SCHEMA_URL[input.availability],
      url: `${APP_URL}/products/${input.slug}`,
    }
  }
  return base
}

export function faqSchema(entries: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${APP_URL}${item.url}`,
    })),
  }
}
