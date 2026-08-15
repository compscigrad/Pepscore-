// Admin Identity Review Queue — every OPEN CustomerIdentityReviewCase from
// self-service sign-up/sign-in (see lib/portal/selfServiceResolve.ts). A
// case drops off the moment it's approved or dismissed; nothing here is
// ever auto-resolved.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { IdentityReviewTable, type IdentityReviewRow } from '@/components/admin/IdentityReviewTable'

export default async function IdentityReviewPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const cases = await prisma.customerIdentityReviewCase.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'asc' },
  })

  const candidateIds = [...new Set(cases.flatMap((c) => c.candidateCustomerIds as string[]))]
  const candidates = candidateIds.length
    ? await prisma.customer.findMany({ where: { id: { in: candidateIds } } })
    : []
  const candidateById = new Map(candidates.map((c) => [c.id, c]))

  const rows: IdentityReviewRow[] = cases.map((c) => ({
    id: c.id,
    reason: c.reason,
    verifiedEmail: c.verifiedEmail,
    createdAt: c.createdAt.toISOString(),
    candidates: (c.candidateCustomerIds as string[])
      .map((id) => candidateById.get(id))
      .filter((cust): cust is NonNullable<typeof cust> => Boolean(cust))
      .map((cust) => ({ id: cust.id, name: `${cust.firstName} ${cust.lastName}`.trim(), email: cust.email })),
  }))

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Identity Review Queue</h1>
            <p className="text-white/50 text-sm mt-1">Self-service sign-ups that need a human to confirm the match · Pepscore Lab</p>
          </div>
          <Link
            href="/admin"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Admin Dashboard
          </Link>
        </div>

        <IdentityReviewTable initialRows={rows} />
      </div>
    </main>
  )
}
