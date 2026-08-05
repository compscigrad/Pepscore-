// POST /api/admin/invoices/[id]/balance-transfers — move this invoice's
// remaining balance onto another invoice (lib/balanceTransfers.ts).
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { transferBalance, BalanceTransferError } from '@/lib/balanceTransfers'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const transferBalanceSchema = z.object({
  destinationInvoiceId: z.string().min(1, 'Select a destination invoice'),
  amount: z.number().positive('Transfer amount must be greater than zero'),
  reason: z.string().optional(),
  archiveSource: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = transferBalanceSchema.parse(body)

    const destination = await transferBalance({
      sourceInvoiceId: id,
      destinationInvoiceId: payload.destinationInvoiceId,
      amount: payload.amount,
      reason: payload.reason || null,
      transferredBy: userId!,
      archiveSource: payload.archiveSource,
    })

    await prisma.adminAuditLog.create({
      data: {
        action: 'TRANSFER_BALANCE',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { destinationInvoiceId: payload.destinationInvoiceId, amount: payload.amount },
      },
    })

    return NextResponse.json(destination, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof BalanceTransferError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/invoices/:id/balance-transfers POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to transfer balance'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
