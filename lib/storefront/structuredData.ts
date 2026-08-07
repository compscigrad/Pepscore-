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
    name: 'Pepscore',
    url: APP_URL,
    logo: `${APP_URL}/images/logo.png`,
    email: 'contact@pepscorelab.com',
    description: 'Precision-grade research peptides supplied for laboratory research use only.',
  }
}

const AVAILABILITY_SCHEMA_URL: Record<StorefrontAvailability, string> = {
  AVAILABLE: 'https://schema.org/InStock',
  LIMITED: 'https://schema.org/LimitedAvailability',
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
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${input.name} ${input.size}`,
    description: input.description,
    image: `${APP_URL}${input.imageUrl}`,
    brand: { '@type': 'Brand', name: 'Pepscore' },
    url: `${APP_URL}/products/${input.slug}`,
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
