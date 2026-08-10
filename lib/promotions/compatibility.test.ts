import { describe, it, expect } from 'vitest'
import { canCampaignsCombine, canApplyCampaignSet, MAX_SIMULTANEOUS_PROMOTIONS, type StackableCampaign } from './compatibility'

function campaign(id: string, stackingPolicy: StackableCampaign['stackingPolicy']): StackableCampaign {
  return { id, stackingPolicy }
}

describe('canCampaignsCombine', () => {
  it('two NOT_STACKABLE campaigns cannot combine -- the default rule', () => {
    expect(canCampaignsCombine(campaign('a', 'NOT_STACKABLE'), campaign('b', 'NOT_STACKABLE'))).toBe(false)
  })

  it('NOT_STACKABLE cannot combine with anything, regardless of the other side', () => {
    expect(canCampaignsCombine(campaign('a', 'NOT_STACKABLE'), campaign('b', 'PRIVILEGED_STACKABLE'))).toBe(false)
    expect(canCampaignsCombine(campaign('a', 'STACKABLE_WITH_ONE'), campaign('b', 'NOT_STACKABLE'))).toBe(false)
  })

  it('PRIVILEGED_STACKABLE (Family & Friends) combines with an eligible STACKABLE_WITH_ONE promotion', () => {
    expect(canCampaignsCombine(campaign('ff', 'PRIVILEGED_STACKABLE'), campaign('promo', 'STACKABLE_WITH_ONE'))).toBe(true)
  })

  it('two PRIVILEGED_STACKABLE campaigns cannot combine with each other', () => {
    expect(canCampaignsCombine(campaign('ff1', 'PRIVILEGED_STACKABLE'), campaign('ff2', 'PRIVILEGED_STACKABLE'))).toBe(false)
  })

  it('two STACKABLE_WITH_ONE campaigns can combine', () => {
    expect(canCampaignsCombine(campaign('a', 'STACKABLE_WITH_ONE'), campaign('b', 'STACKABLE_WITH_ONE'))).toBe(true)
  })

  it('a campaign can never "combine" with itself', () => {
    expect(canCampaignsCombine(campaign('same', 'PRIVILEGED_STACKABLE'), campaign('same', 'PRIVILEGED_STACKABLE'))).toBe(false)
  })
})

describe('canApplyCampaignSet', () => {
  it('a single campaign is always a valid set', () => {
    expect(canApplyCampaignSet([campaign('a', 'NOT_STACKABLE')])).toBe(true)
  })

  it('an empty set is valid (no promotion applied)', () => {
    expect(canApplyCampaignSet([])).toBe(true)
  })

  it('rejects a set larger than MAX_SIMULTANEOUS_PROMOTIONS even if every pair is otherwise compatible', () => {
    const set = [campaign('a', 'STACKABLE_WITH_ONE'), campaign('b', 'STACKABLE_WITH_ONE'), campaign('c', 'STACKABLE_WITH_ONE')]
    expect(set.length).toBeGreaterThan(MAX_SIMULTANEOUS_PROMOTIONS)
    expect(canApplyCampaignSet(set)).toBe(false)
  })

  it('Family & Friends + one eligible promotion is a valid two-campaign set', () => {
    expect(canApplyCampaignSet([campaign('ff', 'PRIVILEGED_STACKABLE'), campaign('promo', 'STACKABLE_WITH_ONE')])).toBe(true)
  })

  it('a NOT_STACKABLE campaign paired with anything makes the whole set invalid', () => {
    expect(canApplyCampaignSet([campaign('a', 'NOT_STACKABLE'), campaign('b', 'PRIVILEGED_STACKABLE')])).toBe(false)
  })
})
