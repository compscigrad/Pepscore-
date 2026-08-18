// POST /api/ai/intelligence -- the Pepscore Intelligence customer-facing
// entry point. compare | discover | explain (AI-1.3/1.6) are structured,
// retrieval-only, deterministic requests. ask (AI-1.13) is free-text
// research Q&A -- the one capability that genuinely needs a live model to
// parse arbitrary intent, wired through the same policy/retrieval/
// citation/failover pipeline as everything else.
//
// Dark by default: AI_FEATURE_ENABLED defaults off (unset), so this
// route returns 503 for everyone until an owner explicitly turns it on.
// This is the ONLY externally-reachable route anywhere under lib/ai/ --
// every other AI-0B/AI-1 module remains server-only, matching the
// AI-0B instruction that no public AI endpoint should exist without an
// actual authorized use case (this one now has one: the owner-approved,
// structured, retrieval-only intelligence experience).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { loadAiConfig } from '@/lib/ai/providers/config'
import { resolveAiRole } from '@/lib/ai/permissions/roles'
import { checkAiRateLimit } from '@/lib/ai/gate/rateLimiter'
import { getClientIp } from '@/lib/rateLimit'
import { compareCompounds } from '@/lib/ai/intelligence/compoundComparison'
import { discoverByCategory } from '@/lib/ai/intelligence/categoryDiscovery'
import { explainCompound } from '@/lib/ai/intelligence/compoundExplainer'
import { askResearchQuestion } from '@/lib/ai/intelligence/researchQa'

const requestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('compare'),
    productNames: z.array(z.string().trim().min(1)).min(2).max(5),
  }),
  z.object({
    type: z.literal('discover'),
    categorySlug: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('explain'),
    productName: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('ask'),
    question: z.string().trim().min(1).max(500),
  }),
])

export async function POST(req: NextRequest) {
  const config = loadAiConfig()
  // TEMPORARY (AI-1.17 post-transfer credential-presence check) --
  // boolean only, never the value itself. Removed once read from Vercel
  // runtime logs.
  console.log('[ai-config-check] AI_GATEWAY_API_KEY present server-side:', !!config.gatewayApiKey)
  if (!config.featureEnabled) {
    return NextResponse.json({ error: 'Pepscore Intelligence is not currently enabled.' }, { status: 503 })
  }

  const { userId: clerkUserId } = await auth()
  const isAdmin = clerkUserId ? await isCurrentUserAdmin() : false
  const role = resolveAiRole(isAdmin, !!clerkUserId)
  const identifier = clerkUserId ?? `ip:${getClientIp(req)}`

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // 'ask' runs through runAiPipeline, which performs its own complete
  // rate-limit/budget check internally (its step 1, using the identical
  // checkAiRateLimit against the identical identifier) -- checking again
  // here would consume two rate-limit tokens for one logical request.
  if (parsed.data.type === 'ask') {
    const result = await askResearchQuestion(parsed.data.question, role, identifier)
    return NextResponse.json(result)
  }

  const rateLimit = checkAiRateLimit(identifier, role, {
    perMinute: config.rateLimitPerMinute,
    perDay: config.rateLimitPerDay,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  if (parsed.data.type === 'compare') {
    const result = await compareCompounds(parsed.data.productNames, role)
    return NextResponse.json(result)
  }

  if (parsed.data.type === 'discover') {
    const result = await discoverByCategory(parsed.data.categorySlug, role)
    return NextResponse.json(result)
  }

  const result = await explainCompound(parsed.data.productName, role)
  return NextResponse.json(result)
}
