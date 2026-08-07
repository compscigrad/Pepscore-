// Pure computation of a product's cached inventoryStatus. No DB access.
// Called by lib/inventory/ledger.ts after every write that can change
// physicalStockOnHand/reservedUnits/lowStockThreshold/inventoryTrackingEnabled.
export type InventoryStatus = 'TRACKING_DISABLED' | 'AWAITING_INITIALIZATION' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface InventoryStatusInput {
  inventoryTrackingEnabled: boolean
  physicalStockOnHand: number | null
  reservedUnits: number
  lowStockThreshold: number | null
}

export function computeInventoryStatus(input: InventoryStatusInput): InventoryStatus {
  if (!input.inventoryTrackingEnabled) return 'TRACKING_DISABLED'
  if (input.physicalStockOnHand === null) return 'AWAITING_INITIALIZATION'

  const available = input.physicalStockOnHand - input.reservedUnits
  if (available <= 0) return 'OUT_OF_STOCK'
  if (input.lowStockThreshold !== null && available <= input.lowStockThreshold) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export function computeAvailableUnits(physicalStockOnHand: number | null, reservedUnits: number): number | null {
  if (physicalStockOnHand === null) return null
  return physicalStockOnHand - reservedUnits
}

export function computeCompleteCasesAvailable(physicalStockOnHand: number | null, reservedUnits: number, unitsPerCase: number | null): number | null {
  const available = computeAvailableUnits(physicalStockOnHand, reservedUnits)
  if (available === null || unitsPerCase === null || unitsPerCase <= 0) return null
  return Math.max(0, Math.floor(available / unitsPerCase))
}
