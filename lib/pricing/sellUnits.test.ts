import { describe, it, expect } from 'vitest'
import { getAvailableSellUnits } from './sellUnits'

describe('getAvailableSellUnits', () => {
  it('Tesamorelin 10mg: offers Standard and SPA case only, never Individual Vial, even though a hidden active individual price exists', () => {
    const tesamorelin = {
      activeStandardCasePrice: 775,
      activeSpaCasePrice: 700,
      activeBulkPrice: null,
      activeIndividualVialPrice: 80,
      individualSalesEnabled: false,
      unitsPerCase: 10,
    }
    const options = getAvailableSellUnits(tesamorelin)
    const units = options.map((o) => o.sellUnit)
    expect(units).toEqual(['CASE_STANDARD', 'CASE_SPA'])
    expect(units).not.toContain('INDIVIDUAL_VIAL')
  })

  it('GLOW70: offers Standard, SPA, and Individual Vial (individual sales explicitly enabled)', () => {
    const glow70 = {
      activeStandardCasePrice: 725,
      activeSpaCasePrice: 565,
      activeBulkPrice: null,
      activeIndividualVialPrice: 89,
      individualSalesEnabled: true,
      unitsPerCase: 10,
    }
    const options = getAvailableSellUnits(glow70)
    expect(options.map((o) => o.sellUnit)).toEqual(['CASE_STANDARD', 'CASE_SPA', 'INDIVIDUAL_VIAL'])
    expect(options.find((o) => o.sellUnit === 'INDIVIDUAL_VIAL')?.price).toBe(89)
  })

  it('never offers Individual Vial when individualSalesEnabled is true but no active individual price is set yet', () => {
    const options = getAvailableSellUnits({
      activeStandardCasePrice: 500,
      activeSpaCasePrice: null,
      activeBulkPrice: null,
      activeIndividualVialPrice: null,
      individualSalesEnabled: true,
      unitsPerCase: 10,
    })
    expect(options.map((o) => o.sellUnit)).not.toContain('INDIVIDUAL_VIAL')
  })

  it('a product with no active pricing at all offers zero sell units', () => {
    const options = getAvailableSellUnits({
      activeStandardCasePrice: null,
      activeSpaCasePrice: null,
      activeBulkPrice: null,
      activeIndividualVialPrice: null,
      individualSalesEnabled: false,
      unitsPerCase: null,
    })
    expect(options).toHaveLength(0)
  })

  it('defaults unitsPerSellUnit to 10 for a case when unitsPerCase is not yet set', () => {
    const options = getAvailableSellUnits({
      activeStandardCasePrice: 500,
      activeSpaCasePrice: null,
      activeBulkPrice: null,
      activeIndividualVialPrice: null,
      individualSalesEnabled: false,
      unitsPerCase: null,
    })
    expect(options[0].unitsPerSellUnit).toBe(10)
  })

  it('individual vial sell unit always consumes exactly 1 vial regardless of case size', () => {
    const options = getAvailableSellUnits({
      activeStandardCasePrice: null,
      activeSpaCasePrice: null,
      activeBulkPrice: null,
      activeIndividualVialPrice: 89,
      individualSalesEnabled: true,
      unitsPerCase: 10,
    })
    expect(options[0].unitsPerSellUnit).toBe(1)
  })
})
