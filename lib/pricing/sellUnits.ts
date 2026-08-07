// Determines which sell units the invoice builder is allowed to offer for a
// product. This is the one gate individual-vial sales pass through --
// storing activeIndividualVialPrice (e.g. Tesamorelin's approved-but-hidden
// $80) never by itself makes that sell unit selectable; only
// individualSalesEnabled=true does.
export type SellUnit = 'CASE_STANDARD' | 'CASE_SPA' | 'CASE_BULK' | 'INDIVIDUAL_VIAL'

export interface SellUnitAvailabilityInput {
  activeStandardCasePrice: number | null
  activeSpaCasePrice: number | null
  activeBulkPrice: number | null
  activeIndividualVialPrice: number | null
  individualSalesEnabled: boolean
  unitsPerCase: number | null
}

export interface AvailableSellUnitOption {
  sellUnit: SellUnit
  label: string
  price: number
  unitsPerSellUnit: number
}

export function getAvailableSellUnits(product: SellUnitAvailabilityInput): AvailableSellUnitOption[] {
  const caseSize = product.unitsPerCase ?? 10
  const options: AvailableSellUnitOption[] = []

  if (product.activeStandardCasePrice !== null) {
    options.push({ sellUnit: 'CASE_STANDARD', label: 'Standard Case', price: product.activeStandardCasePrice, unitsPerSellUnit: caseSize })
  }
  if (product.activeSpaCasePrice !== null) {
    options.push({ sellUnit: 'CASE_SPA', label: 'SPA Case', price: product.activeSpaCasePrice, unitsPerSellUnit: caseSize })
  }
  if (product.activeBulkPrice !== null) {
    options.push({ sellUnit: 'CASE_BULK', label: 'Bulk', price: product.activeBulkPrice, unitsPerSellUnit: caseSize })
  }
  if (product.individualSalesEnabled && product.activeIndividualVialPrice !== null) {
    options.push({ sellUnit: 'INDIVIDUAL_VIAL', label: 'Individual Vial', price: product.activeIndividualVialPrice, unitsPerSellUnit: 1 })
  }

  return options
}
