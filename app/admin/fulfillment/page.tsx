// Admin -> Fulfillment Command Center. Every paid order auto-enrolls into
// this queue the moment listFulfillmentQueue() sees it (no manual "start
// fulfillment" step) -- see lib/fulfillment/commandCenter.ts for the bucket
// rules and lib/fulfillment/alerts.ts for the alert reconciliation this page
// also triggers on load (a backstop between cron runs, not a replacement
// for the scheduled one in app/api/cron/poll-tracking/route.ts).
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { listFulfillmentQueue, BUCKET_LABEL, ACTIONABLE_BUCKETS, type FulfillmentBucket } from '@/lib/fulfillment/commandCenter'
import { reconcileFulfillmentAlerts } from '@/lib/fulfillment/alerts'
import { FulfillmentQueueTable } from '@/components/admin/FulfillmentQueueTable'

const DISPLAY_ORDER: FulfillmentBucket[] = ['LABEL_NEEDED', 'STALLED', 'EXCEPTION', 'AWAITING_CARRIER_SCAN', 'NEEDS_FULFILLMENT', 'IN_TRANSIT', 'DELIVERED']

export default async function FulfillmentCommandCenterPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/fulfillment')
  if (!(await isCurrentUserAdmin())) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  // Reconciles alerts on every load too, not just the cron -- an admin
  // checking the Command Center mid-shift should never see it lag behind
  // what they're looking at.
  try {
    await reconcileFulfillmentAlerts()
  } catch (err) {
    console.error('[admin/fulfillment] Inline alert reconciliation failed:', err)
  }

  const { bucket: bucketParam } = await searchParams
  const queue = await listFulfillmentQueue()

  const counts = DISPLAY_ORDER.reduce((acc, b) => {
    acc[b] = queue.filter((r) => r.bucket === b).length
    return acc
  }, {} as Record<FulfillmentBucket, number>)
  const needsAttentionCount = queue.filter((r) => ACTIONABLE_BUCKETS.includes(r.bucket)).length

  const activeBucket = bucketParam && DISPLAY_ORDER.includes(bucketParam as FulfillmentBucket) ? (bucketParam as FulfillmentBucket) : null
  const rows = activeBucket ? queue.filter((r) => r.bucket === activeBucket) : queue

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Fulfillment Command Center</h1>
            <p className="text-white/50 text-sm mt-1">
              {queue.length} order{queue.length === 1 ? '' : 's'} in the operational queue
              {needsAttentionCount > 0 && <span className="text-red-300 font-semibold"> · {needsAttentionCount} need{needsAttentionCount === 1 ? 's' : ''} attention</span>}
            </p>
          </div>
          <Link href="/admin/settings/fulfillment" className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors">
            SLA Thresholds →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {DISPLAY_ORDER.map((b) => (
            <Link
              key={b}
              href={activeBucket === b ? '/admin/fulfillment' : `/admin/fulfillment?bucket=${b}`}
              className={`bg-white/[0.03] border rounded-[14px] p-4 transition-colors ${
                activeBucket === b ? 'border-gold/40 bg-white/[0.06]' : 'border-gold/10 hover:border-gold/20'
              }`}
            >
              <p className="font-heading text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5">{BUCKET_LABEL[b]}</p>
              <p className={`font-heading text-2xl font-extrabold ${ACTIONABLE_BUCKETS.includes(b) && counts[b] > 0 ? 'text-red-300' : 'text-white'}`}>{counts[b]}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-heading text-[17px] font-bold text-white">{activeBucket ? BUCKET_LABEL[activeBucket] : 'All Orders'}</h2>
              <p className="text-[12px] text-white/50 mt-0.5">Sorted oldest first. Backordered orders stay visible here even while awaiting stock.</p>
            </div>
            {activeBucket && (
              <Link href="/admin/fulfillment" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                Clear Filter
              </Link>
            )}
          </div>
          <FulfillmentQueueTable rows={rows} />
        </div>
      </div>
    </main>
  )
}
