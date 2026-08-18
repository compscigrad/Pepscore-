// AI-0B.1 -- a deterministic, no-network AiProvider implementation. Used by
// tests throughout lib/ai/ so policy/classification/retrieval logic can be
// verified without ever making a real model call (owner instruction,
// 2026-08-18 item 22: prefer mocked provider tests during foundation work).
import type { AiProvider, CompletionRequest, CompletionResult, EmbeddingRequest, EmbeddingResult, ModerationRequest, ModerationResult } from './types'

export interface MockProviderOptions {
  name?: string
  completionText?: string
  shouldFailCompletion?: boolean
  shouldFailHealthCheck?: boolean
  moderationFlagged?: boolean
}

export class MockAiProvider implements AiProvider {
  readonly name: string
  private opts: MockProviderOptions

  constructor(opts: MockProviderOptions = {}) {
    this.name = opts.name ?? 'mock-provider'
    this.opts = opts
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (this.opts.shouldFailCompletion) {
      throw new Error('mock provider: simulated completion failure')
    }
    return {
      text: this.opts.completionText ?? 'mock completion',
      provider: this.name,
      model: 'mock-model',
      inputTokens: req.messages.reduce((n, m) => n + m.content.length, 0),
      outputTokens: (this.opts.completionText ?? 'mock completion').length,
      latencyMs: 1,
      usedFallback: false,
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      vectors: req.input.map(() => [0, 0, 0]),
      provider: this.name,
      model: 'mock-embedding-model',
    }
  }

  async moderate(_req: ModerationRequest): Promise<ModerationResult> {
    return {
      flagged: this.opts.moderationFlagged ?? false,
      categories: this.opts.moderationFlagged ? ['mock-category'] : [],
    }
  }

  async healthCheck(): Promise<boolean> {
    return !this.opts.shouldFailHealthCheck
  }
}
