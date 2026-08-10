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

  it('flags every case/SPA/bulk option as visible to customers regardless of admin context', () => {
    const options = getAvailableSellUnits({
      activeStandardCasePrice: 500,
      activeSpaCasePrice: 400,
      activeBulkPrice: 300,
      activeIndividualVialPrice: null,
      individualSalesEnabled: false,
      unitsPerCase: 10,
    })
    expect(options.every((o) => o.visibleToCustomers)).toBe(true)
  })

  describe('adminContext (Phase 3B item 2)', () => {
    it('Tesamorelin 10mg: without adminContext, Individual Vial stays hidden exactly as before (default behavior unchanged)', () => {
      const tesamorelin = {
        activeStandardCasePrice: 775,
        activeSpaCasePrice: 700,
        activeBulkPrice: null,
        activeIndividualVialPrice: 80,
        individualSalesEnabled: false,
        unitsPerCase: 10,
      }
      const options = getAvailableSellUnits(tesamorelin)
      expect(options.map((o) => o.sellUnit)).not.toContain('INDIVIDUAL_VIAL')
    })

    it('Tesamorelin 10mg: with adminContext, admin CAN select Individual Vial even though individualSalesEnabled is false', () => {
      const tesamorelin = {
        activeStandardCasePrice: 775,
        activeSpaCasePrice: 700,
        activeBulkPrice: null,
        activeIndividualVialPrice: 80,
        individualSalesEnabled: false,
        unitsPerCase: 10,
      }
      const options = getAvailableSellUnits(tesamorelin, { adminContext: true })
      const individual = options.find((o) => o.sellUnit === 'INDIVIDUAL_VIAL')
      expect(individual).toBeDefined()
      expect(individual?.price).toBe(80)
    })

    it('marks an adminContext-only Individual Vial option as NOT visible to customers, so the admin UI can flag it', () => {
      const options = getAvailableSellUnits(
        {
          activeStandardCasePrice: 775,
          activeSpaCasePrice: 700,
          activeBulkPrice: null,
          activeIndividualVialPrice: 80,
          individualSalesEnabled: false,
          unitsPerCase: 10,
        },
        { adminContext: true }
      )
      const individual = options.find((o) => o.sellUnit === 'INDIVIDUAL_VIAL')
      expect(individual?.visibleToCustomers).toBe(false)
    })

    it('when individualSalesEnabled is already true, an adminContext-visible Individual Vial option is still marked visible to customers (it genuinely is)', () => {
      const options = getAvailableSellUnits(
        {
          activeStandardCasePrice: 725,
          activeSpaCasePrice: 565,
          activeBulkPrice: null,
          activeIndividualVialPrice: 89,
          individualSalesEnabled: true,
          unitsPerCase: 10,
        },
        { adminContext: true }
      )
      const individual = options.find((o) => o.sellUnit === 'INDIVIDUAL_VIAL')
      expect(individual?.visibleToCustomers).toBe(true)
    })

    it('adminContext never invents a price -- a product with no stored individual price still offers no Individual Vial option', () => {
      const options = getAvailableSellUnits(
        {
          activeStandardCasePrice: 500,
          activeSpaCasePrice: null,
          activeBulkPrice: null,
          activeIndividualVialPrice: null,
          individualSalesEnabled: false,
          unitsPerCase: 10,
        },
        { adminContext: true }
      )
      expect(options.map((o) => o.sellUnit)).not.toContain('INDIVIDUAL_VIAL')
    })
  })
})
