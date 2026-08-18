// POST /api/ai/intelligence -- the Pepscore Intelligence customer-facing
// entry point (AI-1.3). Structured requests only (compare | discover),
// never free-text natural-language input -- see lib/ai/intelligence/
// compoundComparison.ts's header for why free-text Q&A stays BLOCKED
// (needs a real LLM to parse intent; no model route is approved yet).
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

const requestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('compare'),
    productNames: z.array(z.string().trim().min(1)).min(2).max(5),
  }),
  z.object({
    type: z.literal('discover'),
    categorySlug: z.string().trim().min(1),
  }),
])

export async function POST(req: NextRequest) {
  const config = loadAiConfig()
  if (!config.featureEnabled) {
    return NextResponse.json({ error: 'Pepscore Intelligence is not currently enabled.' }, { status: 503 })
  }

  const { userId: clerkUserId } = await auth()
  const isAdmin = clerkUserId ? await isCurrentUserAdmin() : false
  const role = resolveAiRole(isAdmin, !!clerkUserId)
  const identifier = clerkUserId ?? `ip:${getClientIp(req)}`

  const rateLimit = checkAiRateLimit(identifier, role, {
    perMinute: config.rateLimitPerMinute,
    perDay: config.rateLimitPerDay,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (parsed.data.type === 'compare') {
    const result = await compareCompounds(parsed.data.productNames, role)
    return NextResponse.json(result)
  }

  const result = await discoverByCategory(parsed.data.categorySlug, role)
  return NextResponse.json(result)
}
