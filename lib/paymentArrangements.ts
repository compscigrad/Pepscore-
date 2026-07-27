// Data access for installment payment arrangements. Kept separate from
// lib/invoices.ts (which owns the invoice's own amountPaid/balanceDue/status
// fields — the authoritative financial totals) so this module only ever
// adds schedule/installment tracking on top, never re-derives money math
// that already lives elsewhere.
import { prisma } from '@/lib/prisma'
import { generateInstallmentSchedule, addDaysUTC, frequencyIntervalDays, type PaymentFrequency } from '@/lib/invoice/paymentArrangement'
import { recommendInstallmentCount } from '@/lib/invoice/status'
import type { InvoicePayment } from '@prisma/client'

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

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
      // The admin creating this directly from the dashboard is itself the
      // approval — unchanged from before ArrangementRequestStatus existed.
      // Only a client-submitted request (requestPaymentArrangement below)
      // ever starts life as REQUESTED.
      status: 'APPROVED',
      decidedAt: new Date(),
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

// "Active" means APPROVED with a schedule that still has at least one
// payment owed — used by the Fulfillment Gate (lib/fulfillment/gate.ts) to
// allow shipping before an invoice is fully paid off, as long as an
// *approved* plan is in place. A REQUESTED (not yet reviewed) or DENIED
// arrangement is never active — an unapproved request must never grant
// fulfillment eligibility on its own (Section 13/17).
export async function hasActivePaymentArrangement(invoiceId: string): Promise<boolean> {
  const arrangement = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (!arrangement || arrangement.status !== 'APPROVED') return false

  const pending = await prisma.paymentArrangementInstallment.findFirst({
    where: { arrangementId: arrangement.id, status: 'PENDING' },
  })
  return !!pending
}

