// Admin Product Engagement Intelligence (AI-1.2, extended AI-1.5) --
// first-party view/add-to-cart demand signal, backed by
// ProductEngagementEvent (logged from components/storefront/ProductDetail.tsx
// and lib/cart-store.ts via app/api/analytics/product-engagement/route.ts).
// Plain aggregation, not an AI-generated summary -- see
// app/admin/intelligence/search/page.tsx for the sibling search-demand view
// this matches conventions with.
//
// AI-1.5 added the Category Performance and Not Yet Measurable sections.
// The latter is explicit by design (owner instruction): Order/OrderItem
// have zero rows in production pre-launch, so bulk-pricing/inquiry-demand,
// demand-velocity, and inventory-demand signals are shown as INSUFFICIENT
// DATA rather than silently omitted or approximated from proxies that
// don't actually measure them.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProductEngagementSummary } from '@/lib/analytics/productEngagementInsights'
import { getCategoryPerformance, categoriesWithNoEngagement } from '@/lib/analytics/categoryPerformance'

const WINDOW_DAYS = 30

const NOT_YET_MEASURABLE = [
  {
    label: 'Bulk-Pricing / Inquiry Demand',
    requires: 'Order and OrderItem history',
  },
  {
    label: 'Demand Velocity',
    requires: 'Order history across multiple time windows',
  },
  {
    label: 'Inventory-Demand Indicators',
    requires: 'Order history correlated with stock levels',
  },
]

export default async function ProductIntelligencePage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [rows, categoryRows] = await Promise.all([
    getProductEngagementSummary(WINDOW_DAYS),
    getCategoryPerformance(WINDOW_DAYS),
  ])
  const uncoveredCategories = categoriesWithNoEngagement(categoryRows)

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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Product</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Views</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Added to Cart</th>
                    <th className="py-2 whitespace-nowrap">View → Cart Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.productId} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4 whitespace-nowrap">{row.productName}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.views}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.addsToCart}</td>
                      <td className="py-2 whitespace-nowrap">{(row.viewToCartRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Category Performance</h2>
          <p className="text-white/50 text-sm mb-4">Merchandising-category demand, from the same catalog taxonomy customers browse by. A product counts toward every category it belongs to.</p>
          {categoryRows.length === 0 ? (
            <p className="text-white/40 text-sm">No product engagement recorded in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Category</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Views</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Added to Cart</th>
                    <th className="py-2 whitespace-nowrap">View → Cart Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.slug} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4 whitespace-nowrap">{row.label}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.views}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.addsToCart}</td>
                      <td className="py-2 whitespace-nowrap">{(row.viewToCartRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {uncoveredCategories.length > 0 && (
            <p className="text-white/40 text-xs mt-3">
              No recorded engagement this window: {uncoveredCategories.join(', ')}.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Not Yet Measurable</h2>
          <p className="text-white/50 text-sm mb-4">Pepscore Lab is pre-launch -- Order and OrderItem have zero rows in production, so these cannot be computed yet. Shown explicitly rather than omitted or approximated.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                  <th className="py-2 pr-4 whitespace-nowrap">Signal</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Requires</th>
                  <th className="py-2 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {NOT_YET_MEASURABLE.map((item) => (
                  <tr key={item.label} className="border-b border-white/5 text-white/80">
                    <td className="py-2 pr-4 whitespace-nowrap">{item.label}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{item.requires}</td>
                    <td className="py-2 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-white/10 text-white/50">
                        Insufficient Data
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
