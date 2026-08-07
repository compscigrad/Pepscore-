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
  fulfillReservationTx,
  reverseFulfillmentTx,
} from './reservations'
import { setExactCount } from './actions'
import { calculateInvoiceTotals, type InvoiceLineItemInput, type InvoiceDiscountInput } from '@/lib/invoice/calculations'
import { deriveInvoicePaymentAmounts } from '@/lib/invoice/status'
import { getAvailableSellUnits } from '@/lib/pricing/sellUnits'
import type { InventoryReservation, InvoiceItemSellUnit } from '@prisma/client'

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
export interface CorrectSellUnitInput {
  sellUnit: InvoiceItemSellUnit
  unitsPerSellUnit: number
  // Explicit admin override to allow selecting INDIVIDUAL_VIAL for a
  // product whose individualSalesEnabled is false -- e.g. correcting a
  // historical line that really was sold that way, per the Tesamorelin
  // rule. Never enables public/customer-facing individual sales; only
  // affects what this one correction is allowed to record.
  individualSalesOverride?: boolean
  priceBehavior: 'INVENTORY_ONLY' | 'RECALCULATE_PRICING'
  // Required when priceBehavior is RECALCULATE_PRICING.
  newUnitPrice?: number
}

export interface CorrectSellUnitResult {
  item: Awaited<ReturnType<typeof prisma.invoiceItem.findUniqueOrThrow>>
  reservationOutcome: 'NONE' | 'ADJUSTED_ACTIVE' | 'RECONCILED_FULFILLED'
  shortfall: number
  priceChanged: boolean
}

