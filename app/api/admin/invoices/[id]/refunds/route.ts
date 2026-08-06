// GET  /api/admin/invoices/[id]/refunds — full refund/account-credit ledger
//      for this invoice, regardless of origin (standalone or backorder)
// POST /api/admin/invoices/[id]/refunds — request a standalone refund
//      and/or account credit, independent of any backorder compensation
//      (see lib/refunds.ts's requestRefund). Completing/failing/cancelling
//      an existing refund is still PATCH /refunds/[refundId] — unchanged,
//      already fully generic regardless of which route created the refund.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requestRefund, listRefundsForInvoice } from '@/lib/refunds'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const PAYMENT_METHODS = ['NA', 'CASH', 'COD', 'CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'PAYPAL', 'BANK_TRANSFER', 'STRIPE'] as const

const requestRefundSchema = z
  .object({
    refundAmount: z.number().positive().optional(),
    accountCreditAmount: z.number().positive().optional(),
    reason: z.string().min(1, 'A reason is required'),
    method: z.enum(PAYMENT_METHODS).optional(),
    relatedPaymentId: z.string().optional(),
  })
  .refine((v) => (v.refundAmount ?? 0) > 0 || (v.accountCreditAmount ?? 0) > 0, {
    message: 'Enter a refund amount, an account credit amount, or both',
  })

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const ledger = await listRefundsForInvoice(id)
  return NextResponse.json(ledger)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const payload = requestRefundSchema.parse(body)

    const result = await requestRefund(id, {
      refundAmount: payload.refundAmount,
      accountCreditAmount: payload.accountCreditAmount,
      reason: payload.reason,
      method: payload.method,
      relatedPaymentId: payload.relatedPaymentId,
      requestedBy: userId!,
    })

    await prisma.adminAuditLog.create({
      data: {
        action: 'REQUEST_REFUND',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { refundId: result.refund?.id, accountCreditId: result.accountCredit?.id, reason: payload.reason },
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id/refunds POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to request refund'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
