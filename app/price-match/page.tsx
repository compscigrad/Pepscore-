// Price Match Guarantee request page (2026-08-20 Price Match sprint) -- a
// dedicated route, same rationale as /professional-access/apply: a real
// structured request (product, competitor, delivered price, proof) needs
// more room than a generic modal. Replaces the Footer's prior
// LeadCaptureTrigger-based "Request a Price Match" link, which only ever
// captured a bare message field into the general lead pipeline.
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PriceMatchRequestForm } from '@/components/storefront/PriceMatchRequestForm'

export const metadata: Metadata = {
  title: 'Price Match Guarantee | Pepscore Lab',
  description: 'Found a lower delivered price elsewhere? Request a price match and our team will review it.',
  alternates: { canonical: '/price-match' },
}

interface PageProps {
  searchParams: Promise<{ product?: string }>
}

export default async function PriceMatchPage({ searchParams }: PageProps) {
  const { product: productSlug } = await searchParams

  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, slug: true, name: true, size: true },
    orderBy: [{ name: 'asc' }, { size: 'asc' }],
  })

  const initialProductId = productSlug ? products.find((p) => p.slug === productSlug)?.id : undefined

  return (
    <>
      <CartSidebar />
      <Header />
      <PriceMatchRequestForm products={products.map(({ id, name, size }) => ({ id, name, size }))} initialProductId={initialProductId} />
      <Footer />
    </>
  )
}
