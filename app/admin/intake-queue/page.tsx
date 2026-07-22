// Admin Intake Queue — every intake-originated DRAFT invoice awaiting
// admin follow-up (lib/customers.ts's getFulfillmentQueue, already built).
// A row drops off the moment its status moves off DRAFT; no dismiss action.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFulfillmentQueue } from '@/lib/customers'
import { IntakeQueueTable } from '@/components/invoices/IntakeQueueTable'

export default async function IntakeQueuePage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const queue = await getFulfillmentQueue()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Intake Queue</h1>
            <p className="text-white/50 text-sm mt-1">Customer submissions awaiting review · Pepscore</p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Invoices
            </Link>
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        <IntakeQueueTable
          initialRows={queue.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            customerId: invoice.customerId,
            intakeSubmittedAt: invoice.intakeSubmittedAt!.toISOString(),
            priority: invoice.priority,
          }))}
        />
      </div>
    </main>
  )
}
