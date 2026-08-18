// AI-1.10 -- closes a real gap found in this session's roadmap
// reconciliation: retrieveForRole() (AI-0B.4) and sanitizeRetrievedContent()
// (AI-0B.4/9) were both built and independently tested, but nothing
// anywhere ever called them together, and lib/ai/gate/pipeline.ts's
// runAiPipeline() had no integration point for retrieved content at all --
// generation would have used zero retrieved context and produced zero
// citations, despite the citation schema existing since AI-0B.4. This is
// that missing wiring: every retrieved source is sanitized before it can
// enter a generation context, and a flagged source is dropped entirely,
// never partially included (owner instruction, item 15).
import { sanitizeRetrievedContent } from '../security/retrievalSanitizer'
import { toCitation, deduplicateCitations, type Citation } from '../citations/citation'
import type { RetrievedSource } from './types'

export interface RetrievalContext {
  contextBlocks: string[]
  citations: Citation[]
  excludedSourceIds: string[]
}

// Pure -- takes already-retrieved sources, returns what's safe to inject
// into a prompt plus the citations for what was actually used. A source
// flagged by sanitizeRetrievedContent contributes neither content nor a
// citation -- it's as if it was never retrieved, not shown with a warning.
export function buildRetrievalContext(sources: RetrievedSource[]): RetrievalContext {
  const contextBlocks: string[] = []
  const citations: Citation[] = []
  const excludedSourceIds: string[] = []

  for (const source of sources) {
    const sanitized = sanitizeRetrievedContent(source.content)
    if (!sanitized.safe) {
      excludedSourceIds.push(source.sourceId)
      continue
    }
    contextBlocks.push(sanitized.sanitizedContent)
    citations.push(toCitation(source))
  }

  return { contextBlocks, citations: deduplicateCitations(citations), excludedSourceIds }
}
