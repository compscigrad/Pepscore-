import { describe, it, expect } from 'vitest'
import { computeFirstOrderOfferLive } from './firstOrderOffer'

const activeCampaign = { status: 'ACTIVE' as const, expiresAt: null }

describe('computeFirstOrderOfferLive', () => {
  it('is false when the master switch is off, even with an active campaign', () => {
    expect(computeFirstOrderOfferLive({ enabled: false }, activeCampaign)).toBe(false)
  })

  it('is false when the master switch is on but no campaign is the active default', () => {
    expect(computeFirstOrderOfferLive({ enabled: true }, null)).toBe(false)
  })

  it('is false when the campaign exists but is not ACTIVE (e.g. still DRAFT or already RETIRED)', () => {
    expect(computeFirstOrderOfferLive({ enabled: true }, { status: 'DRAFT', expiresAt: null })).toBe(false)
    expect(computeFirstOrderOfferLive({ enabled: true }, { status: 'RETIRED', expiresAt: null })).toBe(false)
  })

  it('is false when the campaign has expired', () => {
    const expired = { status: 'ACTIVE' as const, expiresAt: new Date(Date.now() - 1000) }
    expect(computeFirstOrderOfferLive({ enabled: true }, expired)).toBe(false)
  })

  it('is true when the switch is on, the campaign is ACTIVE, and not expired', () => {
    expect(computeFirstOrderOfferLive({ enabled: true }, activeCampaign)).toBe(true)
    const notYetExpired = { status: 'ACTIVE' as const, expiresAt: new Date(Date.now() + 1000 * 60 * 60) }
    expect(computeFirstOrderOfferLive({ enabled: true }, notYetExpired)).toBe(true)
  })
})
