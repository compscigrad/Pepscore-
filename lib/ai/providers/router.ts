// AI-0B.1 -- primary/fallback routing (owner-approved design, 2026-08-18
// item 12: PRIMARY -> FALLBACK -> SAFE FAILURE). A fallback provider must
// go through the exact same completion path as primary -- callers never
// see a difference except CompletionResult.usedFallback -- so the policy
// engine, permission checks, and output validation apply identically
// regardless of which provider actually answered (enforced by the caller,
// not this router; this router only decides which provider runs).
import type { AiProvider, CompletionRequest, CompletionResult } from './types'
import { AiProviderError } from './types'

export class ProviderRouter {
  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider | null = null
  ) {}

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    try {
      return await this.primary.complete(req)
    } catch (primaryError) {
      if (!this.fallback) {
        throw new AiProviderError('Primary provider failed and no fallback is configured', primaryError)
      }
      try {
        const result = await this.fallback.complete(req)
        return { ...result, usedFallback: true }
      } catch (fallbackError) {
        throw new AiProviderError('Both primary and fallback providers failed', { primaryError, fallbackError })
      }
    }
  }
}
