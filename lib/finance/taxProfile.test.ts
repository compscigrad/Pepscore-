import { describe, it, expect } from 'vitest'
import { getMissingProfileFields } from './taxProfile'
import type { BusinessTaxProfile } from '@prisma/client'

function fakeProfile(overrides: Partial<BusinessTaxProfile> = {}): BusinessTaxProfile {
  return {
    id: 'singleton',
    legalBusinessName: 'Pepscore Lab LLC',
    dba: null,
    ein: '00-0000000',
    stateOfFormation: 'DC',
    businessAddress: null,
    taxYearType: 'CALENDAR_YEAR',
    entityType: 'SINGLE_MEMBER_LLC',
    federalTaxClassification: null,
    accountingMethod: 'CASH',
    stateLocalTaxRegistrations: null,
    salesTaxRegistrations: null,
    estimatedTaxRatePercent: null,
    updatedBy: 'test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('getMissingProfileFields', () => {
  it('returns every core field when no profile exists yet', () => {
    const missing = getMissingProfileFields(null)
    expect(missing).toContain('Legal Business Name')
    expect(missing).toContain('EIN')
    expect(missing).toContain('State of Formation')
    expect(missing).toContain('Entity Type')
    expect(missing).toContain('Accounting Method')
  })

  it('returns nothing when every field is set', () => {
    expect(getMissingProfileFields(fakeProfile())).toEqual([])
  })

  it('flags only entity type when everything else is set but entity type is still UNKNOWN', () => {
    expect(getMissingProfileFields(fakeProfile({ entityType: 'UNKNOWN' }))).toEqual(['Entity Type'])
  })

  it('flags only accounting method when everything else is set but it is still UNKNOWN', () => {
    expect(getMissingProfileFields(fakeProfile({ accountingMethod: 'UNKNOWN' }))).toEqual(['Accounting Method'])
  })

  it('flags a missing EIN independently of other fields', () => {
    expect(getMissingProfileFields(fakeProfile({ ein: null }))).toEqual(['EIN'])
  })
})
