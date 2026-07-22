// Data access for installment payment arrangements. Kept separate from
// lib/invoices.ts (which owns the invoice's own amountPaid/balanceDue/status
// fields — the authoritative financial totals) so this module only ever
// adds schedule/installment tracking on top, never re-derives money math
// that already lives elsewhere.
import { prisma } from '@/lib/prisma'
import { generateInstallmentSchedule, addDaysUTC, frequencyIntervalDays, type PaymentFrequency } from '@/lib/invoice/paymentArrangement'
import type { InvoicePayment } from '@prisma/client'

export async function getPaymentArrangement(invoiceId: string) {
  return prisma.paymentArrangement.findUnique({
    where: { invoiceId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

export interface CreatePaymentArrangementInput {
  numberOfPayments: number
  frequency: PaymentFrequency
  // Required only when the invoice has no payment recorded yet — with a
  // prior payment, the schedule anchors off that payment's date instead.
  startDate?: Date
}

// Sets up an installment schedule for the invoice's current balance —
// available on any invoice with a balance left to schedule, whether or not
// anything has been paid yet ("just in case it needs to be utilized").
//
// When the invoice already has a payment, installment #1 is that payment
// itself (derived from history, immediately PAID — see docs/Decisions.md
// #16 for why this doesn't record a second, redundant transaction) and the
// generated schedule continues from there. When it doesn't, there's no
// history to derive from, so the *entire* schedule is generated fresh
// starting from the admin-provided start date, and nothing is pre-marked
// paid — the first real payment recorded through the normal Record Payment
// flow satisfies installment #1 via matchPaymentToNextPendingInstallment().
export async function createPaymentArrangement(invoiceId: string, input: CreatePaymentArrangementInput) {
  const existing = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (existing) throw new Error('This invoice already has a payment arrangement')

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { orderBy: { paidAt: 'asc' } } },
  })

  if (invoice.balanceDue <= 0) {
    throw new Error('This invoice has no remaining balance to schedule')
  }

  const hasExistingPayment = invoice.amountPaid > 0
  const intervalDays = frequencyIntervalDays(input.frequency)

  let initialInstallment: {
    installmentNumber: number
    dueDate: Date
    amount: number
    status: 'PAID'
    paidAt: Date
  } | null = null
  let firstGeneratedDueDate: Date
  let startInstallmentNumber: number
  let initialPaymentAmount: number
  let initialPaymentDate: Date

  if (hasExistingPayment) {
    const earliestPaymentDate = invoice.payments[0].paidAt
    initialInstallment = {
      installmentNumber: 1,
      dueDate: earliestPaymentDate,
      amount: invoice.amountPaid,
      status: 'PAID',
      paidAt: earliestPaymentDate,
    }
    firstGeneratedDueDate = addDaysUTC(earliestPaymentDate, intervalDays)
    startInstallmentNumber = 2
    initialPaymentAmount = invoice.amountPaid
    initialPaymentDate = earliestPaymentDate
  } else {
    if (!input.startDate) {
      throw new Error('A start date is required for an invoice with no payments recorded yet')
    }
    firstGeneratedDueDate = input.startDate
    startInstallmentNumber = 1
    initialPaymentAmount = 0
    initialPaymentDate = input.startDate
  }

  const generated = generateInstallmentSchedule({
    firstDueDate: firstGeneratedDueDate,
    totalAmount: invoice.balanceDue,
    numberOfPayments: input.numberOfPayments,
    frequency: input.frequency,
    startInstallmentNumber,
  })

  return prisma.paymentArrangement.create({
    data: {
      invoiceId,
      initialPaymentAmount,
      initialPaymentDate,
      remainingPayments: input.numberOfPayments,
      frequency: input.frequency,
      installments: {
        create: [
          ...(initialInstallment ? [initialInstallment] : []),
          ...generated.map((s) => ({
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate,
            amount: s.amount,
            status: 'PENDING' as const,
          })),
        ],
      },
    },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

// "Active" means there's a schedule with at least one payment still owed —
// used by the Fulfillment Gate (lib/fulfillment/gate.ts) to allow shipping
// before an invoice is fully paid off, as long as a plan is in place.
export async function hasActivePaymentArrangement(invoiceId: string): Promise<boolean> {
  const arrangement = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (!arrangement) return false

  const pending = await prisma.paymentArrangementInstallment.findFirst({
    where: { arrangementId: arrangement.id, status: 'PENDING' },
  })
  return !!pending
}

// Called from lib/invoices.ts's recordPayment() after any payment is
// recorded — if the invoice has an arrangement with a pending installment,
// the new payment satisfies the earliest one in schedule order. A no-op for
// invoices without an arrangement (the common case).
export async function matchPaymentToNextPendingInstallment(invoiceId: string, payment: InvoicePayment) {
  const arrangement = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (!arrangement) return

  const next = await prisma.paymentArrangementInstallment.findFirst({
    where: { arrangementId: arrangement.id, status: 'PENDING' },
    orderBy: { installmentNumber: 'asc' },
  })
  if (!next) return

  await prisma.paymentArrangementInstallment.update({
    where: { id: next.id },
    data: { status: 'PAID', paidAt: payment.paidAt, paymentId: payment.id },
  })
}
