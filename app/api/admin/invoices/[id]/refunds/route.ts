// GET  /api/admin/invoices/[id]/refunds — full refund/account-credit ledger
//      for this invoice, regardless of origin (standalone or backorder)
// POST /api/admin/invoices/[id]/refunds — request a refund and/or account
//      credit, independent of any backorder compensation. Two request
//      shapes share this one route rather than splitting into a second
//      endpoint: the original whole-invoice/account-credit shape (see
//      lib/refunds.ts's requestRefund), and a new `lineItems` shape for
//      one-or-more-line-item refunds (lib/refunds.ts's
//      requestLineItemRefunds) — mutually exclusive, discriminated by
//      whether `lineItems` is present. Completing/failing/cancelling an
//      existing refund is still PATCH /refunds/[refundId] — unchanged,
//      already fully generic regardless of which shape created the refund.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requestRefund, requestLineItemRefunds, listRefundsForInvoice } from '@/lib/refunds'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const PAYMENT_METHODS = ['NA', 'CASH', 'COD', 'CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'PAYPAL', 'BANK_TRANSFER', 'STRIPE'] as const

const lineItemSelectionSchema = z.object({
  invoiceItemId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
})

const requestWholeInvoiceRefundSchema = z
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

const requestLineItemRefundSchema = z.object({
  lineItems: z.array(lineItemSelectionSchema).min(1, 'Select at least one line item'),
  reason: z.string().min(1, 'A reason is required'),
  method: z.enum(PAYMENT_METHODS).optional(),
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

    if (body && typeof body === 'object' && 'lineItems' in body) {
      const payload = requestLineItemRefundSchema.parse(body)
      const result = await requestLineItemRefunds(id, {
        selections: payload.lineItems,
        reason: payload.reason,
        method: payload.method,
        requestedBy: userId!,
      })

      await prisma.adminAuditLog.create({
        data: {
          action: 'REQUEST_LINE_ITEM_REFUND',
          entity: 'Invoice',
          entityId: id,
          adminId: userId!,
          details: {
            refundIds: result.refunds.map((r) => r.id),
            invoiceItemIds: payload.lineItems.map((s) => s.invoiceItemId),
            reason: payload.reason,
          },
        },
      })

      return NextResponse.json(result, { status: 201 })
    }

    const payload = requestWholeInvoiceRefundSchema.parse(body)

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
