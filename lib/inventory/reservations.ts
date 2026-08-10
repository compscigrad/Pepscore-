// Reservation/release/fulfillment/adjustment -- distinct from
// lib/inventory/ledger.ts because a reservation never touches
// Product.physicalStockOnHand (it's a commitment against stock that's
// still physically in the warehouse); only fulfillment ever deducts the
// physical count. Every state transition is gated on the reservation's own
// status field so a second call is always a safe no-op, never a second
// deduction or a double release -- that's what makes "fulfillment
// deduction exactly once" true by construction rather than by caller
// discipline.
//
// Every write to Product.reservedUnits/physicalStockOnHand in this file
// goes through withOptimisticProductLock() (lib/inventory/optimisticLock.ts)
// -- a Phase 4A audit fix. See that file's header comment for why a plain
// read-then-update was unsafe under concurrent access.
//
// Each function has a `*Tx` core (takes a Prisma client/transaction) and a
// thin public wrapper that opens its own transaction -- same pattern as
// lib/backorders.ts's applyCompensation/applyCompensationTx. The Tx
// variants are what lib/invoices.ts (invoice save) and
// lib/tracking/service.ts (shipment registration) call, so reservation
// sync is atomic with the invoice-item write it's reacting to; the public
// wrappers are what the admin correction UI and standalone scripts call.
import { randomUUID } from 'crypto'
import { type InventoryReservation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeInventoryStatus } from './status'
import { refreshLowStockAlert } from './lowStockAlerts'
import { withOptimisticProductLock, type Db } from './optimisticLock'

export interface ReserveInput {
  productId: string
  invoiceId: string
  invoiceItemId: string
  quantity: number
  actor: string
}

// One ACTIVE reservation per invoiceItemId, by construction -- a second
// call for the same line item returns the existing row unchanged (never a
// duplicate reservation), matching "remain idempotent" / "retry or
// duplicate request." To change the quantity on an existing reservation,
// use adjustReservationQuantityTx instead.
//
// Returns null (not an error) for a product with inventory tracking
// disabled -- untracked products are sellable without ever reserving
// against a count that doesn't exist. Never reserves more than is
// currently available: if requested quantity exceeds what's on hand minus
// what's already reserved elsewhere, only the available portion is
// reserved and the shortfall is returned as `shortfall` for the caller to
// surface (e.g. prompting an admin to apply a formal backorder) --
// reservation itself never manufactures phantom stock and never sends any
// customer communication.
export interface ReserveResult {
  reservation: InventoryReservation | null
  reservedQuantity: number
  shortfall: number
}

export async function reserveForInvoiceItemTx(tx: Db, input: ReserveInput): Promise<ReserveResult> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('quantity must be a positive integer')

  const existing = await tx.inventoryReservation.findFirst({ where: { invoiceItemId: input.invoiceItemId, status: 'ACTIVE' } })
  if (existing) return { reservation: existing, reservedQuantity: existing.quantity, shortfall: 0 }

  const outcome = await withOptimisticProductLock(tx, input.productId, (product) => {
    if (!product.inventoryTrackingEnabled) return { data: null, result: { toReserve: 0, shortfall: 0, sku: product.sku, stockOnHand: product.physicalStockOnHand } }
    if (product.physicalStockOnHand === null) {
      // Awaiting initialization -- nothing can be confidently reserved yet;
      // the entire request is a shortfall, not an error, so a draft-to-issued
      // transition for an untracked-count product doesn't hard-fail the save.
      return { data: null, result: { toReserve: 0, shortfall: input.quantity, sku: product.sku, stockOnHand: null } }
    }

    const availableForMore = Math.max(0, product.physicalStockOnHand - product.reservedUnits)
    const toReserve = Math.min(input.quantity, availableForMore)
    if (toReserve <= 0) return { data: null, result: { toReserve: 0, shortfall: input.quantity, sku: product.sku, stockOnHand: product.physicalStockOnHand } }

    const newReserved = product.reservedUnits + toReserve
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return {
      data: { reservedUnits: newReserved, inventoryStatus: newStatus },
      result: { toReserve, shortfall: input.quantity - toReserve, sku: product.sku, stockOnHand: product.physicalStockOnHand },
    }
  })

  const { toReserve, shortfall, sku, stockOnHand } = outcome
  if (toReserve <= 0) return { reservation: null, reservedQuantity: 0, shortfall }

  const created = await tx.inventoryReservation.create({
    data: { productId: input.productId, invoiceId: input.invoiceId, invoiceItemId: input.invoiceItemId, quantity: toReserve, status: 'ACTIVE' },
  })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: input.productId,
      skuSnapshot: sku,
      quantityDelta: 0,
      previousBalance: stockOnHand ?? 0,
      resultingBalance: stockOnHand ?? 0,
      eventType: 'RESERVATION',
      invoiceId: input.invoiceId,
      invoiceItemId: input.invoiceItemId,
      actor: input.actor,
      actorType: 'SYSTEM',
      notes: shortfall > 0 ? `Reserved ${toReserve} vial(s) of ${input.quantity} requested (${shortfall} short)` : `Reserved ${toReserve} vial(s)`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(input.productId, input.actor, tx)
  return { reservation: created, reservedQuantity: toReserve, shortfall }
}

