// Business logic for installment/payment-arrangement scheduling — pure and
// framework-agnostic so the same math drives the builder's UI, the API route
// that persists the schedule, and both PDF documents.

export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY'

export interface ScheduledInstallment {
  installmentNumber: number
  dueDate: Date
  amount: number
}

const FREQUENCY_INTERVAL_DAYS: Record<PaymentFrequency, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
}

export function frequencyIntervalDays(frequency: PaymentFrequency): number {
  return FREQUENCY_INTERVAL_DAYS[frequency]
}

// UTC-based day arithmetic — mirrors lib/invoice/format.ts's forced-UTC date
// display so a schedule generated from a plain date input never drifts a day
// depending on the server's local timezone.
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Generates a run of installments — every invoice can have a payment
// arrangement set up "just in case," whether or not anything has been paid
// yet, so this doesn't assume a prior payment exists. The caller decides
// what `firstDueDate` and `startInstallmentNumber` mean for their situation
// (see lib/paymentArrangements.ts):
//   - invoice already has a payment: firstDueDate is one interval after that
//     payment's date, startInstallmentNumber is 2 (installment #1 is the
//     payment itself, added separately by the caller).
//   - invoice has no payment yet: firstDueDate is the admin-chosen start
//     date, startInstallmentNumber is 1 (this call generates the *entire*
//     schedule, including what becomes installment #1).
// Splits totalAmount evenly across numberOfPayments, with the final
// installment absorbing whatever rounding remainder is left so the schedule
// always sums to exactly totalAmount (the invoice balance lands on exactly
// $0.00 once every installment is paid).
export function generateInstallmentSchedule({
  firstDueDate,
  totalAmount,
  numberOfPayments,
  frequency,
  startInstallmentNumber = 1,
}: {
  firstDueDate: Date
  totalAmount: number
  numberOfPayments: number
  frequency: PaymentFrequency
  startInstallmentNumber?: number
}): ScheduledInstallment[] {
  if (numberOfPayments < 1) return []

  const intervalDays = FREQUENCY_INTERVAL_DAYS[frequency]
  const baseAmount = Math.floor((totalAmount / numberOfPayments) * 100) / 100

  const installments: ScheduledInstallment[] = []
  let runningTotal = 0

  for (let i = 0; i < numberOfPayments; i++) {
    const isLast = i === numberOfPayments - 1
    const amount = isLast ? round2(totalAmount - runningTotal) : baseAmount
    runningTotal = round2(runningTotal + amount)

    installments.push({
      installmentNumber: startInstallmentNumber + i,
      dueDate: addDaysUTC(firstDueDate, intervalDays * i),
      amount,
    })
  }

  return installments
}

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID'

// Derived, never stored — Invoice.amountPaid/total are already the
// authoritative financial fields (see lib/invoices.ts), so this stays in
// sync by construction instead of being a second value that could drift.
export function computePaymentStatus(amountPaid: number, total: number): PaymentStatus {
  if (amountPaid <= 0) return 'PENDING'
  if (amountPaid >= total) return 'PAID'
  return 'PARTIAL'
}
