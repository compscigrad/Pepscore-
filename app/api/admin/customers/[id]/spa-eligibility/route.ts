// GET   /api/admin/customers/[id]/spa-eligibility — current status
// PATCH /api/admin/customers/[id]/spa-eligibility — { action: 'grant' | 'revoke', reason }
//
// SPA/wholesale pricing eligibility is explicit and admin-only (Phase 2B
// section 4) -- never inferred from email domain, geography, name, or
// purchase history. Mirrors the existing portal-invite route's pattern:
// recordCustomerActivity for the customer-facing timeline, AdminAuditLog
// for the admin audit trail.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id }, select: { proEligible: true } })
  return NextResponse.json({ proEligible: customer.proEligible })
}

const patchSchema = z.object({
  action: z.enum(['grant', 'revoke']),
  reason: z.string().min(1, 'A reason is required'),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { action, reason } = patchSchema.parse(await req.json())
    const proEligible = action === 'grant'

    await prisma.customer.update({ where: { id }, data: { proEligible } })
    await recordCustomerActivity({
      customerId: id,
      eventType: proEligible ? 'SPA_ELIGIBILITY_GRANTED' : 'SPA_ELIGIBILITY_REVOKED',
      newValue: reason,
      source: 'MANUAL',
      userId: userId!,
    })
    await prisma.adminAuditLog.create({
      data: {
        action: proEligible ? 'GRANT_SPA_ELIGIBILITY' : 'REVOKE_SPA_ELIGIBILITY',
        entity: 'Customer',
        entityId: id,
        adminId: userId!,
        details: { reason },
      },
    })

    return NextResponse.json({ ok: true, proEligible })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    console.error('[admin/customers/:id/spa-eligibility PATCH]', err)
    return NextResponse.json({ error: 'Failed to update SPA eligibility' }, { status: 400 })
  }
}
