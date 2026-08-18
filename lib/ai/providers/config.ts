// AI-0B.1 -- env-var-driven config, matching how every other integration in
// this repo is configured (Stripe/Resend/Shippo/Twilio keys, PORTAL_ENABLED-
// style feature flags). No AIProviderConfig database table -- see the
// AI-0B scope review's rationale for keeping this env-only.
//
// AI_FEATURE_ENABLED defaults OFF (unset = off, same convention as every
// other rollout flag in .env.local.example). Nothing in lib/ai/ is called
// from existing storefront/admin code paths, so this flag is a second,
// belt-and-suspenders layer -- not the only thing standing between AI-0B
// and production traffic.
export interface AiConfig {
  featureEnabled: boolean
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

export function loadAiConfig(): AiConfig {
  return {
    featureEnabled: process.env.AI_FEATURE_ENABLED === 'true',
    gatewayApiKey: process.env.AI_GATEWAY_API_KEY,
    primaryModel: process.env.AI_PRIMARY_MODEL,
    fallbackModel: process.env.AI_FALLBACK_MODEL,
    embeddingModel: process.env.AI_EMBEDDING_MODEL,
    moderationModel: process.env.AI_MODERATION_MODEL,
    dailyCostLimitCents: Number(process.env.AI_DAILY_COST_LIMIT_CENTS ?? DEV_DEFAULT_DAILY_COST_LIMIT_CENTS),
    rateLimitPerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? DEV_DEFAULT_RATE_LIMIT_PER_MINUTE),
    rateLimitPerDay: Number(process.env.AI_RATE_LIMIT_PER_DAY ?? DEV_DEFAULT_RATE_LIMIT_PER_DAY),
  }
}
