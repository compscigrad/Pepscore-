// The one place that ever writes Product.physicalStockOnHand. Every named
// action in lib/inventory/actions.ts goes through this so every physical-
// count change is ledgered -- never a bare prisma.product.update() of this
// field anywhere else in the codebase.
import { randomUUID } from 'crypto'
import type { InventoryEventType, InventoryActorType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeInventoryStatus } from './status'

export interface ApplyLedgerEventInput {
  productId: string
  quantityDelta: number
  eventType: InventoryEventType
  actor: string
  actorType?: InventoryActorType
  reason?: string | null
  notes?: string | null
  invoiceId?: string | null
  invoiceItemId?: string | null
  idempotencyKey?: string
  reversalOfId?: string | null
  // Only true for the very first write to a product's physical count --
  // every other event requires physicalStockOnHand to already be non-null,
  // so a stray restock/decrease call can never silently invent an opening
  // quantity for a product still Awaiting Inventory Initialization.
  allowInitialize?: boolean
}

export async function applyLedgerEvent(input: ApplyLedgerEventInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } })

    if (product.physicalStockOnHand === null && !input.allowInitialize) {
      throw new Error('Product has not been initialized -- call initializeInventory first')
    }
    if (product.physicalStockOnHand !== null && input.allowInitialize) {
      throw new Error('Product is already initialized -- this action only applies once')
    }

    const previousBalance = product.physicalStockOnHand ?? 0
    const resultingBalance = previousBalance + input.quantityDelta
    if (resultingBalance < 0) {
      throw new Error(`Adjustment would drive physical stock negative (${previousBalance} + ${input.quantityDelta} = ${resultingBalance})`)
    }

    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: resultingBalance,
      reservedUnits: product.reservedUnits,
      lowStockThreshold: product.lowStockThreshold,
    })

    const entry = await tx.inventoryLedgerEntry.create({
      data: {
        productId: input.productId,
        skuSnapshot: product.sku,
        quantityDelta: input.quantityDelta,
        previousBalance,
        resultingBalance,
        eventType: input.eventType,
        reason: input.reason ?? undefined,
        invoiceId: input.invoiceId ?? undefined,
        invoiceItemId: input.invoiceItemId ?? undefined,
        actor: input.actor,
        actorType: input.actorType ?? 'ADMIN',
        notes: input.notes ?? undefined,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        reversalOfId: input.reversalOfId ?? undefined,
      },
    })

    await tx.product.update({
      where: { id: input.productId },
      data: { physicalStockOnHand: resultingBalance, inventoryStatus: newStatus },
    })

    return entry
  })
}
