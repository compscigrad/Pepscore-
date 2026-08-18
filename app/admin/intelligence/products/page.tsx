// Admin Product Engagement Intelligence (AI-1.2) -- first-party view/
// add-to-cart demand signal, backed by ProductEngagementEvent (logged from
// components/storefront/ProductDetail.tsx and lib/cart-store.ts via
// app/api/analytics/product-engagement/route.ts). Plain aggregation, not
// an AI-generated summary -- see app/admin/intelligence/search/page.tsx
// for the sibling search-demand view this matches conventions with.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProductEngagementSummary } from '@/lib/analytics/productEngagementInsights'

const WINDOW_DAYS = 30

export default async function ProductIntelligencePage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const rows = await getProductEngagementSummary(WINDOW_DAYS)

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Product Engagement Intelligence</h1>
            <p className="text-white/50 text-sm mt-1">First-party views &amp; add-to-cart activity, last {WINDOW_DAYS} days · Pepscore Lab</p>
          </div>
          <Link
            href="/admin"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Admin Dashboard
          </Link>
        </div>

        <section>
          <h2 className="font-heading text-lg font-bold text-white mb-1">Most-Viewed Products</h2>
          <p className="text-white/50 text-sm mb-4">Ranked by product-page views, with the view-to-add-to-cart rate alongside.</p>
          {rows.length === 0 ? (
            <p className="text-white/40 text-sm">No product engagement recorded in this window.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Views</th>
                  <th className="py-2 pr-4">Added to Cart</th>
                  <th className="py-2">View → Cart Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.productId} className="border-b border-white/5 text-white/80">
                    <td className="py-2 pr-4">{row.productName}</td>
                    <td className="py-2 pr-4">{row.views}</td>
                    <td className="py-2 pr-4">{row.addsToCart}</td>
                    <td className="py-2">{(row.viewToCartRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}
