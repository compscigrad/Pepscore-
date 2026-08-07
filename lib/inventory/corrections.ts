// Admin discrepancy-correction workflow -- every action here is a
// deliberate, reasoned admin decision (never automatic), always requires
// a real actor (Clerk userId, not a system string), and is ledger-backed
// through the same primitives the automatic invoice-lifecycle wiring uses
// (lib/inventory/reservations.ts, lib/inventory/actions.ts) so a
// correction is indistinguishable in the audit trail from any other event
// except for its ADMIN actorType and (where relevant) its `reason`.
//
// Nothing here deletes or silently overwrites a prior record -- every
// correction is itself a new, additional event.
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { computeInventoryStatus } from './status'
import { refreshLowStockAlert } from './lowStockAlerts'
import {
  adjustReservationQuantity,
  adjustReservationQuantityTx,
  releaseReservation,
  restoreReservation,
  reverseFulfillment,
  reapplyFulfillment,
} from './reservations'
import { setExactCount } from './actions'
import type { InventoryReservation } from '@prisma/client'

// ─── Reservation corrections ────────────────────────────────────────────

export async function correctReservation(reservationId: string, newQuantity: number, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to correct a reservation')
  return adjustReservationQuantity(reservationId, newQuantity, actor, reason)
}

export async function releaseIncorrectReservation(reservationId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to release a reservation')
  return releaseReservation(reservationId, actor, reason)
}

export async function restoreMissingReservation(reservationId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to restore a reservation')
  return restoreReservation(reservationId, actor, reason)
}

// Moves a reservation from one invoice line to another -- e.g. it was
// created against the wrong InvoiceItem row during a messy multi-line
// edit. Implemented as release-old + create-new against the SAME product
// (never changes which product it's reserving), inside one transaction,
// so a failure partway through never leaves stock reserved against
// neither line.
export async function reassignReservation(reservationId: string, newInvoiceItemId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to reassign a reservation')
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
    if (reservation.status !== 'ACTIVE') throw new Error('Only an ACTIVE reservation can be reassigned')
    const newItem = await tx.invoiceItem.findUniqueOrThrow({ where: { id: newInvoiceItemId } })
    if (newItem.productId !== reservation.productId) {
      throw new Error('Reassignment target line item must reference the same product -- use Correct Sell Unit / a fresh reservation for a product change')
    }

    const updated = await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { invoiceId: newItem.invoiceId, invoiceItemId: newInvoiceItemId },
    })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId: reservation.productId,
        quantityDelta: 0,
        previousBalance: 0,
        resultingBalance: 0,
        eventType: 'REVERSAL',
        invoiceId: newItem.invoiceId,
        invoiceItemId: newInvoiceItemId,
        actor,
        actorType: 'ADMIN',
        reason,
        notes: `Reservation reassigned from invoice item ${reservation.invoiceItemId} to ${newInvoiceItemId}`,
        idempotencyKey: randomUUID(),
      },
    })
    return updated
  })
}

export async function markReservationResolved(reservationId: string, actor: string, reason: string): Promise<InventoryReservation> {
  if (!reason.trim()) throw new Error('A reason is required to mark a reservation resolved')
  // "Resolved" for an already-terminal (RELEASED/FULFILLED) reservation is
  // just a documented no-op annotation on the ledger -- the reservation
  // row's own status is never overloaded with a third meaning.
  const reservation = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId } })
  await prisma.inventoryLedgerEntry.create({
    data: {
      productId: reservation.productId,
      quantityDelta: 0,
      previousBalance: 0,
      resultingBalance: 0,
      eventType: 'REVERSAL',
      invoiceId: reservation.invoiceId,
      invoiceItemId: reservation.invoiceItemId,
      actor,
      actorType: 'ADMIN',
      reason,
      notes: `Reservation marked resolved (status remains ${reservation.status})`,
      idempotencyKey: randomUUID(),
    },
  })
  return reservation
}

// ─── Fulfillment corrections ─────────────────────────────────────────────

export async function reverseFulfillmentDeduction(reservationId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to reverse a fulfillment deduction')
  return reverseFulfillment(reservationId, actor, reason)
}

