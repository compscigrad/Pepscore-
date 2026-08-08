// Order-side counterpart to lib/inventory/reservations.ts (which is
// invoice-scoped and deliberately left untouched -- see OrderReservation's
// schema comment). Smaller on purpose: storefront Orders have no admin
// correction panel, no quantity-edit-after-creation flow, no restore/
// reverse-fulfillment actions -- just reserve at checkout, then either
// fulfill (payment succeeded) or release (payment failed/cancelled)
// exactly once. Same Tx-core-plus-public-wrapper shape, same idempotent-
// by-status-transition discipline, same shortfall-aware reservation math,
// reusing the identical computeInventoryStatus()/Product.reservedUnits
// primitives the invoice-side reservations already use.
import { randomUUID } from 'crypto'
import { Prisma, PrismaClient, type OrderReservation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeInventoryStatus } from './status'
import { refreshLowStockAlert } from './lowStockAlerts'

type Db = PrismaClient | Prisma.TransactionClient

export interface ReserveOrderItemInput {
  productId: string
  orderId: string
  orderItemId: string
  quantity: number
  actor: string
}

export interface ReserveOrderItemResult {
  reservation: OrderReservation | null
  reservedQuantity: number
  shortfall: number
}

export async function reserveForOrderItemTx(tx: Db, input: ReserveOrderItemInput): Promise<ReserveOrderItemResult> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('quantity must be a positive integer')

  const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } })
  if (!product.inventoryTrackingEnabled) return { reservation: null, reservedQuantity: 0, shortfall: 0 }
  if (product.physicalStockOnHand === null) {
    return { reservation: null, reservedQuantity: 0, shortfall: input.quantity }
  }

  const existing = await tx.orderReservation.findFirst({ where: { orderItemId: input.orderItemId, status: 'ACTIVE' } })
  if (existing) return { reservation: existing, reservedQuantity: existing.quantity, shortfall: 0 }

  const availableForMore = Math.max(0, product.physicalStockOnHand - product.reservedUnits)
  const toReserve = Math.min(input.quantity, availableForMore)
  const shortfall = input.quantity - toReserve
  if (toReserve <= 0) return { reservation: null, reservedQuantity: 0, shortfall: input.quantity }

  const newReserved = product.reservedUnits + toReserve
  const newStatus = computeInventoryStatus({
    inventoryTrackingEnabled: product.inventoryTrackingEnabled,
    physicalStockOnHand: product.physicalStockOnHand,
    reservedUnits: newReserved,
    lowStockThreshold: product.lowStockThreshold,
  })

  const created = await tx.orderReservation.create({
    data: { productId: input.productId, orderId: input.orderId, orderItemId: input.orderItemId, quantity: toReserve, status: 'ACTIVE' },
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
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      actor: input.actor,
      actorType: 'SYSTEM',
      notes: shortfall > 0 ? `Reserved ${toReserve} vial(s) of ${input.quantity} requested (${shortfall} short)` : `Reserved ${toReserve} vial(s)`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(input.productId, input.actor, tx)
  return { reservation: created, reservedQuantity: toReserve, shortfall }
}

export async function reserveForOrderItem(input: ReserveOrderItemInput): Promise<ReserveOrderItemResult> {
  return prisma.$transaction((tx) => reserveForOrderItemTx(tx, input))
}

export async function releaseOrderReservationTx(tx: Db, reservationId: string, actor: string, reason?: string): Promise<OrderReservation> {
  const reservation = await tx.orderReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op

  const product = await tx.product.findUniqueOrThrow({ where: { id: reservation.productId } })
  const newReserved = Math.max(0, product.reservedUnits - reservation.quantity)
  const newStatus = computeInventoryStatus({
    inventoryTrackingEnabled: product.inventoryTrackingEnabled,
    physicalStockOnHand: product.physicalStockOnHand,
    reservedUnits: newReserved,
    lowStockThreshold: product.lowStockThreshold,
  })

  const updated = await tx.orderReservation.update({ where: { id: reservationId }, data: { status: 'RELEASED', releasedAt: new Date() } })
  await tx.product.update({ where: { id: reservation.productId }, data: { reservedUnits: newReserved, inventoryStatus: newStatus } })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: product.sku,
      quantityDelta: 0,
      previousBalance: product.physicalStockOnHand ?? 0,
      resultingBalance: product.physicalStockOnHand ?? 0,
      eventType: 'RESERVATION_RELEASE',
      orderId: reservation.orderId,
      orderItemId: reservation.orderItemId,
      actor,
      actorType: 'SYSTEM',
      reason,
      notes: `Released ${reservation.quantity} vial(s)`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return updated
}

export async function releaseOrderReservation(reservationId: string, actor: string, reason?: string): Promise<OrderReservation> {
  return prisma.$transaction((tx) => releaseOrderReservationTx(tx, reservationId, actor, reason))
}

export async function fulfillOrderReservationTx(tx: Db, reservationId: string, actor: string): Promise<OrderReservation> {
  const reservation = await tx.orderReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op

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

  const updated = await tx.orderReservation.update({ where: { id: reservationId }, data: { status: 'FULFILLED', fulfilledAt: new Date() } })
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
      orderId: reservation.orderId,
      orderItemId: reservation.orderItemId,
      actor,
      actorType: 'SYSTEM',
      notes: `Fulfilled ${reservation.quantity} vial(s)`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return updated
}

export async function fulfillOrderReservation(reservationId: string, actor: string): Promise<OrderReservation> {
  return prisma.$transaction((tx) => fulfillOrderReservationTx(tx, reservationId, actor))
}

// Bulk helpers -- checkout/webhook code always acts on "every reservation
// for this order," never a single line item in isolation.
export async function releaseAllOrderReservationsTx(tx: Db, orderId: string, actor: string, reason?: string): Promise<void> {
  const active = await tx.orderReservation.findMany({ where: { orderId, status: 'ACTIVE' } })
  for (const r of active) {
    await releaseOrderReservationTx(tx, r.id, actor, reason)
  }
}

export async function fulfillAllOrderReservationsTx(tx: Db, orderId: string, actor: string): Promise<void> {
  const active = await tx.orderReservation.findMany({ where: { orderId, status: 'ACTIVE' } })
  for (const r of active) {
    await fulfillOrderReservationTx(tx, r.id, actor)
  }
}
