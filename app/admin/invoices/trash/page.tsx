// Trash — invoices moved here via the Delete button on an invoice's edit
// page. Kept separate from the main dashboard query so the (normally empty)
// active list never pays a cost for trash bookkeeping.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listTrashedInvoices } from '@/lib/invoices'
import { TrashTable } from '@/components/invoices/TrashTable'

export default async function TrashPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const invoices = await listTrashedInvoices()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Trash</h1>
            <p className="text-white/50 text-sm mt-1">Deleted invoices · Pepscore</p>
          </div>
          <Link
            href="/admin/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Invoices
          </Link>
        </div>

        <TrashTable
          initialInvoices={invoices.map((inv) => ({ ...inv, deletedAt: inv.deletedAt!.toISOString() }))}
        />
      </div>
    </main>
  )
}
