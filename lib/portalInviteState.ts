// Pure portal-invite state logic — dependency-free (a type-only Prisma
// import, erased at compile time) so it's safe to import from a client
// component as well as server code. Mirrors lib/intakeLinkState.ts exactly:
// lib/portalInvites.ts imports and re-exports this for its own server-side
// use; that file pulls in crypto/prisma and must never be imported directly
// from client code.
import type { CustomerPortalInvite } from '@prisma/client'

export type PortalInviteState = 'ACTIVE' | 'CLAIMED' | 'EXPIRED' | 'REVOKED'

// A portal invite is single-purpose (unlike IntakeLink, which is deliberately
// multi-use) — once claimed, it stays CLAIMED forever, never reverting to
// ACTIVE even if somehow revisited. Priority: revoked/expired first (can't
// be claimed regardless of history), then claimed, then active.
export function getPortalInviteState(
  invite: Pick<CustomerPortalInvite, 'expiresAt' | 'claimedAt' | 'revokedAt'>
): PortalInviteState {
  if (invite.revokedAt) return 'REVOKED'
  if (invite.claimedAt) return 'CLAIMED'
  if (invite.expiresAt < new Date()) return 'EXPIRED'
  return 'ACTIVE'
}

export function isPortalInviteUsable(
  invite: Pick<CustomerPortalInvite, 'expiresAt' | 'claimedAt' | 'revokedAt'>
): boolean {
  return getPortalInviteState(invite) === 'ACTIVE'
}