export async function reserveForInvoiceItem(input: ReserveInput): Promise<ReserveResult> {
  return prisma.$transaction((tx) => reserveForInvoiceItemTx(tx, input))
}

// Adjusts an existing ACTIVE reservation's quantity up or down in place --
// this is the mechanism behind "quantity increase: reserve only the
// additional units" and "quantity decrease: release only the excess" for
// an already-issued invoice being edited, and behind the admin "Correct
// Reservation" action. A no-op (no ledger event) when newQuantity already
// equals the current quantity -- repeated saves with no real change create
// nothing. newQuantity=0 fully releases (status -> RELEASED) rather than
// leaving a zero-quantity ACTIVE row. Increasing is capped at actual
// availability exactly like reserveForInvoiceItemTx; the shortfall (if
// any) is returned, never silently dropped or over-reserved.
export interface AdjustResult {
  reservation: InventoryReservation
  shortfall: number
}

export async function adjustReservationQuantityTx(
  tx: Db,
  reservationId: string,
  newQuantity: number,
  actor: string,
  reason?: string
): Promise<AdjustResult> {
  if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error('newQuantity must be a non-negative integer')

  const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'ACTIVE') {
    // Nothing to adjust on a released/fulfilled reservation -- idempotent no-op.
    return { reservation, shortfall: 0 }
  }
  if (newQuantity === reservation.quantity) return { reservation, shortfall: 0 }

  if (newQuantity === 0) {
    const released = await releaseReservationTx(tx, reservationId, actor, reason)
    return { reservation: released, shortfall: 0 }
  }

  const delta = newQuantity - reservation.quantity

  const outcome = await withOptimisticProductLock(tx, reservation.productId, (product) => {
    let appliedDelta = delta
    let shortfall = 0
    if (delta > 0) {
      const availableForMore = Math.max(0, (product.physicalStockOnHand ?? 0) - product.reservedUnits)
      appliedDelta = Math.min(delta, availableForMore)
      shortfall = delta - appliedDelta
    }
    const newReserved = Math.max(0, product.reservedUnits + appliedDelta)
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return {
      data: { reservedUnits: newReserved, inventoryStatus: newStatus },
      result: { appliedDelta, shortfall, sku: product.sku, stockOnHand: product.physicalStockOnHand },
    }
  })

  const { appliedDelta, shortfall, sku, stockOnHand } = outcome
  const finalQuantity = reservation.quantity + appliedDelta

  const updated = await tx.inventoryReservation.update({ where: { id: reservationId }, data: { quantity: finalQuantity } })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: sku,
      quantityDelta: 0,
      previousBalance: stockOnHand ?? 0,
      resultingBalance: stockOnHand ?? 0,
      eventType: appliedDelta >= 0 ? 'RESERVATION' : 'RESERVATION_RELEASE',
      invoiceId: reservation.invoiceId,
      invoiceItemId: reservation.invoiceItemId,
      actor,
      actorType: 'SYSTEM',
      reason,
      notes: `Adjusted reservation ${reservation.quantity} -> ${finalQuantity} (${appliedDelta >= 0 ? '+' : ''}${appliedDelta})${shortfall > 0 ? `, ${shortfall} short` : ''}`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return { reservation: updated, shortfall }
}

