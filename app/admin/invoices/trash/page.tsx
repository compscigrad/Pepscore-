// Trash — invoices moved here via the Delete button on an invoice's edit
// page. Kept separate from the main dashboard query so the (normally empty)
// active list never pays a cost for trash bookkeeping.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listTrashedInvoices } from '@/lib/invoices'
import { getBulkInvoiceDeletionEligibility, BLOCK_REASON_LABEL } from '@/lib/invoices/deletionEligibility'
import { TrashTable } from '@/components/invoices/TrashTable'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function TrashPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const invoices = await listTrashedInvoices()
  const eligibility = await getBulkInvoiceDeletionEligibility(invoices.map((inv) => inv.id))
  const eligibilityById = new Map(eligibility.map((e) => [e.invoiceId, e]))

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Trash"
          subtitle="Deleted invoices · Pepscore Lab"
          actions={
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          }
        />

        <TrashTable
          initialInvoices={invoices.map((inv) => {
            const e = eligibilityById.get(inv.id)
            return {
              ...inv,
              deletedAt: inv.deletedAt!.toISOString(),
              eligible: e?.eligible ?? false,
              blockedReasons: e ? e.blockedReasons.map((r) => BLOCK_REASON_LABEL[r]) : [],
            }
          })}
        />
      </div>
    </main>
  )
}
