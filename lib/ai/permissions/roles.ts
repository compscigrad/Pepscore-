// AI-0B.2 -- minimal role model the policy engine needs to make role-aware
// ALLOW decisions (e.g. an ADMIN-category request). Full per-tool/per-data
// permission grants (owner-approved design, prior scope review section 6)
// land in AI-0B.4 once retrieval tools actually exist to gate -- this file
// only covers what evaluateInput() needs today.
//
// AI role CLIENT maps conceptually to the database Role.CUSTOMER enum
// (lib/auth/rbac.ts) -- kept as a distinct AI-layer type rather than
// reusing the Prisma enum directly, since ANONYMOUS has no DB counterpart
// at all (an unauthenticated visitor has no User row). No Prisma enum
// rename is justified for AI-layer naming alone (owner decision, 2026-08-18
// item 16).
export type AiRole = 'ANONYMOUS' | 'CLIENT' | 'ADMIN'

export function resolveAiRole(isAdmin: boolean, isAuthenticated: boolean): AiRole {
  if (isAdmin) return 'ADMIN'
  if (isAuthenticated) return 'CLIENT'
  return 'ANONYMOUS'
}

const ROLE_RANK: Record<AiRole, number> = { ANONYMOUS: 0, CLIENT: 1, ADMIN: 2 }

export function roleMeetsMinimum(role: AiRole, minRole: AiRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

// Categories that require at least the given role. Anything not listed
// here has no role floor at the policy-engine layer (CATALOG/RESEARCH/
// LITERATURE are open to every role; ACCOUNT's own-data scoping happens at
// the retrieval layer in AI-0B.4, not here).
const CATEGORY_MIN_ROLE: Partial<Record<string, AiRole>> = {
  ADMIN: 'ADMIN',
}

export function categoryRequiresRole(category: string): AiRole | null {
  return CATEGORY_MIN_ROLE[category] ?? null
}