export async function adjustReservationQuantity(reservationId: string, newQuantity: number, actor: string, reason?: string): Promise<AdjustResult> {
  return prisma.$transaction((tx) => adjustReservationQuantityTx(tx, reservationId, newQuantity, actor, reason))
}

export async function releaseReservationTx(tx: Db, reservationId: string, actor: string, reason?: string): Promise<InventoryReservation> {
  const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op

  const { sku, stockOnHand } = await withOptimisticProductLock(tx, reservation.productId, (product) => {
    const newReserved = Math.max(0, product.reservedUnits - reservation.quantity)
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return { data: { reservedUnits: newReserved, inventoryStatus: newStatus }, result: { sku: product.sku, stockOnHand: product.physicalStockOnHand } }
  })

  const updated = await tx.inventoryReservation.update({ where: { id: reservationId }, data: { status: 'RELEASED', releasedAt: new Date() } })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: sku,
      quantityDelta: 0,
      previousBalance: stockOnHand ?? 0,
      resultingBalance: stockOnHand ?? 0,
      eventType: 'RESERVATION_RELEASE',
      invoiceId: reservation.invoiceId,
      invoiceItemId: reservation.invoiceItemId,
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

export async function releaseReservation(reservationId: string, actor: string, reason?: string): Promise<InventoryReservation> {
  return prisma.$transaction((tx) => releaseReservationTx(tx, reservationId, actor, reason))
}

// Restores a previously RELEASED reservation back to ACTIVE (the admin
// "Restore Missing Reservation" correction) -- re-checks availability
// exactly like a fresh reservation, since stock may have moved since it
// was released. Idempotent: restoring an already-ACTIVE reservation is a
// no-op; a FULFILLED reservation can never be restored (that would imply
// un-deducting physical stock, which is a fulfillment reversal, not a
// restore).
export async function restoreReservationTx(tx: Db, reservationId: string, actor: string, reason?: string): Promise<AdjustResult> {
  const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status === 'ACTIVE') return { reservation, shortfall: 0 }
  if (reservation.status === 'FULFILLED') throw new Error('Cannot restore a fulfilled reservation -- use reverseFulfillment instead')

  const outcome = await withOptimisticProductLock(tx, reservation.productId, (product) => {
    const availableForMore = Math.max(0, (product.physicalStockOnHand ?? 0) - product.reservedUnits)
    const toRestore = Math.min(reservation.quantity, availableForMore)
    if (toRestore <= 0) throw new Error('Cannot restore this reservation -- no availability remains')

    const newReserved = product.reservedUnits + toRestore
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return {
      data: { reservedUnits: newReserved, inventoryStatus: newStatus },
      result: { toRestore, shortfall: reservation.quantity - toRestore, sku: product.sku, stockOnHand: product.physicalStockOnHand },
    }
  })

  const { toRestore, shortfall, sku, stockOnHand } = outcome
  const updated = await tx.inventoryReservation.update({
    where: { id: reservationId },
    data: { status: 'ACTIVE', quantity: toRestore, releasedAt: null },
  })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: sku,
      quantityDelta: 0,
      previousBalance: stockOnHand ?? 0,
      resultingBalance: stockOnHand ?? 0,
      eventType: 'RESERVATION',
      invoiceId: reservation.invoiceId,
      invoiceItemId: reservation.invoiceItemId,
      actor,
      actorType: 'ADMIN',
      reason,
      notes: `Restored reservation (${toRestore} vial(s))${shortfall > 0 ? `, ${shortfall} short` : ''}`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return { reservation: updated, shortfall }
}

export async function restoreReservation(reservationId: string, actor: string, reason?: string): Promise<AdjustResult> {
  return prisma.$transaction((tx) => restoreReservationTx(tx, reservationId, actor, reason))
}

