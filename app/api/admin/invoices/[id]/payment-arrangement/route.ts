// POST  /api/admin/invoices/[id]/payment-arrangement — the pre-existing
//       admin-direct path: set up an installment plan immediately (records
//       the initial payment and generates the future schedule in one
//       transaction, auto-approved — see lib/paymentArrangements.ts).
// PATCH { action: 'approve', numberOfPayments?, frequency? } |
//       { action: 'deny', reason? } — Sections 18/19: review a
//       client-submitted REQUESTED arrangement. Authenticated admin action,
//       audit-logged (adminId + timestamp) — see Section 17's "dashboard
//       remains the authoritative interface" preference over a public
//       one-click email token.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createPaymentArrangement } from '@/lib/paymentArrangements'
import { approveArrangementRequest, denyArrangementRequest, InvoiceIssuanceError } from '@/lib/invoices'
import { paymentArrangementPayloadSchema } from '@/lib/invoice/validation'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

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

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    numberOfPayments: z.number().int().min(1).optional(),
    frequency: z.enum(['WEEKLY', 'BIWEEKLY']).optional(),
  }),
  z.object({ action: z.literal('deny'), reason: z.string().optional() }),
])

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = patchSchema.parse(body)

    if (parsed.action === 'approve') {
      const invoice = await approveArrangementRequest(id, userId!, {
        numberOfPayments: parsed.numberOfPayments,
        frequency: parsed.frequency,
      })
      await prisma.adminAuditLog.create({
        data: { action: 'APPROVE_PAYMENT_ARRANGEMENT', entity: 'Invoice', entityId: id, adminId: userId! },
      })
      return NextResponse.json(invoice)
    }

    const invoice = await denyArrangementRequest(id, userId!, parsed.reason)
    await prisma.adminAuditLog.create({
      data: { action: 'DENY_PAYMENT_ARRANGEMENT', entity: 'Invoice', entityId: id, adminId: userId!, details: { reason: parsed.reason ?? null } },
    })
    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvoiceIssuanceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/invoices/:id/payment-arrangement PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update the payment arrangement'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
