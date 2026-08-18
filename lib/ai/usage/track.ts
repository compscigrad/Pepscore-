// AI-0B.3 -- writes to AiUsageEvent + the daily cost-budget check (owner
// instruction: "Design configurable budgets/limits before AI-1"). The
// write itself follows the same convention as lib/ai/compliance/log.ts
// (not independently DB-tested in the fast unit suite); isCostLimitExceeded
// is pure and is unit-tested directly.
import { prisma } from '@/lib/prisma'

export interface TrackUsageParams {
  userId?: string
  provider: string
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  estimatedCostCents: number
  success: boolean
  usedFallback?: boolean
}

export async function trackUsageEvent(params: TrackUsageParams) {
  return prisma.aiUsageEvent.create({
    data: { ...params, usedFallback: params.usedFallback ?? false },
  })
}

// A single shared daily ceiling for AI-0B foundation, not yet per-user --
// per-role/per-user budgets are an AI-1 cost-model decision, out of scope
// here (owner instruction: "Do not define public-production budgets yet").
export async function getTodaysCostCents(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const result = await prisma.aiUsageEvent.aggregate({
    where: { createdAt: { gte: startOfDay } },
    _sum: { estimatedCostCents: true },
  })
  return result._sum.estimatedCostCents ?? 0
}

export function isCostLimitExceeded(spentCents: number, limitCents: number): boolean {
  return spentCents >= limitCents
}
