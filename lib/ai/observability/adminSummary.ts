// AI-1.4 -- read-side aggregation backing the Admin AI Control Panel
// (app/admin/intelligence/ai-status/page.tsx). Purely observational: shows
// what state the AI foundation is actually in (flag, provider config
// presence -- never secret values, model routes, spend, safety events,
// corpus size) so an owner can judge activation readiness without reading
// code or a database console. Never fabricates a summary -- an empty
// window returns zeroed/empty structures, not a guess.
//
// Aggregation logic is pure and unit-tested directly; the DB-fetching
// wrappers follow this repo's established convention of not being
// independently re-tested against a live database (see
// lib/invoice/numbering.test.ts's precedent).
import { prisma } from '@/lib/prisma'
import type { AiPolicyCategory, AiPolicyAction, AiReviewStatus } from '@prisma/client'
import { loadAiConfig } from '../providers/config'
import { MODEL_ROUTES, isRouteApproved } from '../providers/modelRoutes'
import { TIER_2_3_FIXTURES } from '../retrieval/tier23Fixtures'

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

// ─── Configuration status (no DB, no secrets) ───────────────────────────
// AI-1.15 -- publicAiEnabled and liveModelEnabled are reported as two
// separate booleans (not one), matching the two-flag kill-switch split in
// providers/config.ts -- an admin must be able to see "is the public
// route open" and "can any live model call happen at all" as distinct
// facts, not one conflated status. primaryModel/fallbackModel are real
// model identifiers (e.g. "anthropic/claude-haiku-4.5"), not secrets --
// safe to surface directly, unlike gatewayApiKey.
export interface AiConfigStatus {
  publicAiEnabled: boolean
  liveModelEnabled: boolean
  gatewayConfigured: boolean
  primaryModel: string | undefined
  fallbackModel: string | undefined
  primaryModelApproved: boolean
  fallbackModelApproved: boolean
  approvedModelRouteCount: number
  totalModelRouteCount: number
  rateLimitPerMinute: number
  rateLimitPerDay: number
  dailyCostLimitCents: number
  tier2SourceCount: number
  tier3SourceCount: number
}

export function buildConfigStatus(): AiConfigStatus {
  const config = loadAiConfig()
  return {
    publicAiEnabled: config.featureEnabled,
    liveModelEnabled: config.liveModelEnabled,
    gatewayConfigured: !!config.gatewayApiKey,
    primaryModel: config.primaryModel,
    fallbackModel: config.fallbackModel,
    primaryModelApproved: !!config.primaryModel && isRouteApproved(config.primaryModel),
    fallbackModelApproved: !!config.fallbackModel && isRouteApproved(config.fallbackModel),
    approvedModelRouteCount: MODEL_ROUTES.filter((r) => isRouteApproved(r.model)).length,
    totalModelRouteCount: MODEL_ROUTES.length,
    rateLimitPerMinute: config.rateLimitPerMinute,
    rateLimitPerDay: config.rateLimitPerDay,
    dailyCostLimitCents: config.dailyCostLimitCents,
    tier2SourceCount: TIER_2_3_FIXTURES.filter((f) => f.tier === 2).length,
    tier3SourceCount: TIER_2_3_FIXTURES.filter((f) => f.tier === 3).length,
  }
}

// ─── Usage / cost summary ────────────────────────────────────────────────
export interface UsageByModel {
  provider: string
  model: string
  calls: number
  costCents: number
}

export interface UsageSummary {
  totalCalls: number
  successCount: number
  failureCount: number
  fallbackCount: number
  totalCostCents: number
  byModel: UsageByModel[]
}

interface UsageEventInput {
  provider: string
  model: string
  success: boolean
  usedFallback: boolean
  estimatedCostCents: number
}

