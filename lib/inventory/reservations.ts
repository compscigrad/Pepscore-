// Reservation/release/fulfillment -- distinct from lib/inventory/ledger.ts
// because a reservation never touches Product.physicalStockOnHand (it's a
// commitment against stock that's still physically in the warehouse); only
// fulfillReservation ever deducts the physical count. Every state
// transition is gated on the reservation's own status field so a second
// call is always a safe no-op, never a second deduction or a double
// release -- that's what makes "fulfillment deduction exactly once" true
// by construction rather than by caller discipline.
import { randomUUID } from 'crypto'
import type { InventoryReservation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeInventoryStatus } from './status'
import { refreshLowStockAlert } from './lowStockAlerts'

export interface ReserveInput {
  productId: string
  invoiceId: string
  invoiceItemId: string
  quantity: number
  actor: string
}

// Returns null (not an error) for a product with inventory tracking
// disabled -- untracked products are sellable without ever reserving
// against a count that doesn't exist. Throws if tracking is on but the
// product is still Awaiting Inventory Initialization, since a reservation
// against an unknown opening quantity would be meaningless.
export async function reserveForInvoiceItem(input: ReserveInput): Promise<InventoryReservation | null> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('quantity must be a positive integer')

  const reservation = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } })
    if (!product.inventoryTrackingEnabled) return null
    if (product.physicalStockOnHand === null) {
      throw new Error('Cannot reserve stock for a product still Awaiting Inventory Initialization')
    }

    const newReserved = product.reservedUnits + input.quantity
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })

    const created = await tx.inventoryReservation.create({
      data: {
        productId: input.productId,
        invoiceId: input.invoiceId,
        invoiceItemId: input.invoiceItemId,
        quantity: input.quantity,
        status: 'ACTIVE',
      },
    })
    await tx.product.update({ where: { id: input.productId }, data: { reservedUnits: newReserved, inventoryStatus: newStatus } })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId: input.productId,
        skuSnapshot: product.sku,
        quantityDelta: 0,
        previousBalance: product.physicalStockOnHand,
        resultingBalance: product.physicalStockOnHand,
        eventType: 'RESERVATION',
        invoiceId: input.invoiceId,
        invoiceItemId: input.invoiceItemId,
        actor: input.actor,
        actorType: 'SYSTEM',
        notes: `Reserved ${input.quantity} vial(s)`,
        idempotencyKey: randomUUID(),
      },
    })
    return created
  })

  if (reservation) await refreshLowStockAlert(input.productId, input.actor)
  return reservation
}

export async function releaseReservation(reservationId: string, actor: string): Promise<InventoryReservation> {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
    if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op

    const product = await tx.product.findUniqueOrThrow({ where: { id: reservation.productId } })
    const newReserved = Math.max(0, product.reservedUnits - reservation.quantity)
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })

    const updated = await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })
    await tx.product.update({ where: { id: reservation.productId }, data: { reservedUnits: newReserved, inventoryStatus: newStatus } })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId: reservation.productId,
        skuSnapshot: product.sku,
        quantityDelta: 0,
        previousBalance: product.physicalStockOnHand ?? 0,
        resultingBalance: product.physicalStockOnHand ?? 0,
        eventType: 'RESERVATION_RELEASE',
        invoiceId: reservation.invoiceId,
        invoiceItemId: reservation.invoiceItemId,
        actor,
        actorType: 'SYSTEM',
        notes: `Released ${reservation.quantity} vial(s)`,
        idempotencyKey: randomUUID(),
      },
    })
    return updated
  })

  await refreshLowStockAlert(result.productId, actor)
  return result
}

export async function fulfillReservation(reservationId: string, actor: string): Promise<InventoryReservation> {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
    if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op -- deduction already happened

    const product = await tx.product.findUniqueOrThrow({ where: { id: reservation.productId } })
    const previousBalance = product.physicalStockOnHand ?? 0
    const resultingBalance = previousBalance - reservation.quantity
    const newReserved = Math.max(0, product.reservedUnits - reservation.quantity)
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: resultingBalance,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })

    const updated = await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    })
    await tx.product.update({
      where: { id: reservation.productId },
      data: { physicalStockOnHand: resultingBalance, reservedUnits: newReserved, inventoryStatus: newStatus },
    })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId: reservation.productId,
        skuSnapshot: product.sku,
        quantityDelta: -reservation.quantity,
        previousBalance,
        resultingBalance,
        eventType: 'FULFILLMENT_DEDUCTION',
        invoiceId: reservation.invoiceId,
        invoiceItemId: reservation.invoiceItemId,
        actor,
        actorType: 'SYSTEM',
        notes: `Fulfilled ${reservation.quantity} vial(s)`,
        idempotencyKey: randomUUID(),
      },
    })
    return updated
  })

  await refreshLowStockAlert(result.productId, actor)
  return result
}
