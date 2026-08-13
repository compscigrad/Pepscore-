import { describe, it, expect } from 'vitest'
import { computeInvoiceDeletionEligibility, type InvoiceDeletionFlags } from './deletionEligibility'

const clean: InvoiceDeletionFlags = {
  isInTrash: true,
  hasOrder: false,
  paymentCount: 0,
  refundCount: 0,
  shipmentCount: 0,
  inventoryMovementCount: 0,
  promotionRedemptionCount: 0,
  financeRecordCount: 0,
}

describe('computeInvoiceDeletionEligibility', () => {
  it('a clean trashed test invoice is fully eligible', () => {
    expect(computeInvoiceDeletionEligibility(clean)).toEqual([])
  })

  it('blocks an invoice not yet moved to trash', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, isInTrash: false })).toEqual(['NOT_IN_TRASH'])
  })

  it('blocks a paid invoice (has payments)', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, paymentCount: 1 })).toEqual(['HAS_PAYMENTS'])
  })

  it('blocks an invoice with a shipment on record', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, shipmentCount: 1 })).toEqual(['HAS_SHIPMENTS'])
  })

  it('blocks an invoice linked to a storefront order', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, hasOrder: true })).toEqual(['LINKED_TO_STOREFRONT_ORDER'])
  })

  it('blocks an invoice with refund history', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, refundCount: 1 })).toEqual(['HAS_REFUNDS'])
  })

  it('blocks an invoice with inventory movement', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, inventoryMovementCount: 1 })).toEqual(['HAS_INVENTORY_MOVEMENT'])
  })

  it('blocks an invoice with a redeemed promotion code', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, promotionRedemptionCount: 1 })).toEqual(['HAS_PROMOTION_REDEMPTION'])
  })

  it('blocks an invoice with linked Finance/expense records', () => {
    expect(computeInvoiceDeletionEligibility({ ...clean, financeRecordCount: 1 })).toEqual(['HAS_FINANCE_RECORDS'])
  })

  it('reports every applicable reason at once for a heavily-linked invoice (bulk-delete mixed-eligibility case)', () => {
    const reasons = computeInvoiceDeletionEligibility({
      isInTrash: true,
      hasOrder: true,
      paymentCount: 2,
      refundCount: 1,
      shipmentCount: 1,
      inventoryMovementCount: 3,
      promotionRedemptionCount: 0,
      financeRecordCount: 1,
    })
    expect(reasons).toEqual(['HAS_PAYMENTS', 'HAS_REFUNDS', 'LINKED_TO_STOREFRONT_ORDER', 'HAS_SHIPMENTS', 'HAS_INVENTORY_MOVEMENT', 'HAS_FINANCE_RECORDS'])
  })
})
