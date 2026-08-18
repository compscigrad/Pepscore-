// POST /api/admin/ai/live-test -- AI-1.12 admin-only internal verification
// endpoint for the live-model-integration phase. NOT a chat interface and
// NOT reachable by customers: admin-gated via requireAdmin(), and only
// accepts a fixed key selecting one of lib/ai/testing/syntheticPrompts.ts's
// non-PII prompts -- never arbitrary free text -- so this can never become
// an uncontrolled internal playground against a real, paid provider.
//
// Runs the exact same runAiPipeline() every future generation-based
// capability would use: rate limit -> budget -> input policy -> retrieval
// (Tier 1 catalog, sanitized, cited) -> provider call (primary -> fallback)
// -> output policy. If no live provider can actually be built
// (AI_LIVE_MODEL_ENABLED off, no gateway credential, or no approved model
// route), returns NOT_CONFIGURED and never attempts a network call -- this
// route is safe to deploy and hit before a real credential exists, and
// this specific check (independent of AI_FEATURE_ENABLED, the separate
// public-customer flag) is the actual owner kill switch for this route.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/rbac'
import { prisma } from '@/lib/prisma'
import { loadAiConfig } from '@/lib/ai/providers/config'
import { buildProviderRouterFromConfig } from '@/lib/ai/providers/factory'
import { runAiPipeline } from '@/lib/ai/gate/pipeline'
import { Tier1CatalogRetrieval } from '@/lib/ai/retrieval/tier1Catalog'
import { findSyntheticPrompt } from '@/lib/ai/testing/syntheticPrompts'

// Small, deliberate cap -- cost safety for internal verification calls
// (owner instruction: "use intentionally small development limits").
const LIVE_TEST_MAX_TOKENS = 200

const requestSchema = z.object({ promptKey: z.string().trim().min(1) })

export async function POST(req: Request) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const config = loadAiConfig()
  const router = buildProviderRouterFromConfig(config)
  if (!router) {
    return NextResponse.json({
      status: 'NOT_CONFIGURED',
      reason:
        'No live provider router could be built. Check: AI_LIVE_MODEL_ENABLED, AI_GATEWAY_API_KEY, and whether ' +
        'the configured primary model has an approved entry in lib/ai/providers/modelRoutes.ts.',
    })
  }

  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const prompt = findSyntheticPrompt(parsed.data.promptKey)
  if (!prompt) return NextResponse.json({ error: 'Unknown promptKey.' }, { status: 400 })

  const products = await prisma.product.findMany({
    where: { pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, size: true, category: true, searchSynonyms: true },
  })

  const outcome = await runAiPipeline({
    text: prompt.text,
    identifier: `admin-live-test:${userId}`,
    role: 'ADMIN',
    feature: 'admin-live-test',
    userId,
    router,
    config,
    retrievalAdapters: [new Tier1CatalogRetrieval(products)],
    maxTokens: LIVE_TEST_MAX_TOKENS,
  })

  return NextResponse.json({ promptKey: prompt.key, promptCategory: prompt.category, outcome })
}
