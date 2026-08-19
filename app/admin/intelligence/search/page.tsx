// Admin Search Intelligence (AI-1.1) -- first-party "what are researchers
// searching for that we don't carry" / demand-signal view, backed by
// SearchEvent (logged once per full /search page view, see
// app/search/page.tsx). Plain aggregation, not an AI-generated summary --
// this is the foundation the eventual LLM-summarized version of this page
// would sit on top of, not that summarized version itself.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getZeroResultQueries, getTopSearchQueries } from '@/lib/analytics/searchInsights'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

const WINDOW_DAYS = 30

export default async function SearchIntelligencePage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [zeroResult, topQueries] = await Promise.all([
    getZeroResultQueries(WINDOW_DAYS),
    getTopSearchQueries(WINDOW_DAYS),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <AdminPageHeader
          title="Search Intelligence"
          subtitle={`First-party search demand, last ${WINDOW_DAYS} days · Pepscore Lab`}
          actions={
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          }
        />

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Zero-Result Searches</h2>
          <p className="text-white/50 text-sm mb-4">What researchers are looking for that the catalog doesn&apos;t currently match — a direct catalog-gap signal.</p>
          {zeroResult.length === 0 ? (
            <p className="text-white/40 text-sm">No zero-result searches recorded in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Query</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Count</th>
                    <th className="py-2 whitespace-nowrap">Last Searched</th>
                  </tr>
                </thead>
                <tbody>
                  {zeroResult.map((row) => (
                    <tr key={row.query} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4">{row.query}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.count}</td>
                      <td className="py-2 whitespace-nowrap">{row.lastSearchedAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white mb-1">Top Searches</h2>
          <p className="text-white/50 text-sm mb-4">Most frequent search queries overall, regardless of whether they matched a product.</p>
          {topQueries.length === 0 ? (
            <p className="text-white/40 text-sm">No searches recorded in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Query</th>
                    <th className="py-2 whitespace-nowrap">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((row) => (
                    <tr key={row.query} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4">{row.query}</td>
                      <td className="py-2 whitespace-nowrap">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
