// [Roadmap] Admin processing-cost analytics -- real Prisma aggregation
// over Payment rows, never fabricated numbers. Only ever includes
// payments that actually reached money-moved states (SUCCEEDED/
// PARTIALLY_REFUNDED/REFUNDED) -- a PROCESSING/FAILED/CANCELLED row never
// actually incurred a processor fee, so including it would overstate cost.
import { prisma } from '@/lib/prisma'
import { STRIPE_CARD_FEE_PERCENT, STRIPE_CARD_FEE_FIXED, STRIPE_ACH_FEE_PERCENT, STRIPE_ACH_FEE_CAP } from '@/lib/stripe'
import type { PaymentStatus } from '@prisma/client'

const FEE_INCURRED_STATUSES: PaymentStatus[] = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED']

export interface PaymentMethodCostSummary {
  methodType: string
  provider: string
  count: number
  totalAmount: number
  totalFees: number
  averageFee: number
  netRevenue: number
}

export interface AchVsCardSavings {
  achCount: number
  achTotalAmount: number
  achActualFees: number
  achEquivalentAsCardFees: number
  savingsFromAchAdoption: number
}

export interface PaymentCostAnalytics {
  byMethod: PaymentMethodCostSummary[]
  totalRevenue: number
  totalFees: number
  netRevenue: number
  totalRefundedAmount: number
  achVsCard: AchVsCardSavings | null
}

export async function getPaymentCostAnalytics(): Promise<PaymentCostAnalytics> {
  const grouped = await prisma.payment.groupBy({
    by: ['methodType', 'provider'],
    where: { status: { in: FEE_INCURRED_STATUSES } },
    _count: { _all: true },
    _sum: { amount: true, stripeFee: true, refundedAmount: true },
  })

  const byMethod: PaymentMethodCostSummary[] = grouped.map((g) => {
    const totalAmount = g._sum.amount ?? 0
    const totalFees = g._sum.stripeFee ?? 0
    return {
      methodType: g.methodType,
      provider: g.provider,
      count: g._count._all,
      totalAmount,
      totalFees,
      averageFee: g._count._all > 0 ? Math.round((totalFees / g._count._all) * 100) / 100 : 0,
      netRevenue: Math.round((totalAmount - totalFees) * 100) / 100,
    }
  })

  const totalRevenue = byMethod.reduce((s, m) => s + m.totalAmount, 0)
  const totalFees = byMethod.reduce((s, m) => s + m.totalFees, 0)
  const totalRefundedAmount = grouped.reduce((s, g) => s + (g._sum.refundedAmount ?? 0), 0)

  // Real formula-based comparison, not a rough rate multiplication: "what
  // this exact ACH volume (same count, same total dollars) would have cost
  // had every one of those transactions instead been a card charge of the
  // same average size" -- STRIPE_CARD_FEE_FIXED applies per-transaction,
  // so it's multiplied by count, not applied once to the aggregate sum.
  const achGroup = byMethod.find((m) => m.methodType === 'ACH')
  const achVsCard: AchVsCardSavings | null = achGroup
    ? {
        achCount: achGroup.count,
        achTotalAmount: achGroup.totalAmount,
        achActualFees: achGroup.totalFees,
        achEquivalentAsCardFees:
          Math.round((achGroup.totalAmount * STRIPE_CARD_FEE_PERCENT + achGroup.count * STRIPE_CARD_FEE_FIXED) * 100) / 100,
        savingsFromAchAdoption:
          Math.round(
            (achGroup.totalAmount * STRIPE_CARD_FEE_PERCENT + achGroup.count * STRIPE_CARD_FEE_FIXED - achGroup.totalFees) * 100
          ) / 100,
      }
    : null

  return {
    byMethod,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    netRevenue: Math.round((totalRevenue - totalFees) * 100) / 100,
    totalRefundedAmount: Math.round(totalRefundedAmount * 100) / 100,
    achVsCard,
  }
}

// Re-exported so a caller that wants the raw ACH cap/rate for display
// (e.g. "ACH: 0.8%, capped at $5") doesn't need a second import path.
export { STRIPE_CARD_FEE_PERCENT, STRIPE_CARD_FEE_FIXED, STRIPE_ACH_FEE_PERCENT, STRIPE_ACH_FEE_CAP }
