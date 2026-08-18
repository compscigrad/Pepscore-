// AI-0B.1 -- env-var-driven config, matching how every other integration in
// this repo is configured (Stripe/Resend/Shippo/Twilio keys, PORTAL_ENABLED-
// style feature flags). No AIProviderConfig database table -- see the
// AI-0B scope review's rationale for keeping this env-only.
//
// AI-1.15 split what used to be one ambiguous flag into two independent
// kill switches, after live verification surfaced the real problem: with
// only AI_FEATURE_ENABLED, turning on admin/internal live-model testing
// required also opening the public customer route -- there was no way to
// verify a live model without exposing it. Now:
//
//   - featureEnabled  (AI_FEATURE_ENABLED)  = PUBLIC customer AI. Gates
//     app/api/ai/intelligence/route.ts's top-level 503 and
//     app/research/page.tsx's notFound(). Stays OFF -- public activation
//     remains owner-gated, unaffected by this split.
//   - liveModelEnabled (AI_LIVE_MODEL_ENABLED) = whether ANY real
//     provider router can be constructed at all (buildProviderRouterFromConfig,
//     factory.ts). Independent of featureEnabled -- an owner can turn
//     this on for admin/internal verification (the live-test route,
//     app/api/admin/ai/live-test) while the public route stays fully
//     dark. Turning it off is the actual kill switch: every live-model
//     consumer (askResearchQuestion, the admin live-test route) checks
//     this via buildProviderRouterFromConfig and fails closed to
//     UNAVAILABLE/NOT_CONFIGURED with zero network calls -- no paid
//     request, storefront and every non-AI feature stay fully healthy.
//
// Both default OFF (unset), same convention as every other rollout flag
// in .env.local.example.
export interface AiConfig {
  featureEnabled: boolean
  liveModelEnabled: boolean
  gatewayApiKey: string | undefined
  primaryModel: string | undefined
  fallbackModel: string | undefined
  embeddingModel: string | undefined
  moderationModel: string | undefined
  // Conservative development defaults (owner instruction, 2026-08-18 item
  // 6) -- low enough that a runaway loop during foundation testing can't
  // create meaningful spend. Real production budgets are a separate,
  // later cost-model proposal; never hard-coded as a business limit here.
  dailyCostLimitCents: number
  rateLimitPerMinute: number
  rateLimitPerDay: number
}

const DEV_DEFAULT_DAILY_COST_LIMIT_CENTS = 100
const DEV_DEFAULT_RATE_LIMIT_PER_MINUTE = 5
const DEV_DEFAULT_RATE_LIMIT_PER_DAY = 50

// AI-1.12 -- defaults matching the two entries registered in
// modelRoutes.ts's MODEL_ROUTES (see that file's own header for the
// ZDR/provider-diversity reasoning). Env var overrides still work for a
// future model swap without a code change; these just mean an owner
// doesn't have to separately set AI_PRIMARY_MODEL/AI_FALLBACK_MODEL just
// to match what's already approved in code.
const DEFAULT_PRIMARY_MODEL = 'anthropic/claude-haiku-4.5'
const DEFAULT_FALLBACK_MODEL = 'google/gemini-3.1-flash-lite'

export function loadAiConfig(): AiConfig {
  return {
    featureEnabled: process.env.AI_FEATURE_ENABLED === 'true',
    liveModelEnabled: process.env.AI_LIVE_MODEL_ENABLED === 'true',
    gatewayApiKey: process.env.AI_GATEWAY_API_KEY,
    primaryModel: process.env.AI_PRIMARY_MODEL ?? DEFAULT_PRIMARY_MODEL,
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
    embeddingModel: process.env.AI_EMBEDDING_MODEL,
    moderationModel: process.env.AI_MODERATION_MODEL,
    dailyCostLimitCents: Number(process.env.AI_DAILY_COST_LIMIT_CENTS ?? DEV_DEFAULT_DAILY_COST_LIMIT_CENTS),
    rateLimitPerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? DEV_DEFAULT_RATE_LIMIT_PER_MINUTE),
    rateLimitPerDay: Number(process.env.AI_RATE_LIMIT_PER_DAY ?? DEV_DEFAULT_RATE_LIMIT_PER_DAY),
  }
}
