// Data access for installment payment arrangements. Kept separate from
// lib/invoices.ts (which owns the invoice's own amountPaid/balanceDue/status
// fields — the authoritative financial totals) so this module only ever
// adds schedule/installment tracking on top, never re-derives money math
// that already lives elsewhere.
import { prisma } from '@/lib/prisma'
import { generateInstallmentSchedule, type PaymentFrequency } from '@/lib/invoice/paymentArrangement'
import type { InvoicePayment } from '@prisma/client'

export async function getPaymentArrangement(invoiceId: string) {
  return prisma.paymentArrangement.findUnique({
    where: { invoiceId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

export interface CreatePaymentArrangementInput {
  remainingPayments: number
  frequency: PaymentFrequency
}

// Sets up an installment schedule for an invoice that already has at least
// one payment recorded (status Partial). Deliberately does NOT record a new
// payment or touch Invoice.amountPaid/balanceDue — "Initial Payment
// Amount/Date" describe what has *already* been paid (derived from the
// invoice's own payment history, not client input), and "Remaining Balance"
// is simply the invoice's current balanceDue. This guarantees the
// arrangement can never disagree with the invoice's real financial state —
// there's nothing for it to disagree with, since it doesn't introduce any
// new numbers of its own for the paid-so-far side of the ledger.
export async function createPaymentArrangement(invoiceId: string, input: CreatePaymentArrangementInput) {
  const existing = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (existing) throw new Error('This invoice already has a payment arrangement')

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { orderBy: { paidAt: 'asc' } } },
  })

  if (invoice.amountPaid <= 0) {
    throw new Error('Record at least one payment before setting up a payment arrangement')
  }
  if (invoice.balanceDue <= 0) {
    throw new Error('This invoice has no remaining balance to schedule')
  }

  const initialPaymentAmount = invoice.amountPaid
  const initialPaymentDate = invoice.payments[0]?.paidAt ?? new Date()
  const remainingBalance = invoice.balanceDue

  const futureInstallments = generateInstallmentSchedule({
    initialPaymentDate,
    remainingBalance,
    numberOfRemainingPayments: input.remainingPayments,
    frequency: input.frequency,
  })

  return prisma.paymentArrangement.create({
    data: {
      invoiceId,
      initialPaymentAmount,
      initialPaymentDate,
      remainingPayments: input.remainingPayments,
      frequency: input.frequency,
      installments: {
        create: [
          {
            installmentNumber: 1,
            dueDate: initialPaymentDate,
            amount: initialPaymentAmount,
            status: 'PAID',
            paidAt: initialPaymentDate,
          },
          ...futureInstallments.map((s) => ({
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
