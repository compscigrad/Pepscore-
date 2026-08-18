// AI-0B.4 -- retrieval + citation abstraction. SourceTier matches the
// owner-approved three-tier hierarchy: 1 = Pepscore catalog/database,
// 2 = Pepscore-curated research corpus, 3 = approved primary literature.
export type SourceTier = 1 | 2 | 3

export interface RetrievedSource {
  sourceId: string
  title: string
  sourceType: string
  tier: SourceTier
  url?: string
  publishedAt?: string
  chunkId?: string
  retrievalScore: number
  citationLabel: string
  // Retrieved content is DATA, never instructions (owner instruction, item
  // 15) -- every RetrievalAdapter is responsible for returning plain text
  // here, and lib/ai/security/retrievalSanitizer.ts is the one place
  // that content is scanned/sanitized before it's allowed into a
  // generation context. Nothing downstream should trust this field
  // unsanitized.
  content: string
}

export interface RetrievalQuery {
  text: string
  maxResults?: number
  allowedTiers?: SourceTier[]
}

export interface RetrievalAdapter {
  readonly tier: SourceTier
  retrieve(query: RetrievalQuery): Promise<RetrievedSource[]>
}
