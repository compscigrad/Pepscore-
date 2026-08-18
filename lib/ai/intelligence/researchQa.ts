// AI-1.13 -- free-text research Q&A, the one Pepscore Intelligence
// capability that genuinely needs a live model: parsing arbitrary intent
// out of a sentence, not matching a fixed system-generated shape the way
// compare/discover/explain (AI-1.3/1.6) do. This is what those modules'
// own headers meant by "stays BLOCKED -- OWNER CREDENTIAL REQUIRED."
//
// The raw question runs through the exact same policy gate as everything
// else in lib/ai/ (via runAiPipeline, no special-casing), then -- only if
// ALLOWED -- through the full generation pipeline (Tier 1 retrieval, live
// provider with failover, output validation). Returns UNAVAILABLE with
// zero network calls if no live provider can be built yet (missing
// credential, no approved model route, or the feature flag itself off) --
// this module is safe to ship before AI_GATEWAY_API_KEY exists, matching
// how every other AI-1 capability was built and dark-deployed this
// session.
import { prisma } from '@/lib/prisma'
import { loadAiConfig } from '../providers/config'
import { buildProviderRouterFromConfig } from '../providers/factory'
import { runAiPipeline } from '../gate/pipeline'
import { Tier1CatalogRetrieval } from '../retrieval/tier1Catalog'
import type { AiRole } from '../permissions/roles'
import type { Citation } from '../citations/citation'

// Cost-safety cap for a real customer-facing answer -- larger than the
// admin live-test route's 200-token verification cap (AI-1.12), still
// deliberately bounded, not "no limit."
const RESEARCH_QA_MAX_TOKENS = 400

export type ResearchQaStatus = 'ALLOWED' | 'REFUSED' | 'ESCALATED' | 'UNAVAILABLE' | 'PROVIDER_FAILURE' | 'RATE_LIMITED' | 'BUDGET_EXCEEDED'

export interface ResearchQaResult {
  status: ResearchQaStatus
  reason?: string
  answer?: string
  citations?: Citation[]
}

// identifier is passed straight through to runAiPipeline's own rate-limit/
// budget check (its step 1) -- the caller (app/api/ai/intelligence/
// route.ts) must NOT also call checkAiRateLimit before this for the 'ask'
// request type, or a single question would consume two rate-limit tokens
// against the same identifier instead of one.
export async function askResearchQuestion(question: string, role: AiRole, identifier: string): Promise<ResearchQaResult> {
  if (!question.trim()) {
    return { status: 'REFUSED', reason: 'A question is required.' }
  }

  const config = loadAiConfig()
  const router = buildProviderRouterFromConfig(config)
  if (!router) {
    return { status: 'UNAVAILABLE', reason: 'Free-text research Q&A is not currently available.' }
  }

  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, size: true, category: true, searchSynonyms: true },
  })

  const outcome = await runAiPipeline({
    text: question,
    identifier,
    role,
    feature: 'research-qa',
    router,
    config,
    retrievalAdapters: [new Tier1CatalogRetrieval(products)],
    maxTokens: RESEARCH_QA_MAX_TOKENS,
  })

  switch (outcome.status) {
    case 'COMPLETED':
      return { status: 'ALLOWED', answer: outcome.text, citations: outcome.citations }
    case 'REFUSED':
      return { status: 'REFUSED', reason: outcome.reason }
    case 'ESCALATED':
      return { status: 'ESCALATED', reason: outcome.reason }
    case 'RATE_LIMITED':
      return { status: 'RATE_LIMITED', reason: 'Too many requests. Please try again shortly.' }
    case 'BUDGET_EXCEEDED':
      return { status: 'BUDGET_EXCEEDED', reason: 'Daily usage limit reached. Please try again tomorrow.' }
    case 'PROVIDER_FAILURE':
      return { status: 'PROVIDER_FAILURE', reason: 'Unable to complete this request right now.' }
  }
}