// The one function behind the "Correct Sell Unit" admin action. Never
// touches unitPrice/total unless priceBehavior is explicitly
// RECALCULATE_PRICING (default across the UI is INVENTORY_ONLY) --
// correcting the inventory interpretation of a historical line must never
// silently change what the customer was actually charged. When pricing IS
// recalculated, reuses the exact same pure calculateInvoiceTotals/
// deriveInvoicePaymentAmounts functions lib/invoices.ts's updateInvoice
// uses, so the invoice's subtotal/discountTotal/total/balanceDue/
// paymentStatus stay internally consistent -- but deliberately does NOT
// go through updateInvoice() itself, so it never fires the real customer-
// facing "invoice revised" email as a side effect of a backend data
// correction; if the admin wants the customer notified, that's a separate,
// deliberate action through the existing invoice email tools.
export async function correctInvoiceItemSellUnit(invoiceItemId: string, input: CorrectSellUnitInput, actor: string, reason: string): Promise<CorrectSellUnitResult> {
  if (!reason.trim()) throw new Error('A reason is required to correct a sell unit')
  if (input.priceBehavior === 'RECALCULATE_PRICING' && input.newUnitPrice === undefined) {
    throw new Error('newUnitPrice is required when recalculating pricing')
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.invoiceItem.findUniqueOrThrow({ where: { id: invoiceItemId } })
    if (!item.productId) throw new Error('Cannot correct sell unit for a line item with no linked catalog product')
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } })

    if (input.sellUnit === 'INDIVIDUAL_VIAL' && !product.individualSalesEnabled && !input.individualSalesOverride) {
      throw new Error(`Individual vial sales are disabled for ${product.name} ${product.size} -- an explicit override is required to record a historical line at this sell unit`)
    }
    // Every other sell unit must actually be configured (an active price
    // must exist) -- never lets an admin record a line against a tier the
    // product doesn't have pricing for at all.
    if (input.sellUnit !== 'INDIVIDUAL_VIAL') {
      const available = getAvailableSellUnits(product)
      if (!available.some((o) => o.sellUnit === input.sellUnit)) {
        throw new Error(`${product.name} ${product.size} has no active price configured for ${input.sellUnit}`)
      }
    }

    const newInventoryQuantityConsumed = item.quantity * input.unitsPerSellUnit
    const before = {
      sellUnit: item.sellUnit,
      unitsPerSellUnit: item.unitsPerSellUnit,
      inventoryQuantityConsumed: item.inventoryQuantityConsumed,
      unitPrice: item.unitPrice,
      total: item.total,
    }

    // ─── Price behavior ───────────────────────────────────────────────
    const priceChanged = input.priceBehavior === 'RECALCULATE_PRICING'
    const newTotal = priceChanged ? round2(item.quantity * input.newUnitPrice! - item.lineDiscount) : item.total

    await tx.invoiceItem.update({
      where: { id: invoiceItemId },
      data: {
        sellUnit: input.sellUnit,
        unitsPerSellUnit: input.unitsPerSellUnit,
        inventoryQuantityConsumed: newInventoryQuantityConsumed,
        ...(priceChanged ? { unitPrice: input.newUnitPrice, total: newTotal } : {}),
      },
    })

    if (priceChanged) {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: item.invoiceId }, include: { items: true, discounts: true } })
      const recalculatedItems: InvoiceLineItemInput[] = invoice.items.map((i) =>
        i.id === invoiceItemId ? { quantity: i.quantity, unitPrice: input.newUnitPrice!, lineDiscount: i.lineDiscount } : { quantity: i.quantity, unitPrice: i.unitPrice, lineDiscount: i.lineDiscount }
      )
      const discountInputs: InvoiceDiscountInput[] = invoice.discounts.map((d) => ({ type: d.type, amount: d.amount }))
      const totals = calculateInvoiceTotals(recalculatedItems, discountInputs, invoice.shippingCost, invoice.amountPaid)
      const paymentAmounts = deriveInvoicePaymentAmounts(invoice.amountPaid, totals.total)
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          total: totals.total,
          balanceDue: paymentAmounts.balanceDue,
          paymentStatus: paymentAmounts.paymentStatus,
          overpaidAmount: paymentAmounts.overpaidAmount,
        },
      })
    }

    // ─── Reservation/fulfillment reconciliation ────────────────────────
    const existing = await tx.inventoryReservation.findFirst({ where: { invoiceItemId, status: { in: ['ACTIVE', 'FULFILLED'] } } })
    let reservationOutcome: CorrectSellUnitResult['reservationOutcome'] = 'NONE'
    let shortfall = 0

    if (!existing) {
      // Draft, or an issued line whose product isn't inventory-tracked --
      // nothing to reconcile, but still worth a product-side audit trail
      // entry so the correction is discoverable from the inventory ledger
      // too, not just the invoice's own activity log.
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
          notes: `Sell unit corrected to ${input.sellUnit} (${newInventoryQuantityConsumed} vial(s)) -- no reservation to adjust (draft or untracked product)`,
          idempotencyKey: randomUUID(),
        },
      })
    } else if (existing.status === 'ACTIVE') {
      const result = await adjustReservationQuantityTx(tx, existing.id, newInventoryQuantityConsumed, actor, `Sell unit correction: ${reason}`)
      reservationOutcome = 'ADJUSTED_ACTIVE'
      shortfall = result.shortfall
    } else {
      // FULFILLED: the physical deduction already happened under the OLD
      // vial count. Reverse it (restores the old quantity to physical
      // stock, reservation -> ACTIVE), adjust the reservation to the
      // corrected quantity (capped at real availability, exactly like any
      // other reservation change), then re-fulfill at the corrected
      // quantity. Three real, honest ledger events -- never a single
      // silent balance edit -- and the Shipment record itself is never
      // touched, so no shipment/fulfillment record is ever duplicated.
      await reverseFulfillmentTx(tx, existing.id, actor, `Sell unit correction (reconciling prior fulfillment): ${reason}`)
      const adjustResult = await adjustReservationQuantityTx(tx, existing.id, newInventoryQuantityConsumed, actor, `Sell unit correction: ${reason}`)
      shortfall = adjustResult.shortfall
      const refreshed = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: existing.id } })
      if (refreshed.status === 'ACTIVE') {
        await fulfillReservationTx(tx, existing.id, actor)
      }
      reservationOutcome = 'RECONCILED_FULFILLED'
    }

    await tx.invoiceActivityLog.create({
      data: {
        invoiceId: item.invoiceId,
        eventType: 'SELL_UNIT_CORRECTED',
        previousValue: JSON.stringify(before),
        newValue: JSON.stringify({
          sellUnit: input.sellUnit,
          unitsPerSellUnit: input.unitsPerSellUnit,
          inventoryQuantityConsumed: newInventoryQuantityConsumed,
          priceBehavior: input.priceBehavior,
          unitPrice: priceChanged ? input.newUnitPrice : item.unitPrice,
          total: priceChanged ? newTotal : item.total,
          reservationOutcome,
          shortfall,
        }),
        source: 'MANUAL',
        userId: actor,
      },
    })

    const updatedItem = await tx.invoiceItem.findUniqueOrThrow({ where: { id: invoiceItemId } })
    return { item: updatedItem, reservationOutcome, shortfall, priceChanged }
  })
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