export async function reapplyFulfillmentDeduction(reservationId: string, actor: string) {
  return reapplyFulfillment(reservationId, actor)
}

// ─── Backorder correction ────────────────────────────────────────────────

// Corrects the recorded vialsBackordered on an existing BackorderCondition
// -- never creates or resolves the backorder itself (that stays
// lib/backorders.ts's applyBackorder/resolveBackorder, the existing
// compensation-aware workflow). This only fixes the quantity snapshot
// when it was wrong.
export async function correctBackorderedQuantity(backorderConditionId: string, correctedVials: number, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to correct a backordered quantity')
  if (!Number.isInteger(correctedVials) || correctedVials < 0) throw new Error('correctedVials must be a non-negative integer')

  return prisma.$transaction(async (tx) => {
    const condition = await tx.backorderCondition.findUniqueOrThrow({ where: { id: backorderConditionId } })
    const previous = condition.vialsBackordered
    const updated = await tx.backorderCondition.update({ where: { id: backorderConditionId }, data: { vialsBackordered: correctedVials } })
    if (condition.productId) {
      await tx.inventoryLedgerEntry.create({
        data: {
          productId: condition.productId,
          quantityDelta: 0,
          previousBalance: 0,
          resultingBalance: 0,
          eventType: 'BACKORDER_ALLOCATION',
          invoiceId: condition.invoiceId,
          invoiceItemId: condition.invoiceItemId,
          actor,
          actorType: 'ADMIN',
          reason,
          notes: `Backordered quantity corrected ${previous ?? 'unset'} -> ${correctedVials}`,
          idempotencyKey: randomUUID(),
        },
      })
    }
    return updated
  })
}

// ─── Product configuration corrections ───────────────────────────────────

export async function correctUnitsPerCase(productId: string, unitsPerCase: number | null, actor: string, reason: string) {
  if (!reason.trim()) throw new Error('A reason is required to correct units per case')
  if (unitsPerCase !== null && (!Number.isInteger(unitsPerCase) || unitsPerCase <= 0)) throw new Error('unitsPerCase must be a positive integer or null')

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    const updated = await tx.product.update({ where: { id: productId }, data: { unitsPerCase } })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId,
        skuSnapshot: product.sku,
        quantityDelta: 0,
        previousBalance: product.physicalStockOnHand ?? 0,
        resultingBalance: product.physicalStockOnHand ?? 0,
        eventType: 'RECONCILIATION',
        actor,
        actorType: 'ADMIN',
        reason,
        notes: `Units per case corrected ${product.unitsPerCase ?? 'unset'} -> ${unitsPerCase ?? 'unset'}`,
        idempotencyKey: randomUUID(),
      },
    })
    return updated
  })
}

// Corrects an existing invoice line item's sellUnit/unitsPerSellUnit and,
// if it has an ACTIVE reservation, adjusts that reservation's quantity to
// match the corrected vial count in the same transaction -- never leaves
// the reservation representing the pre-correction sell unit. Never
// rewrites unitPrice/name/total (the historical sale snapshot) -- purely a
// catalog-classification fix for the inventory-consumption side.
export async function correctInvoiceItemSellUnit(
  invoiceItemId: string,
  input: { sellUnit: 'CASE_STANDARD' | 'CASE_SPA' | 'CASE_BULK' | 'INDIVIDUAL_VIAL'; unitsPerSellUnit: number; inventoryQuantityConsumed: number },
  actor: string,
  reason: string
) {
  if (!reason.trim()) throw new Error('A reason is required to correct a sell unit')

  return prisma.$transaction(async (tx) => {
    const item = await tx.invoiceItem.findUniqueOrThrow({ where: { id: invoiceItemId } })
    await tx.invoiceItem.update({
      where: { id: invoiceItemId },
      data: { sellUnit: input.sellUnit, unitsPerSellUnit: input.unitsPerSellUnit, inventoryQuantityConsumed: input.inventoryQuantityConsumed },
    })

    const existing = await tx.inventoryReservation.findFirst({ where: { invoiceItemId, status: 'ACTIVE' } })
    if (existing) {
      await adjustReservationQuantityTx(tx, existing.id, input.inventoryQuantityConsumed, actor, reason)
    } else if (item.productId) {
      await tx.inventoryLedgerEntry.create({
        data: {
          productId: item.productId,
          quantityDelta: 0,
          previousBalance: 0,
          resultingBalance: 0,
          eventType: 'RECONCILIATION',
          invoiceId: item.invoiceId,
          invoiceItemId,
          actor,
          actorType: 'ADMIN',
          reason,
          notes: `Sell unit corrected to ${input.sellUnit} (${input.inventoryQuantityConsumed} vial(s)) -- no active reservation to adjust`,
          idempotencyKey: randomUUID(),
        },
      })
    }

    return tx.invoiceItem.findUniqueOrThrow({ where: { id: invoiceItemId } })
  })
}

