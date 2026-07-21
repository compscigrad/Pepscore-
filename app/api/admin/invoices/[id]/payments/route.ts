// POST /api/admin/invoices/[id]/payments — record a payment against an invoice's balance
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { recordPayment } from '@/lib/invoices'
import { paymentPayloadSchema } from '@/lib/invoice/validation'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = paymentPayloadSchema.parse(body)
    const invoice = await recordPayment(id, payload)

    await prisma.adminAuditLog.create({
      data: {
        action: 'RECORD_PAYMENT',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { amount: payload.amount, method: payload.method, newBalance: invoice.balanceDue },
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/payments POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to record payment'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
