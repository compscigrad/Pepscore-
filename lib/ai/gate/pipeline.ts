// AI-0B.5 -- composes AI-0B.1-4 into one fail-closed request pipeline:
// rate limit -> budget check -> input policy gate -> provider call (with
// automatic primary/fallback) -> output policy gate, logging compliance
// and usage events throughout. This is the single entry point a future
// caller should invoke, rather than wiring the pieces together itself.
//
// Owner instruction, item 12: a fallback provider undergoes the exact same
// policy/permission/output-validation path as primary. There is no
// separate "fallback path" here -- ProviderRouter (AI-0B.1) already makes
// this automatic, since the output policy gate below runs on whatever
// text came back regardless of which provider produced it.
//
// Owner instruction, item 8 (fail closed): every stage that can fail --
// rate limiting, budget, classification, the provider call itself --
// returns a specific non-ALLOW outcome rather than throwing past this
// function into an unhandled state. Nothing in this pipeline can result in
// generated text reaching a caller without both policy gates having
// explicitly passed it.
import type { ProviderRouter } from '../providers/router'
import type { AiProvider, CompletionRequest } from '../providers/types'
import type { AiConfig } from '../providers/config'
import type { AiRole } from '../permissions/roles'
import { runInputPolicyGate, runOutputPolicyGate } from '../policy/engine'
import { logComplianceEvent as defaultLogComplianceEvent } from '../compliance/log'
import { trackUsageEvent as defaultTrackUsageEvent, getTodaysCostCents as defaultGetTodaysCostCents } from '../usage/track'
import { isCostLimitExceeded } from '../usage/track'
import { estimateCostCents } from '../usage/cost'
import { checkAiRateLimit } from './rateLimiter'

export type PipelineOutcome =
  | { status: 'RATE_LIMITED'; retryAfterSeconds?: number }
  | { status: 'BUDGET_EXCEEDED' }
  | { status: 'REFUSED'; reason: string }
  | { status: 'ESCALATED'; reason: string }
  | { status: 'COMPLETED'; text: string; provider: string; model: string; usedFallback: boolean }
  | { status: 'PROVIDER_FAILURE'; reason: string }

export interface PipelineParams {
  text: string
  identifier: string
  role: AiRole
  feature: string
  userId?: string
  sessionId?: string
  router: ProviderRouter
  classifierProvider?: AiProvider | null
  config: AiConfig
}

// Injectable so tests can exercise the full orchestration (rate limiting,
// budget, both policy gates, provider failover) without touching a real
// database -- matches this repo's established convention of not
// DB-testing audit-log writes directly (see lib/invoice/numbering.test.ts).
export interface PipelineDeps {
  logComplianceEvent?: typeof defaultLogComplianceEvent
  trackUsageEvent?: typeof defaultTrackUsageEvent
  getTodaysCostCents?: typeof defaultGetTodaysCostCents
}

export async function runAiPipeline(params: PipelineParams, deps: PipelineDeps = {}): Promise<PipelineOutcome> {
  const logComplianceEvent = deps.logComplianceEvent ?? defaultLogComplianceEvent
  const trackUsageEvent = deps.trackUsageEvent ?? defaultTrackUsageEvent
  const getTodaysCostCents = deps.getTodaysCostCents ?? defaultGetTodaysCostCents

  // 1. Rate limit -- fails closed (deny) before any cost is incurred.
  const rateLimit = checkAiRateLimit(params.identifier, params.role, {
    perMinute: params.config.rateLimitPerMinute,
    perDay: params.config.rateLimitPerDay,
  })
  if (!rateLimit.allowed) {
    return { status: 'RATE_LIMITED', retryAfterSeconds: rateLimit.perMinute.retryAfterSeconds ?? rateLimit.perDay.retryAfterSeconds }
  }

  // 2. Budget -- fails closed before any provider call.
  const spentCents = await getTodaysCostCents()
  if (isCostLimitExceeded(spentCents, params.config.dailyCostLimitCents)) {
    return { status: 'BUDGET_EXCEEDED' }
  }

  // 3. Input policy gate -- runInputPolicyGate never throws (AI-0B.2's own
  // fail-closed guarantee); its result is trusted directly here.
  const { classification, decision } = await runInputPolicyGate(params.text, params.role, params.classifierProvider)

  await logComplianceEvent({
    userId: params.userId,
    sessionId: params.sessionId,
    policyCategory: classification.category,
    policyAction: decision.action,
    feature: params.feature,
    classifierConfidence: classification.confidence,
    classifierMethod: classification.method,
  })

  if (decision.action === 'REFUSE') return { status: 'REFUSED', reason: decision.reason }
  if (decision.action === 'ESCALATE') return { status: 'ESCALATED', reason: decision.reason }

  // 4. Provider call with automatic primary -> fallback (AI-0B.1's router).
  // A failure here (both primary and fallback exhausted) is a safe
  // failure, not a silent continuation -- no text is ever generated.
  const request: CompletionRequest = { messages: [{ role: 'user', content: params.text }] }
  let completion
  try {
    completion = await params.router.complete(request)
  } catch (err) {
    return { status: 'PROVIDER_FAILURE', reason: err instanceof Error ? err.message : 'unknown provider failure' }
  }

  await trackUsageEvent({
    userId: params.userId,
    provider: completion.provider,
    model: completion.model,
    feature: params.feature,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    latencyMs: completion.latencyMs,
    estimatedCostCents: estimateCostCents(completion.inputTokens, completion.outputTokens),
    success: true,
    usedFallback: completion.usedFallback,
  })

  // 5. Output policy gate -- runs on whatever text came back, from
  // whichever provider produced it. The fallback provider gets the
  // identical check primary would have (owner instruction, item 12).
  const outputResult = runOutputPolicyGate(completion.text)
  if (outputResult.action === 'REFUSE' || outputResult.action === 'ESCALATE') {
    await logComplianceEvent({
      userId: params.userId,
      sessionId: params.sessionId,
      policyCategory: classification.category,
      policyAction: 'REFUSE',
      feature: `${params.feature}:output-validation`,
    })
    return { status: outputResult.action === 'REFUSE' ? 'REFUSED' : 'ESCALATED', reason: outputResult.reason }
  }

  return { status: 'COMPLETED', text: completion.text, provider: completion.provider, model: completion.model, usedFallback: completion.usedFallback }
}
