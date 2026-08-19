// Admin reservation browser + discrepancy-correction workspace --
// "Admin must be able to inspect reservations by invoice/invoice line/
// product/customer/status." Search runs server-side on load with whatever
// query params are present; corrections happen client-side against
// /api/admin/inventory/reservations/[id].
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { findReservations } from '@/lib/inventory/corrections'
import { ReservationCorrectionPanel } from '@/components/admin/ReservationCorrectionPanel'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

interface Props {
  searchParams: Promise<{ invoiceId?: string; productId?: string; status?: string }>
}

export default async function AdminReservationsPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/inventory/reservations')
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

  const params = await searchParams
  const status = params.status === 'ACTIVE' || params.status === 'RELEASED' || params.status === 'FULFILLED' ? params.status : undefined
  const reservations = await findReservations({ invoiceId: params.invoiceId, productId: params.productId, status })

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1200px] mx-auto">
        <AdminPageHeader
          title="Reservations"
          subtitle="Inspect and correct inventory reservations by invoice, product, or status"
          actions={
            <Link href="/admin/inventory" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
              ← Inventory
            </Link>
          }
        />

        <ReservationCorrectionPanel reservations={reservations} defaultStatus={status ?? 'ACTIVE'} />
      </div>
    </main>
  )
}
