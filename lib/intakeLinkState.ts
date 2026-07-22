// Pure intake-link state logic — deliberately dependency-free (a type-only
// Prisma import is erased at compile time, nothing else) so it's safe to
// import from a client component (e.g. IntakeLinkSection.tsx) as well as
// server code. lib/intakeLinks.ts imports and re-exports these for its own
// server-side use — that file pulls in `crypto`/prisma and must never be
// imported directly from client code.
import type { IntakeLink } from '@prisma/client'

// Caps brute-force submission attempts against a single link — the
// unguessable token itself is the primary spam defense (see lib/intakeLinks.ts).
export const MAX_SUBMISSION_ATTEMPTS = 20

export type IntakeLinkState = 'ACTIVE' | 'VIEWED' | 'SUBMITTED' | 'EXPIRED' | 'INVALIDATED' | 'ATTEMPT_LIMIT_REACHED'

// Priority answers "can this link still be used, and if not why" first, then
// whether it's already been submitted — a link is multi-use, not single-use
// (see lib/intakeLinks.ts's own top comment), so a SUBMITTED link still
// accepts further submissions unless it's also expired/invalidated/attempt-limited.
export function getIntakeLinkState(
  link: Pick<IntakeLink, 'expiresAt' | 'viewedAt' | 'invalidatedAt' | 'submittedAt' | 'submissionAttempts'>
): IntakeLinkState {
  if (link.invalidatedAt) return 'INVALIDATED'
  if (link.expiresAt < new Date()) return 'EXPIRED'
  if (link.submissionAttempts >= MAX_SUBMISSION_ATTEMPTS) return 'ATTEMPT_LIMIT_REACHED'
  if (link.submittedAt) return 'SUBMITTED'
  if (link.viewedAt) return 'VIEWED'
  return 'ACTIVE'
}