// Called from lib/invoices.ts's recordPayment() after any payment is
// recorded — if the invoice has an *approved* arrangement with a pending
// installment, the new payment satisfies the earliest one in schedule
// order. A no-op for invoices without an arrangement, and for a
// still-REQUESTED (unapproved) one — a payment must never silently treat an
// unreviewed request as if it were active.
export async function matchPaymentToNextPendingInstallment(invoiceId: string, payment: InvoicePayment) {
  const arrangement = await prisma.paymentArrangement.findUnique({ where: { invoiceId } })
  if (!arrangement || arrangement.status !== 'APPROVED') return

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

export interface RequestPaymentArrangementInput {
  frequency: PaymentFrequency
  // The client's stated intention only — never counted toward amountPaid
  // until an admin actually records and confirms receipt of it (Section 14).
  proposedDownPayment: number
}

// Client-initiated (Section 15) — the request sits at REQUESTED until an
// admin reviews it (approveArrangement/denyArrangement below). Installment
// count is never client-chosen; it's the Section 14 recommendation
// (recommendInstallmentCount), scheduled starting one interval from today
// since nothing has actually been received yet to anchor a first
// installment to (contrast with createPaymentArrangement's admin-direct
// path, which anchors installment #1 to a real prior payment when one
// exists). PaymentArrangement.invoiceId is @unique, so a second request
// after a DENIED one revises that same row in place (new proposed terms,
// back to REQUESTED) rather than creating a second record — the denial's
// own decidedAt/decidedBy/denialReason are overwritten by design, since a
// fresh request supersedes them; a REQUESTED or APPROVED arrangement is
// never overwritten this way, and lib/customers.ts's timeline separately
// preserves the plain-text history of what happened when.
export async function requestPaymentArrangement(invoiceId: string, input: RequestPaymentArrangementInput) {
  const existing = await prisma.paymentArrangement.findUnique({ where: { invoiceId }, include: { installments: true } })
  if (existing && existing.status !== 'DENIED') {
    throw new Error('This invoice already has a payment arrangement in progress')
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  if (invoice.balanceDue <= 0) {
    throw new Error('This invoice has no remaining balance to schedule')
  }
  if (input.proposedDownPayment < 0 || input.proposedDownPayment > invoice.balanceDue) {
    throw new Error('Proposed down payment must be between $0 and the remaining balance')
  }

  const balanceToSchedule = round2(invoice.balanceDue - input.proposedDownPayment)
  const numberOfPayments = recommendInstallmentCount(balanceToSchedule)
  if (numberOfPayments < 1) {
    throw new Error('The proposed down payment covers the full remaining balance — choose Pay in Full instead')
  }

  const intervalDays = frequencyIntervalDays(input.frequency)
  const firstDueDate = addDaysUTC(new Date(), intervalDays)
  const generated = generateInstallmentSchedule({
    firstDueDate,
    totalAmount: balanceToSchedule,
    numberOfPayments,
    frequency: input.frequency,
    startInstallmentNumber: 1,
  })

  const data = {
    initialPaymentAmount: 0,
    initialPaymentDate: new Date(),
    remainingPayments: numberOfPayments,
    frequency: input.frequency,
    status: 'REQUESTED' as const,
    proposedDownPayment: input.proposedDownPayment,
    requestedAt: new Date(),
    decidedAt: null,
    decidedBy: null,
    denialReason: null,
  }
  const installmentRows = generated.map((s) => ({
    installmentNumber: s.installmentNumber,
    dueDate: s.dueDate,
    amount: s.amount,
    status: 'PENDING' as const,
  }))

  if (existing) {
    await prisma.paymentArrangementInstallment.deleteMany({ where: { arrangementId: existing.id } })
    return prisma.paymentArrangement.update({
      where: { id: existing.id },
      data: { ...data, installments: { create: installmentRows } },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    })
  }

  return prisma.paymentArrangement.create({
    data: { invoiceId, ...data, installments: { create: installmentRows } },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

export interface ApproveArrangementOverrides {
  numberOfPayments?: number
  frequency?: PaymentFrequency
}

// Section 18 — an admin reviewing a REQUESTED arrangement may approve it
// as-proposed, or override the frequency/installment count first (Section
// 14 rule 9) by regenerating the schedule before flipping it to APPROVED.
// Never touches Invoice.status — per the Mandatory Positive-Balance rule
// (Section 31), approval only ever moves PaymentIntentStatus.
export async function approveArrangement(invoiceId: string, adminUserId: string, overrides?: ApproveArrangementOverrides) {
  const arrangement = await prisma.paymentArrangement.findUniqueOrThrow({
    where: { invoiceId },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
  if (arrangement.status !== 'REQUESTED') {
    throw new Error('This arrangement is not awaiting approval')
  }

  let installmentUpdate = {}
  if (overrides?.numberOfPayments || overrides?.frequency) {
    const frequency = overrides.frequency ?? arrangement.frequency
    const numberOfPayments = overrides.numberOfPayments ?? arrangement.installments.length
    const balanceToSchedule = round2(arrangement.installments.reduce((sum, i) => sum + i.amount, 0))
    const intervalDays = frequencyIntervalDays(frequency)
    const firstDueDate = addDaysUTC(new Date(), intervalDays)
    const generated = generateInstallmentSchedule({
      firstDueDate,
      totalAmount: balanceToSchedule,
      numberOfPayments,
      frequency,
      startInstallmentNumber: 1,
    })
    await prisma.paymentArrangementInstallment.deleteMany({ where: { arrangementId: arrangement.id } })
    installmentUpdate = {
      frequency,
      remainingPayments: numberOfPayments,
      installments: {
        create: generated.map((s) => ({
          installmentNumber: s.installmentNumber,
          dueDate: s.dueDate,
          amount: s.amount,
          status: 'PENDING' as const,
        })),
      },
    }
  }

  return prisma.paymentArrangement.update({
    where: { id: arrangement.id },
    data: {
      status: 'APPROVED',
      decidedAt: new Date(),
      decidedBy: adminUserId,
      ...installmentUpdate,
    },
    include: { installments: { orderBy: { installmentNumber: 'asc' } } },
  })
}

// Section 19 — denying leaves the arrangement row in place (status DENIED)
// so requestPaymentArrangement can later revise it in place if the client
// submits again. Never touches Invoice.status — the invoice was already
// Pending from the original request and stays Pending; only
// PaymentIntentStatus moves, to ARRANGEMENT_DENIED.
export async function denyArrangement(invoiceId: string, adminUserId: string, reason?: string) {
  const arrangement = await prisma.paymentArrangement.findUniqueOrThrow({ where: { invoiceId } })
  if (arrangement.status !== 'REQUESTED') {
    throw new Error('This arrangement is not awaiting approval')
  }

  return prisma.paymentArrangement.update({
    where: { id: arrangement.id },
    data: {
      status: 'DENIED',
      decidedAt: new Date(),
      decidedBy: adminUserId,
      denialReason: reason || undefined,
    },
  })
}
