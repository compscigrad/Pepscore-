// POST /api/admin/invoices/[id]/payment-arrangement — set up an installment
// plan: records the initial payment and generates the future schedule in one
// transaction (see lib/paymentArrangements.ts).
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPaymentArrangement } from '@/lib/paymentArrangements'
import { paymentArrangementPayloadSchema } from '@/lib/invoice/validation'

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
    const payload = paymentArrangementPayloadSchema.parse(body)
    const arrangement = await createPaymentArrangement(id, payload)

    await prisma.adminAuditLog.create({
      data: {
        action: 'CREATE_PAYMENT_ARRANGEMENT',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: {
          numberOfPayments: payload.numberOfPayments,
          frequency: payload.frequency,
          initialPaymentAmount: arrangement.initialPaymentAmount,
        },
      },
    })

    return NextResponse.json(arrangement, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/payment-arrangement POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to create payment arrangement'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
