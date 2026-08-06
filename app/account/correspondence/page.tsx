export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalAuthState } from '@/lib/portalAuth'
import { listPortalCorrespondence } from '@/lib/portal/correspondence'
import { formatDate } from '@/lib/invoice/format'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'

const CATEGORY_LABELS: Record<string, string> = {
  INVOICE_ISSUED: 'Invoice Issued',
  INVOICE_REVISED: 'Invoice Updated',
  ORDER_CONFIRMATION: 'Order Confirmation',
  INTAKE_REQUEST: 'Information Requested',
  INTAKE_SUBMISSION_CONFIRMATION: 'Information Received',
  BACKORDER_NOTICE: 'Backorder Notice',
  FULFILLMENT_UPDATE: 'Fulfillment Update',
  TRACKING_UPDATE: 'Tracking Update',
  PORTAL_INVITE: 'Account Setup',
  PORTAL_ACCOUNT_CLAIMED: 'Account Setup',
  PAYMENT_SELECTION_CONFIRMATION: 'Payment Selection',
  PAYMENT_ARRANGEMENT_REQUEST_RECEIVED: 'Payment Arrangement',
  PAYMENT_ARRANGEMENT_DECISION: 'Payment Arrangement',
  PAYMENT_RECEIVED: 'Payment Receipt',
  REFUND_COMPLETED: 'Refund Completed',
  REFUND_REQUESTED: 'Refund Requested',
  ACCOUNT_CREDIT_ISSUED: 'Account Credit',
  BALANCE_TRANSFER_NOTICE: 'Balance Transfer',
}

export default async function CorrespondencePage() {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const entries = await listPortalCorrespondence(authState.customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-6">Correspondence</h1>

        {entries.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/50 text-sm">No correspondence yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-white text-sm">{e.subject ?? CATEGORY_LABELS[e.category] ?? e.category}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                      {e.invoiceNumber ? ` — Invoice ${e.invoiceNumber}` : ''}
                    </p>
                  </div>
                  <span className="text-white/40 text-xs shrink-0">{formatDate(e.sentAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
