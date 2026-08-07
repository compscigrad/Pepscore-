// Search results -- server-rendered so it works without JS and is a real
// crawlable URL, but noindexed (query-driven pages are thin/duplicate
// content by nature, same reasoning as excluding faceted filter URLs from
// the sitemap).
import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { searchProducts } from '@/lib/storefront/search'
import { groupByName } from '@/lib/storefront/groupByName'

export const metadata: Metadata = {
  title: 'Search Results | Pepscore',
  robots: { index: false, follow: true },
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const rows = query ? await searchProducts(query) : []
  const products = groupByName(rows)

  return (
    <>
      <CartSidebar />
      <Header />
      <main className="bg-cream min-h-screen">
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <h1 className="font-heading text-[clamp(24px,3.5vw,32px)] font-bold text-dark mb-2">
            {query ? <>Search results for &ldquo;{query}&rdquo;</> : 'Search'}
          </h1>
          {query && (
            <p className="text-[14px] text-g500 mb-10">
              {rows.length} product{rows.length === 1 ? '' : 's'} found
            </p>
          )}

          {!query ? (
            <p className="text-[14px] text-g500">
              Enter a search term above, or <Link href="/categories" className="text-gold hover:underline">browse by category</Link>.
            </p>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-6">
              {products.map((p) => (
                <ProductCard key={p.name} {...p} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-g500">
              No products matched &ldquo;{query}&rdquo;. Try a different strength, product name, or{' '}
              <Link href="/categories" className="text-gold hover:underline">browse by category</Link>.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