// ─── Reconcile Inventory ──────────────────────────────────────────────────

// Recomputes Product.reservedUnits from the actual sum of its ACTIVE
// reservations and recomputes inventoryStatus/low-stock-alert state from
// that corrected number -- the "trust the ledger/reservation rows, fix the
// cache" repair action, distinct from Set Exact Physical Count (which
// corrects physicalStockOnHand itself against a real-world count).
// Logs a RECONCILIATION ledger event only when the cache was actually
// wrong; a clean reconciliation with nothing to fix creates no event.
export async function reconcileInventory(productId: string, actor: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    const activeReservations = await tx.inventoryReservation.findMany({ where: { productId, status: 'ACTIVE' } })
    const trueReserved = activeReservations.reduce((sum, r) => sum + r.quantity, 0)

    if (trueReserved === product.reservedUnits) {
      return { product, corrected: false, previousReservedUnits: product.reservedUnits, correctedReservedUnits: trueReserved }
    }

    const newStatus = computeInventoryStatus({
      inventoryTrackingEnabled: product.inventoryTrackingEnabled,
      physicalStockOnHand: product.physicalStockOnHand,
      reservedUnits: trueReserved,
      lowStockThreshold: product.lowStockThreshold,
    })
    const updated = await tx.product.update({ where: { id: productId }, data: { reservedUnits: trueReserved, inventoryStatus: newStatus } })
    await tx.inventoryLedgerEntry.create({
      data: {
        productId,
        skuSnapshot: product.sku,
        quantityDelta: 0,
        previousBalance: product.physicalStockOnHand ?? 0,
        resultingBalance: product.physicalStockOnHand ?? 0,
        eventType: 'RECONCILIATION',
        actor,
        actorType: 'ADMIN',
        reason: reason ?? 'Reconcile Inventory: reservedUnits cache did not match the sum of active reservations',
        notes: `reservedUnits corrected ${product.reservedUnits} -> ${trueReserved}`,
        idempotencyKey: randomUUID(),
      },
    })
    await refreshLowStockAlert(productId, actor, tx)
    return { product: updated, corrected: true, previousReservedUnits: product.reservedUnits, correctedReservedUnits: trueReserved }
  })
}

// Re-export for convenience so the admin correction API has one import
// surface for "Set Exact Physical Count" alongside every other correction
// action, even though the underlying implementation already lived in
// lib/inventory/actions.ts.
export { setExactCount as setExactPhysicalCount }

export interface ReservationSearchFilter {
  invoiceId?: string
  invoiceItemId?: string
  productId?: string
  status?: 'ACTIVE' | 'RELEASED' | 'FULFILLED'
}

// Admin-facing lookup: inspect reservations by invoice/invoice line/
// product/status, each joined with enough invoice/customer context to be
// useful without a second round trip.
export async function findReservations(filter: ReservationSearchFilter) {
  return prisma.inventoryReservation.findMany({
    where: {
      invoiceId: filter.invoiceId,
      invoiceItemId: filter.invoiceItemId,
      productId: filter.productId,
      status: filter.status,
    },
    include: {
      product: { select: { id: true, name: true, size: true, sku: true } },
      invoice: { select: { id: true, invoiceNumber: true, customerName: true, customerId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}
