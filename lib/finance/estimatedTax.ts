// Estimated Tax Planning (P1, 2026-08-18). Explicitly a planning aid, not
// a filing tool -- computes a rough quarterly estimate from the owner's
// own flat effective-rate entry (BusinessTaxProfile.estimatedTaxRatePercent)
// times each quarter's real Book Profit from getMonthlySummary(). Never
// computes or suggests a rate itself, never asserts a legal payment
// obligation or due date as fact, and every consumer of this data must
// keep the "Estimate Only -- Not Tax Advice" framing intact -- this
// module deliberately returns amountUnavailableReason rather than a
// silently-zero amount when the rate isn't set, so a caller can't
// accidentally render "$0.00 owed" as if it were a real answer.
import { getMonthlySummary, type MonthlySummaryRow } from './monthlySummary'
import { getBusinessTaxProfile } from './taxProfile'

export interface QuarterlyTaxEstimate {
  quarter: 1 | 2 | 3 | 4
  label: string
  monthsIncluded: string
  estimatedBookProfit: number
  // IRS 2026 quarterly due dates are informational only -- never asserted
  // as a legal filing obligation this system has verified applies to this
  // business. Sourced from the well-known standard federal quarterly
  // schedule, not derived or computed.
  informationalDueDate: string
  estimatedTaxAmount: number | null
}

export interface EstimatedTaxPlan {
  year: number
  ratePercent: number | null
  quarters: QuarterlyTaxEstimate[]
  annualEstimatedBookProfit: number
  annualEstimatedTaxAmount: number | null
  disclaimer: string
}

const DISCLAIMER =
  'Estimate only, not tax advice or a filing. Computed as (real Book Profit for the quarter) x (the flat rate you entered) -- this is not a bracket calculation, does not account for self-employment tax, other income, deductions, or elections, and is not a substitute for a CPA-prepared estimate. Due dates shown are the standard federal quarterly schedule, not a determination that this business owes estimated tax or that this schedule applies to it.'

// Standard federal quarterly estimated-tax due dates. Informational only.
const QUARTER_META: { quarter: 1 | 2 | 3 | 4; label: string; monthsIncluded: string; months: number[]; dueDateTemplate: string }[] = [
  { quarter: 1, label: 'Q1', monthsIncluded: 'Jan – Mar', months: [1, 2, 3], dueDateTemplate: 'April 15' },
  { quarter: 2, label: 'Q2', monthsIncluded: 'Apr – May', months: [4, 5], dueDateTemplate: 'June 15' },
  { quarter: 3, label: 'Q3', monthsIncluded: 'Jun – Aug', months: [6, 7, 8], dueDateTemplate: 'September 15' },
  { quarter: 4, label: 'Q4', monthsIncluded: 'Sep – Dec', months: [9, 10, 11, 12], dueDateTemplate: 'January 15 (following year)' },
]

// Pure -- exported for unit testing. Book Profit for one month =
// estimatedGrossMargin (netRevenue - cogs - shipping - paymentFees) minus
// "other" operating expenses -- the slice of operatingExpenses not
// already isolated into shipping/paymentFees above. Mirrors
// profitLoss.ts's operatingProfit calculation exactly rather than
// re-deriving it a different way (spec: never duplicate a money
// calculation).
export function computeMonthBookProfit(m: Pick<MonthlySummaryRow, 'estimatedGrossMargin' | 'operatingExpenses' | 'shippingExpense' | 'paymentProcessingFees'>): number {
  const otherOpex = Math.max(0, m.operatingExpenses - m.shippingExpense - m.paymentProcessingFees)
  return m.estimatedGrossMargin - otherOpex
}

export async function getEstimatedTaxPlan(year: number): Promise<EstimatedTaxPlan> {
  const [monthly, profile] = await Promise.all([getMonthlySummary(year), getBusinessTaxProfile()])
  const ratePercent = profile?.estimatedTaxRatePercent ?? null

  const quarters: QuarterlyTaxEstimate[] = QUARTER_META.map((qm) => {
    const estimatedBookProfit = monthly
      .filter((m) => qm.months.includes(m.month))
      .reduce((sum, m) => sum + computeMonthBookProfit(m), 0)
    return {
      quarter: qm.quarter,
      label: qm.label,
      monthsIncluded: qm.monthsIncluded,
      estimatedBookProfit,
      informationalDueDate: `${qm.dueDateTemplate}, ${qm.quarter === 4 ? year + 1 : year}`,
      estimatedTaxAmount: ratePercent !== null ? Math.round(estimatedBookProfit * (ratePercent / 100) * 100) / 100 : null,
    }
  })

  const annualEstimatedBookProfit = quarters.reduce((sum, q) => sum + q.estimatedBookProfit, 0)

  return {
    year,
    ratePercent,
    quarters,
    annualEstimatedBookProfit,
    annualEstimatedTaxAmount: ratePercent !== null ? Math.round(annualEstimatedBookProfit * (ratePercent / 100) * 100) / 100 : null,
    disclaimer: DISCLAIMER,
  }
}
