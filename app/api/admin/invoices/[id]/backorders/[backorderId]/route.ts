// PATCH /api/admin/invoices/[id]/backorders/[backorderId] — resolve an
// active backorder. Compensation and history are never touched by this —
// see lib/backorders.ts's resolveBackorder.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { resolveBackorder } from '@/lib/backorders'

const resolveSchema = z.object({
  resolutionNote: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ id: string; backorderId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, backorderId } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const { resolutionNote } = resolveSchema.parse(body)

    const resolved = await resolveBackorder(backorderId, { resolvedBy: userId!, resolutionNote })

    await prisma.adminAuditLog.create({
      data: {
        action: 'RESOLVE_BACKORDER',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { backorderConditionId: resolved.id, productName: resolved.productName },
      },
    })

    return NextResponse.json(resolved)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/backorders/:backorderId PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to resolve backorder'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
