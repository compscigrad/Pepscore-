// Orchestrates when reservations get created/adjusted/released as an
// invoice moves through its real lifecycle -- called from lib/invoices.ts
// (item saves) and lib/tracking/service.ts (shipment registration), always
// with the same `tx` those callers are already inside, so reservation sync
// is atomic with the invoice write it's reacting to.
//
// The trigger point: ISSUED is the first state where an invoice represents
// a real customer commitment in this codebase -- it's already the exact
// boundary lib/invoices.ts's own `isFirstIssuance`/`hasBeenIssued` track
// (the same boundary that gates the issuance guard and the "invoice
// issued" email), and INVOICE_STATUSES excludes DRAFT from ever being
// re-selected once issued. A DRAFT invoice, however many times it's
// saved, never reserves anything -- see syncInvoiceReservationsTx below,
// only ever called when hasBeenIssued is true.
import { Prisma, PrismaClient, type InvoiceItem } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reserveForInvoiceItemTx, adjustReservationQuantityTx, releaseReservationTx, fulfillReservationTx } from './reservations'

type Db = PrismaClient | Prisma.TransactionClient

export interface ReservationWarning {
  invoiceItemId: string
  productId: string
  productName: string
  requested: number
  reserved: number
  shortfall: number
}

// Called once per relevant line item after an invoice save that leaves the
// invoice in an issued (non-draft, non-cancelled/void) state. `items` is
// the invoice's current InvoiceItem rows post-save (real ids, real
// inventoryQuantityConsumed). A line item with no productId, no
// inventoryQuantityConsumed, or an untracked product simply never
// participates -- fully backward compatible with every free-typed line
// item and every product that hasn't turned on inventory tracking.
export async function syncInvoiceReservationsTx(
  tx: Db,
  invoiceId: string,
  items: Pick<InvoiceItem, 'id' | 'productId' | 'inventoryQuantityConsumed'>[],
  actor: string
): Promise<ReservationWarning[]> {
  const warnings: ReservationWarning[] = []

  for (const item of items) {
    if (!item.productId) continue
    const desired = item.inventoryQuantityConsumed ?? 0
    if (desired <= 0) continue

    const product = await tx.product.findUnique({ where: { id: item.productId } })
    if (!product || !product.inventoryTrackingEnabled) continue

    let existing = await tx.inventoryReservation.findFirst({ where: { invoiceItemId: item.id, status: 'ACTIVE' } })

    // A product or sell-unit change on this line item means any existing
    // reservation is against the WRONG product -- release it outright and
    // create a fresh one against the new product, rather than adjusting
    // its quantity in place (which would silently leave it pointed at the
    // old product while reporting the new desired quantity).
    if (existing && existing.productId !== item.productId) {
      await releaseReservationTx(tx, existing.id, actor, 'Product or sell unit changed on this line item')
      existing = null
    }

    const currentReserved = existing?.quantity ?? 0
    if (desired === currentReserved) continue // no-op -- no ledger event, matches "repeated save with no quantity change"

    let shortfall = 0
    if (!existing) {
      const result = await reserveForInvoiceItemTx(tx, { productId: item.productId, invoiceId, invoiceItemId: item.id, quantity: desired, actor })
      shortfall = result.shortfall
    } else {
      const result = await adjustReservationQuantityTx(tx, existing.id, desired, actor)
      shortfall = result.shortfall
    }

    if (shortfall > 0) {
      warnings.push({ invoiceItemId: item.id, productId: item.productId, productName: product.name, requested: desired, reserved: desired - shortfall, shortfall })
    }
  }

  return warnings
}

// Called when an issued invoice's line items are being replaced/removed
// entirely (an edit that deletes a row) -- releases whatever was reserved
// for it, since the line no longer exists. Never called for a merely
// quantity-changed row (that's adjustReservationQuantityTx's job, run from
// syncInvoiceReservationsTx above).
export async function releaseReservationsForDeletedItemsTx(tx: Db, invoiceItemIds: string[], actor: string): Promise<void> {
  if (invoiceItemIds.length === 0) return
  const reservations = await tx.inventoryReservation.findMany({ where: { invoiceItemId: { in: invoiceItemIds }, status: 'ACTIVE' } })
  for (const r of reservations) {
    await releaseReservationTx(tx, r.id, actor, 'Line item removed from invoice')
  }
}

// Cancellation/Void: release every still-ACTIVE reservation for the whole
// invoice. Never touches a FULFILLED reservation -- goods already shipped
// are not un-shipped by cancelling the invoice afterward; that's a
// separate return/refund decision, not this function's job. "Expiration"
// has no equivalent invoice-level status in this codebase today (grepped
// the schema -- no EXPIRED status, no expiresAt field on Invoice); this
// function is the one release primitive a future expiration mechanism
// would call, but nothing currently triggers it automatically.
export async function releaseAllReservationsForInvoiceTx(tx: Db, invoiceId: string, actor: string, reason: string): Promise<void> {
  const reservations = await tx.inventoryReservation.findMany({ where: { invoiceId, status: 'ACTIVE' } })
  for (const r of reservations) {
    await releaseReservationTx(tx, r.id, actor, reason)
  }
}

export async function releaseAllReservationsForInvoice(invoiceId: string, actor: string, reason: string): Promise<void> {
  await prisma.$transaction((tx) => releaseAllReservationsForInvoiceTx(tx, invoiceId, actor, reason))
}

// Fulfillment: called from lib/tracking/service.ts's
// registerShipmentForMonitoring, the single shared entry point for both
// the manual "Add Tracking" flow and the Shippo label-purchase flow --
// converts every still-ACTIVE reservation on the invoice into a physical
// deduction, exactly once. A second shipment on the same invoice (split
// package, replaced tracking number) finds nothing ACTIVE left and is a
// clean no-op, never a second deduction.
export async function fulfillAllReservationsForInvoiceTx(tx: Db, invoiceId: string, actor: string): Promise<void> {
  const reservations = await tx.inventoryReservation.findMany({ where: { invoiceId, status: 'ACTIVE' } })
  for (const r of reservations) {
    await fulfillReservationTx(tx, r.id, actor)
  }
}

export async function fulfillAllReservationsForInvoice(invoiceId: string, actor: string): Promise<void> {
  await prisma.$transaction((tx) => fulfillAllReservationsForInvoiceTx(tx, invoiceId, actor))
}