export async function fulfillReservationTx(tx: Db, reservationId: string, actor: string): Promise<InventoryReservation> {
  const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'ACTIVE') return reservation // idempotent no-op -- deduction already happened (or was released)

  const { previousBalance, resultingBalance, sku } = await withOptimisticProductLock(tx, reservation.productId, (product) => {
    const previousBalance = product.physicalStockOnHand ?? 0
    const resultingBalance = previousBalance - reservation.quantity
    // Defense in depth: a correctly-created ACTIVE reservation should never
    // be able to drive this negative, but a legitimate downward physical-
    // count correction (lib/inventory/actions.ts) made *after* the
    // reservation existed could -- fail loudly rather than silently write a
    // corrupt negative count, matching applyLedgerEvent's own floor check.
    if (resultingBalance < 0) {
      throw new Error(
        `Fulfilling this reservation would drive physical stock negative (${previousBalance} - ${reservation.quantity} = ${resultingBalance}) for product ${reservation.productId}`
      )
    }
    const newReserved = Math.max(0, product.reservedUnits - reservation.quantity)
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: resultingBalance,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return {
      data: { physicalStockOnHand: resultingBalance, reservedUnits: newReserved, inventoryStatus: newStatus },
      result: { previousBalance, resultingBalance, sku: product.sku },
    }
  })

  const updated = await tx.inventoryReservation.update({ where: { id: reservationId }, data: { status: 'FULFILLED', fulfilledAt: new Date() } })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: sku,
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
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return updated
}

export async function fulfillReservation(reservationId: string, actor: string): Promise<InventoryReservation> {
  return prisma.$transaction((tx) => fulfillReservationTx(tx, reservationId, actor))
}

// Reverses a FULFILLED reservation: adds the physical stock back
// (quantityDelta positive) and restores the reservation to ACTIVE (still
// committed, just no longer physically shipped) -- the admin "Reverse
// Fulfillment Deduction" correction. Idempotent: a non-FULFILLED
// reservation is a no-op.
export async function reverseFulfillmentTx(tx: Db, reservationId: string, actor: string, reason: string): Promise<InventoryReservation> {
  const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  if (reservation.status !== 'FULFILLED') return reservation // idempotent no-op

  const { previousBalance, resultingBalance, sku } = await withOptimisticProductLock(tx, reservation.productId, (product) => {
    const previousBalance = product.physicalStockOnHand ?? 0
    const resultingBalance = previousBalance + reservation.quantity
    const newReserved = product.reservedUnits + reservation.quantity
    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: resultingBalance,
      reservedUnits: newReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    return {
      data: { physicalStockOnHand: resultingBalance, reservedUnits: newReserved, inventoryStatus: newStatus },
      result: { previousBalance, resultingBalance, sku: product.sku },
    }
  })

  const updated = await tx.inventoryReservation.update({ where: { id: reservationId }, data: { status: 'ACTIVE', fulfilledAt: null } })
  await tx.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      skuSnapshot: sku,
      quantityDelta: reservation.quantity,
      previousBalance,
      resultingBalance,
      eventType: 'REVERSAL',
      invoiceId: reservation.invoiceId,
      invoiceItemId: reservation.invoiceItemId,
      actor,
      actorType: 'ADMIN',
      reason,
      notes: `Reversed fulfillment deduction of ${reservation.quantity} vial(s)`,
      idempotencyKey: randomUUID(),
    },
  })
  await refreshLowStockAlert(reservation.productId, actor, tx)
  return updated
}

export async function reverseFulfillment(reservationId: string, actor: string, reason: string): Promise<InventoryReservation> {
  return prisma.$transaction((tx) => reverseFulfillmentTx(tx, reservationId, actor, reason))
}

// Applies a fulfillment deduction that was missed (the admin "Reapply
// Fulfillment Deduction" correction) -- functionally identical to
// fulfillReservationTx, exposed under its own name so the ledger's `notes`
// and the admin UI's action label make the intent explicit.
export const reapplyFulfillmentTx = fulfillReservationTx
export const reapplyFulfillment = fulfillReservation
