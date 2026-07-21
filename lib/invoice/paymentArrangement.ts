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

// UTC-based day arithmetic — mirrors lib/invoice/format.ts's forced-UTC date
// display so a schedule generated from a plain date input never drifts a day
// depending on the server's local timezone.
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Generates installments #2 onward — installment #1 is always the initial
// payment itself, created separately alongside the arrangement. Splits
// remainingBalance evenly across numberOfRemainingPayments, with the final
// installment absorbing whatever rounding remainder is left so the schedule
// always sums to exactly remainingBalance (the invoice balance lands on
// exactly $0.00 once every installment is paid).
export function generateInstallmentSchedule({
  initialPaymentDate,
  remainingBalance,
  numberOfRemainingPayments,
  frequency,
}: {
  initialPaymentDate: Date
  remainingBalance: number
  numberOfRemainingPayments: number
  frequency: PaymentFrequency
}): ScheduledInstallment[] {
  if (numberOfRemainingPayments < 1) return []

  const intervalDays = FREQUENCY_INTERVAL_DAYS[frequency]
  const baseAmount = Math.floor((remainingBalance / numberOfRemainingPayments) * 100) / 100

  const installments: ScheduledInstallment[] = []
  let runningTotal = 0

  for (let i = 1; i <= numberOfRemainingPayments; i++) {
    const isLast = i === numberOfRemainingPayments
    const amount = isLast ? round2(remainingBalance - runningTotal) : baseAmount
    runningTotal = round2(runningTotal + amount)

    installments.push({
      installmentNumber: i + 1, // #1 is the initial payment, not generated here
      dueDate: addDaysUTC(initialPaymentDate, intervalDays * i),
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
