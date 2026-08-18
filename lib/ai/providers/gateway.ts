// AI-0B.1 -- Vercel AI Gateway adapter (owner-approved provider, 2026-08-18
// AI-0B architecture approval item 1). This is the ONLY file in the repo
// allowed to know Gateway's request/response shape; everything else depends
// on lib/ai/providers/types.ts's AiProvider interface instead.
//
// Thin fetch() wrapper against Gateway's OpenAI-compatible REST endpoint,
// not the `ai` SDK package -- no new runtime dependency for the foundation
// phase, and it keeps every call trivially mockable at the fetch boundary
// (same pattern this repo's own tests already use elsewhere). The `ai`
// package or a direct provider SDK can be added later if a real,
// integration-verified call is ever needed -- per the owner's explicit
// instruction, that requires stopping and asking first (provider, model,
// expected cost, data transmitted), not a decision this file makes alone.
//
// No live calls happen anywhere in AI-0B: nothing in the app currently
// constructs an AiGatewayProvider with a real fetch, and AI_FEATURE_ENABLED
// defaults off regardless.
//
// AI-1.12 -- every request additionally sets providerOptions.gateway.
// zeroDataRetention=true (verified against vercel.com/docs/ai-gateway/
// security-and-compliance/zdr, accessed 2026-08-18). Per that doc, AI
// Gateway does NOT route based on provider data-retention policy by
// default -- the flag must be requested. With it set, Gateway restricts
// routing to confirmed-ZDR providers for the requested model and fails
// the request closed (400 no_providers_available) if none exist, rather
// than silently sending data through an unverified provider. This is a
// second, Vercel-enforced layer on top of modelRoutes.ts's own static
// approval gate below -- either one failing means the call never happens.
import type { AiProvider, CompletionRequest, CompletionResult, EmbeddingRequest, EmbeddingResult, ModerationRequest, ModerationResult } from './types'
import { AiProviderError } from './types'
import { isRouteApproved } from './modelRoutes'
import type { AiConfig } from './config'

const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

export class AiGatewayProvider implements AiProvider {
  readonly name = 'vercel-ai-gateway'

  constructor(
    private readonly config: AiConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    // Optional -- without it, complete() always targets config.primaryModel.
    // Needed so a genuine fallback provider (a second AiGatewayProvider
    // instance targeting config.fallbackModel) can exist at all -- see
    // factory.ts, AI-1.11. Embedding/moderation are unaffected; each already
    // has its own dedicated config field.
    private readonly completionModelOverride?: string
  ) {}

  private assertConfigured() {
    if (!this.config.gatewayApiKey) {
      throw new AiProviderError('AI_GATEWAY_API_KEY is not configured')
    }
  }

  // Every call site (complete/embed/moderate) must pass its model through
  // this before the request is sent -- an unapproved route throws rather
  // than silently transmitting Pepscore data through it. See
  // modelRoutes.ts's own header for what "approved" requires.
  private assertRouteApproved(model: string) {
    if (!isRouteApproved(model)) {
      throw new AiProviderError(
        `Model route "${model}" is not an approved ZDR/data-policy-verified route -- see lib/ai/providers/modelRoutes.ts`
      )
    }
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.assertConfigured()
    const model = this.completionModelOverride ?? this.config.primaryModel
    if (!model) throw new AiProviderError('AI_PRIMARY_MODEL is not configured')
    this.assertRouteApproved(model)

    const start = Date.now()
    let res: Response
    try {
      res = await this.fetchImpl(`${GATEWAY_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.gatewayApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          providerOptions: { gateway: { zeroDataRetention: true } },
        }),
      })
    } catch (err) {
      throw new AiProviderError('Gateway completion request failed to send', err)
    }

    if (!res.ok) {
      throw new AiProviderError(`Gateway completion failed: ${res.status}`)
    }

    const data = await res.json()
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      provider: this.name,
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
      usedFallback: false,
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
    this.assertConfigured()
    const model = this.config.embeddingModel
    if (!model) throw new AiProviderError('AI_EMBEDDING_MODEL is not configured')
    this.assertRouteApproved(model)

    let res: Response
    try {
      res = await this.fetchImpl(`${GATEWAY_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.gatewayApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, input: req.input, providerOptions: { gateway: { zeroDataRetention: true } } }),
      })
    } catch (err) {
      throw new AiProviderError('Gateway embedding request failed to send', err)
    }

    if (!res.ok) {
      throw new AiProviderError(`Gateway embedding failed: ${res.status}`)
    }

    const data = await res.json()
    return {
      vectors: (data.data ?? []).map((d: { embedding: number[] }) => d.embedding),
      provider: this.name,
      model,
    }
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    this.assertConfigured()
    const model = this.config.moderationModel
    if (!model) throw new AiProviderError('AI_MODERATION_MODEL is not configured')
    this.assertRouteApproved(model)

    let res: Response
    try {
      res = await this.fetchImpl(`${GATEWAY_BASE_URL}/moderations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.gatewayApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, input: req.input, providerOptions: { gateway: { zeroDataRetention: true } } }),
      })
    } catch (err) {
      throw new AiProviderError('Gateway moderation request failed to send', err)
    }

    if (!res.ok) {
      throw new AiProviderError(`Gateway moderation failed: ${res.status}`)
    }

    const data = await res.json()
    const result = data.results?.[0]
    return {
      flagged: result?.flagged ?? false,
      categories: result ? Object.keys(result.categories ?? {}).filter((k) => result.categories[k]) : [],
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.gatewayApiKey) return false
    try {
      const res = await this.fetchImpl(`${GATEWAY_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.config.gatewayApiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
