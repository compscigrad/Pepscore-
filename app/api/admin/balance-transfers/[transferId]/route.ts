// PATCH /api/admin/balance-transfers/[transferId] — reverse an active
// balance transfer (lib/balanceTransfers.ts). Never deletes the row; fills
// in reversedAt/reversedBy/reversalReason on the same ledger entry.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { reverseBalanceTransfer, BalanceTransferError } from '@/lib/balanceTransfers'

const reverseSchema = z.object({
  action: z.literal('reverse'),
  reason: z.string().optional(),
})

interface RouteParams {
  params: Promise<{ transferId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { transferId } = await params

  try {
    const body = await req.json()
    const payload = reverseSchema.parse(body)

    await reverseBalanceTransfer({ transferId, reversedBy: userId!, reason: payload.reason || null })

    await prisma.adminAuditLog.create({
      data: {
        action: 'REVERSE_BALANCE_TRANSFER',
        entity: 'BalanceTransfer',
        entityId: transferId,
        adminId: userId!,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof BalanceTransferError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/balance-transfers/:transferId PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to reverse transfer'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
