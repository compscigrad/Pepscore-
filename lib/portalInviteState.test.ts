import { describe, it, expect } from 'vitest'
import { getPortalInviteState, isPortalInviteUsable } from './portalInviteState'

function invite(overrides: Partial<{ expiresAt: Date; claimedAt: Date | null; revokedAt: Date | null }> = {}) {
  return {
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    claimedAt: null,
    revokedAt: null,
    ...overrides,
  }
}

describe('getPortalInviteState', () => {
  it('is ACTIVE for a fresh, unclaimed, unrevoked invite', () => {
    expect(getPortalInviteState(invite())).toBe('ACTIVE')
  })

  it('is EXPIRED once past expiresAt, even if never claimed or revoked', () => {
    expect(getPortalInviteState(invite({ expiresAt: new Date(Date.now() - 1000) }))).toBe('EXPIRED')
  })

  it('is CLAIMED once claimedAt is set, and stays CLAIMED even past its original expiry', () => {
    expect(getPortalInviteState(invite({ claimedAt: new Date(), expiresAt: new Date(Date.now() - 1000) }))).toBe('CLAIMED')
  })

  it('is REVOKED whenever revokedAt is set, taking priority over every other state', () => {
    expect(getPortalInviteState(invite({ revokedAt: new Date() }))).toBe('REVOKED')
    expect(getPortalInviteState(invite({ revokedAt: new Date(), claimedAt: new Date() }))).toBe('REVOKED')
    expect(getPortalInviteState(invite({ revokedAt: new Date(), expiresAt: new Date(Date.now() - 1000) }))).toBe('REVOKED')
  })
})

describe('isPortalInviteUsable', () => {
  it('is true only for ACTIVE', () => {
    expect(isPortalInviteUsable(invite())).toBe(true)
    expect(isPortalInviteUsable(invite({ claimedAt: new Date() }))).toBe(false)
    expect(isPortalInviteUsable(invite({ revokedAt: new Date() }))).toBe(false)
    expect(isPortalInviteUsable(invite({ expiresAt: new Date(Date.now() - 1000) }))).toBe(false)
  })
})
