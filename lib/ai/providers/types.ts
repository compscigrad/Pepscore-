// AI-0B.1 -- the internal provider interface every AI-0B module depends on.
// Application/business logic must only ever import this shape, never a
// Gateway-specific type or call -- lib/ai/providers/gateway.ts is the one
// file allowed to know what "Vercel AI Gateway" even is.
export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
}

export interface CompletionResult {
  text: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  usedFallback: boolean
}

export interface EmbeddingRequest {
  input: string[]
}

export interface EmbeddingResult {
  vectors: number[][]
  provider: string
  model: string
}

export interface ModerationRequest {
  input: string
}

export interface ModerationResult {
  flagged: boolean
  categories: string[]
}

export interface AiProvider {
  readonly name: string
  complete(req: CompletionRequest): Promise<CompletionResult>
  embed(req: EmbeddingRequest): Promise<EmbeddingResult>
  moderate(req: ModerationRequest): Promise<ModerationResult>
  healthCheck(): Promise<boolean>
}

// Thrown by any provider adapter on a request that can't be safely
// completed (missing config, unapproved model route, transport failure,
// non-2xx response). Callers (the router, the policy engine) treat this as
// a signal to fail closed, never to silently continue -- see
// lib/ai/policy/engine.ts's SAFETY FAILURE handling.
export class AiProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AiProviderError'
  }
}
