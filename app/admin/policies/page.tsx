// Admin Policies & Operations Center (2026-08-20) -- the canonical,
// owner-facing operating-rules reference. Server component: resolves the
// real POLICIES data (which transitively imports Prisma) and passes it as
// plain serializable props into the client PolicyCenter component, which
// never imports lib/policies/data.ts directly (see PolicyCenter.tsx's own
// header for why that matters).
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { PolicyCenter } from '@/components/admin/PolicyCenter'
import { POLICIES, CATEGORY_LABEL } from '@/lib/policies/data'

export default async function PoliciesPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[900px] mx-auto">
        <AdminPageHeader
          title="Policies & Operations"
          subtitle="Current Pepscore operating rules, in plain English · Pepscore Lab"
          actions={
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          }
        />
        <PolicyCenter policies={POLICIES} categoryLabels={CATEGORY_LABEL} />
      </div>
    </main>
  )
}
