export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listCustomerPriceMatchRequests } from '@/lib/priceMatch/requests'
import { formatMomentDate } from '@/lib/invoice/format'
import { SELL_UNIT_DISPLAY_LABEL } from '@/lib/pricing/sellUnits'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import type { PriceMatchRequestStatus } from '@prisma/client'

// Customer-safe status labels -- deliberately distinct wording from the
// Admin queue's internal status names (see lib/priceMatch/requests.ts's
// listCustomerPriceMatchRequests(), which already strips competitor proof,
// review notes, and rejection reasoning before this ever reaches here).
const STATUS_LABEL: Record<PriceMatchRequestStatus, string> = {
  PENDING: 'Under Review',
  MORE_INFO_REQUESTED: 'More Information Requested',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  WITHDRAWN: 'Withdrawn',
}

const STATUS_COLOR: Record<PriceMatchRequestStatus, string> = {
  PENDING: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  MORE_INFO_REQUESTED: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  APPROVED: 'border-gold/40 bg-gold/10 text-gold-light',
  REJECTED: 'border-red-400/30 bg-red-400/10 text-red-300',
  WITHDRAWN: 'border-white/15 bg-white/5 text-white/40',
}

export default async function PriceMatchPage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const requests = await listCustomerPriceMatchRequests(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="font-heading text-2xl font-bold text-white">Price Match Requests</h1>
          <Link
            href="/price-match"
            className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 rounded-full bg-gold text-dark hover:bg-gold-light transition-colors"
          >
            New Request
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">
              No price match requests yet. Found a lower price elsewhere?{' '}
              <Link href="/price-match" className="text-gold-light hover:underline">
                Submit one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="font-heading font-bold text-white text-sm">{req.requestNumber}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">{formatMomentDate(req.createdAt)}</span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                </div>
                <p className="text-white/70 text-sm">{req.productName} ({req.productSize})</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {SELL_UNIT_DISPLAY_LABEL[req.sellUnit as keyof typeof SELL_UNIT_DISPLAY_LABEL] ?? req.sellUnit.replace(/_/g, ' ')}
                </p>
                {req.status === 'MORE_INFO_REQUESTED' && req.moreInfoRequestNote ? (
                  <div className="mt-3 bg-orange-400/10 border border-orange-400/20 rounded-lg p-3">
                    <p className="text-orange-300 text-xs font-bold uppercase tracking-wide mb-1">We need more information</p>
                    <p className="text-white/70 text-sm">{req.moreInfoRequestNote}</p>
                    <p className="text-white/40 text-xs mt-2">
                      Reply to the request confirmation email or{' '}
                      <Link href="/account/support" className="text-gold-light hover:underline">
                        contact support
                      </Link>{' '}
                      with the requested details.
                    </p>
                  </div>
                ) : null}
                {req.status === 'APPROVED' ? (
                  <p className="text-white/40 text-xs mt-2">
                    See{' '}
                    <Link href="/account/profile" className="text-gold-light hover:underline">
                      Preferred Pricing
                    </Link>{' '}
                    in your profile for the approved price.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
