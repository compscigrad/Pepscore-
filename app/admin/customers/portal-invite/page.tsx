// Admin -> Customers -> Bulk Portal Invite (2026-08-19 lead-capture/
// conversion engine addendum, section 8-12). A dedicated workspace rather
// than retrofitting checkboxes into the existing Customers & Leads list
// (app/admin/customers/page.tsx) -- keeps that stable, working page
// untouched, matches the existing Reservations-alongside-Inventory
// pattern of a focused bulk-action workspace as its own route.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { computePortalAdoptionOverview } from '@/lib/portal/adoptionStatus'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { BulkPortalInviteWorkspace, type BulkInviteCustomerRow } from '@/components/admin/BulkPortalInviteWorkspace'

export default async function BulkPortalInvitePage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [customers, overview] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { createdAt: 'desc' } }),
    computePortalAdoptionOverview(),
  ])

  const rows: BulkInviteCustomerRow[] = customers.map((c) => {
    const entry = overview.byCustomerId.get(c.id)
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      status: entry?.status ?? 'NOT_ELIGIBLE',
      reason: entry?.reason ?? null,
    }
  })

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Bulk Portal Invite"
          subtitle="Invite existing direct-sale customers to activate online account access · Pepscore Lab"
          actions={
            <>
              <Link
                href="/admin/portal-rollout"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                Rollout Readiness →
              </Link>
              <Link
                href="/admin/customers"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                ← Customers
              </Link>
            </>
          }
        />

        <BulkPortalInviteWorkspace customers={rows} />
      </div>
    </main>
  )
}