export function aggregateUsage(events: UsageEventInput[]): UsageSummary {
  const byModel = new Map<string, UsageByModel>()
  let successCount = 0
  let failureCount = 0
  let fallbackCount = 0
  let totalCostCents = 0

  for (const e of events) {
    if (e.success) successCount += 1
    else failureCount += 1
    if (e.usedFallback) fallbackCount += 1
    totalCostCents += e.estimatedCostCents

    const key = `${e.provider}:${e.model}`
    const existing = byModel.get(key)
    if (existing) {
      existing.calls += 1
      existing.costCents += e.estimatedCostCents
    } else {
      byModel.set(key, { provider: e.provider, model: e.model, calls: 1, costCents: e.estimatedCostCents })
    }
  }

  return {
    totalCalls: events.length,
    successCount,
    failureCount,
    fallbackCount,
    totalCostCents,
    byModel: [...byModel.values()].sort((a, b) => b.calls - a.calls),
  }
}

export async function getUsageSummary(days: number): Promise<UsageSummary> {
  const events = await prisma.aiUsageEvent.findMany({
    where: { createdAt: { gte: windowStart(days) } },
    select: { provider: true, model: true, success: true, usedFallback: true, estimatedCostCents: true },
  })
  return aggregateUsage(events)
}

// ─── Compliance / safety summary ─────────────────────────────────────────
export interface ComplianceCategoryCount {
  category: AiPolicyCategory
  count: number
}

export interface ComplianceActionCount {
  action: AiPolicyAction
  count: number
}

export interface ComplianceSummary {
  totalEvents: number
  byCategory: ComplianceCategoryCount[]
  byAction: ComplianceActionCount[]
  unreviewedEscalations: number
}

interface ComplianceEventInput {
  policyCategory: AiPolicyCategory
  policyAction: AiPolicyAction
  reviewStatus: AiReviewStatus
}

export function aggregateCompliance(events: ComplianceEventInput[]): ComplianceSummary {
  const byCategory = new Map<AiPolicyCategory, number>()
  const byAction = new Map<AiPolicyAction, number>()
  let unreviewedEscalations = 0

  for (const e of events) {
    byCategory.set(e.policyCategory, (byCategory.get(e.policyCategory) ?? 0) + 1)
    byAction.set(e.policyAction, (byAction.get(e.policyAction) ?? 0) + 1)
    if (e.policyAction === 'ESCALATE' && e.reviewStatus === 'UNREVIEWED') unreviewedEscalations += 1
  }

  return {
    totalEvents: events.length,
    byCategory: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byAction: [...byAction.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count),
    unreviewedEscalations,
  }
}

export async function getComplianceSummary(days: number): Promise<ComplianceSummary> {
  const events = await prisma.aiComplianceEvent.findMany({
    where: { createdAt: { gte: windowStart(days) } },
    select: { policyCategory: true, policyAction: true, reviewStatus: true },
  })
  return aggregateCompliance(events)
}

// ─── Safety review queue ──────────────────────────────────────────────────
// Unreviewed ESCALATE events, most recent first -- the concrete "what does
// an admin need to look at" list. Read-only for this checkpoint (owner
// instruction: audit sufficiency, do not overbuild); a mark-as-reviewed
// workflow is a real but separate admin-control addition, not required for
// pre-activation observability.
export interface ReviewQueueEntry {
  id: string
  policyCategory: AiPolicyCategory
  feature: string
  classifierConfidence: number | null
  classifierMethod: string | null
  repeatCount: number
  createdAt: Date
}

export async function getReviewQueue(limit = 25): Promise<ReviewQueueEntry[]> {
  return prisma.aiComplianceEvent.findMany({
    where: { policyAction: 'ESCALATE', reviewStatus: 'UNREVIEWED' },
    select: {
      id: true,
      policyCategory: true,
      feature: true,
      classifierConfidence: true,
      classifierMethod: true,
      repeatCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// Closes the review-queue loop (AI-1.9): the queue was read-only in AI-1.4
// by deliberate scope decision, but a queue nothing can ever clear isn't a
// real compliance-review capability, just visibility. Marks REVIEWED, not
// ESCALATED_TO_OWNER -- an admin escalating further to the owner is a
// separate, not-yet-requested action, not implied by "an admin looked at
// this."
export async function markComplianceEventReviewed(id: string) {
  return prisma.aiComplianceEvent.update({ where: { id }, data: { reviewStatus: 'REVIEWED' } })
}
