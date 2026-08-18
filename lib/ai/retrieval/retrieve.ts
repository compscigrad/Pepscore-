// AI-0B.4 -- composes retrieval adapters, scoped by the caller's AiRole.
import type { AiRole } from '../permissions/roles'
import type { RetrievalAdapter, RetrievalQuery, RetrievedSource, SourceTier } from './types'

// Which tiers a role may draw from. ANONYMOUS/CLIENT are scoped to Tier 1
// (and Tier 2 for CLIENT) today; ADMIN gets everything defined. Tier 2 has
// zero real content yet (see tier23Fixtures.ts), so this is establishing
// the permission boundary ahead of content existing, matching the
// owner-approved permission model (prior scope review section 6).
const ROLE_ALLOWED_TIERS: Record<AiRole, SourceTier[]> = {
  ANONYMOUS: [1],
  CLIENT: [1, 2],
  ADMIN: [1, 2, 3],
}

export async function retrieveForRole(
  adapters: RetrievalAdapter[],
  query: RetrievalQuery,
  role: AiRole
): Promise<RetrievedSource[]> {
  const allowedTiers = ROLE_ALLOWED_TIERS[role]
  const requestedTiers = query.allowedTiers ? query.allowedTiers.filter((t) => allowedTiers.includes(t)) : allowedTiers
  const scopedQuery: RetrievalQuery = { ...query, allowedTiers: requestedTiers }

  const results = await Promise.all(
    adapters.filter((a) => allowedTiers.includes(a.tier)).map((a) => a.retrieve(scopedQuery))
  )
  return results.flat()
}
