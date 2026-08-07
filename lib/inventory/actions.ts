// The six named manual inventory-entry actions plus reversal -- the exact
// set the admin Inventory page exposes. Each is a thin, named wrapper
// around applyLedgerEvent so the ledger's eventType always reflects what
// the admin actually clicked, not a generic "adjustment."
import { prisma } from '@/lib/prisma'
import { applyLedgerEvent } from './ledger'
import { refreshLowStockAlert } from './lowStockAlerts'

export async function enableInventoryTracking(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  if (product.inventoryTrackingEnabled) return product
  return prisma.product.update({
    where: { id: productId },
    data: { inventoryTrackingEnabled: true, inventoryStatus: product.physicalStockOnHand === null ? 'AWAITING_INITIALIZATION' : product.inventoryStatus },
  })
}

export async function initializeInventory(productId: string, openingCount: number, actor: string, notes?: string) {
  if (!Number.isInteger(openingCount) || openingCount < 0) throw new Error('openingCount must be a non-negative integer')
  const entry = await applyLedgerEvent({ productId, quantityDelta: openingCount, eventType: 'INITIALIZE', actor, notes, allowInitialize: true })
  await refreshLowStockAlert(productId, actor)
  return entry
}

export async function addStock(productId: string, quantity: number, actor: string, reason?: string, notes?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer')
  const entry = await applyLedgerEvent({ productId, quantityDelta: quantity, eventType: 'RESTOCK', actor, reason, notes })
  await refreshLowStockAlert(productId, actor)
  return entry
}

export async function removeStock(productId: string, quantity: number, actor: string, reason?: string, notes?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer')
  const entry = await applyLedgerEvent({ productId, quantityDelta: -quantity, eventType: 'MANUAL_DECREASE', actor, reason, notes })
  await refreshLowStockAlert(productId, actor)
  return entry
}

export async function recordDamageLoss(productId: string, quantity: number, actor: string, reason?: string, notes?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer')
  const entry = await applyLedgerEvent({ productId, quantityDelta: -quantity, eventType: 'DAMAGE_LOSS', actor, reason, notes })
  await refreshLowStockAlert(productId, actor)
  return entry
}

// "Set Exact Count" never silently overwrites -- it computes the delta
// against the current balance and records that delta as a RECONCILIATION
// event, so the ledger shows "-7 vials" (with both the previous and
// resulting count still visible on the same row), never a bare replacement.
export async function setExactCount(productId: string, newCount: number, actor: string, reason?: string, notes?: string) {
  if (!Number.isInteger(newCount) || newCount < 0) throw new Error('newCount must be a non-negative integer')
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  if (product.physicalStockOnHand === null) throw new Error('Product has not been initialized -- use initializeInventory first')
  const delta = newCount - product.physicalStockOnHand
  const entry = await applyLedgerEvent({
    productId,
    quantityDelta: delta,
    eventType: 'RECONCILIATION',
    actor,
    reason: reason ?? `Reconciliation: ${product.physicalStockOnHand} -> ${newCount}`,
    notes,
  })
  await refreshLowStockAlert(productId, actor)
  return entry
}

// Reverses the most recent *manual* adjustment for a product -- reservation/
// release/fulfillment events are deliberately excluded, since those are
// undone through their own release/void paths, not a generic "last action"
// reversal. A row that's already been reversed (or is itself a reversal) is
// never eligible again.
export async function reverseLastAdjustment(productId: string, actor: string, notes?: string) {
  const last = await prisma.inventoryLedgerEntry.findFirst({
    where: {
      productId,
      reversalOfId: null,
      reversedBy: null,
      eventType: { notIn: ['RESERVATION', 'RESERVATION_RELEASE', 'FULFILLMENT_DEDUCTION', 'BACKORDER_ALLOCATION'] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!last) throw new Error('No reversible adjustment found for this product')

  const entry = await applyLedgerEvent({
    productId,
    quantityDelta: -last.quantityDelta,
    eventType: 'REVERSAL',
    actor,
    reason: `Reversal of ${last.eventType} (${last.id})`,
    notes,
    reversalOfId: last.id,
  })
  await refreshLowStockAlert(productId, actor)
  return entry
}
