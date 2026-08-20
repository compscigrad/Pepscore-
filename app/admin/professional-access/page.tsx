// Admin Professional Access review queue (2026-08-19 Professional Access
// sprint, sections 11-12). Applications + early-launch invitations in one
// place -- see components/admin/ProfessionalAccessQueue.tsx.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { ProfessionalAccessQueue } from '@/components/admin/ProfessionalAccessQueue'

export default async function ProfessionalAccessAdminPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <AdminPageHeader
          title="Professional Access"
          subtitle="Applications and early-launch invitations · Pepscore Lab"
          actions={
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          }
        />
        <ProfessionalAccessQueue />
      </div>
    </main>
  )
}
