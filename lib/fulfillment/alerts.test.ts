import { describe, it, expect } from 'vitest'
import { alertTypeForBucket, alertMessage } from './alerts'
import type { FulfillmentQueueRow } from './commandCenter'

function row(overrides: Partial<FulfillmentQueueRow> = {}): FulfillmentQueueRow {
  return {
    invoiceId: 'inv1',
    invoiceNumber: 'PS-26-1',
    customerName: 'Jane Doe',
    customerId: null,
    invoiceStatus: 'ISSUED',
    paidAt: null,
    balanceDue: 0,
    total: 100,
    itemCount: 1,
    bucket: 'LABEL_NEEDED',
    hasActiveBackorder: false,
    shipment: null,
    ageHours: null,
    ...overrides,
  }
}

describe('alertTypeForBucket', () => {
  it('maps LABEL_NEEDED to NO_LABEL', () => {
    expect(alertTypeForBucket(row({ bucket: 'LABEL_NEEDED' }))).toBe('NO_LABEL')
  })

  it('maps AWAITING_CARRIER_SCAN to itself', () => {
    expect(alertTypeForBucket(row({ bucket: 'AWAITING_CARRIER_SCAN' }))).toBe('AWAITING_CARRIER_SCAN')
  })

  it('maps STALLED to STALLED_NO_MOVEMENT', () => {
    expect(alertTypeForBucket(row({ bucket: 'STALLED' }))).toBe('STALLED_NO_MOVEMENT')
  })

  it('maps EXCEPTION on an active invoice to CARRIER_EXCEPTION', () => {
    expect(alertTypeForBucket(row({ bucket: 'EXCEPTION', invoiceStatus: 'ISSUED' }))).toBe('CARRIER_EXCEPTION')
  })

  it.each(['CANCELLED', 'VOID', 'REFUNDED'] as const)(
    'maps EXCEPTION on a %s invoice to REFUNDED_AFTER_SHIPMENT, not a generic carrier exception',
    (status) => {
      expect(alertTypeForBucket(row({ bucket: 'EXCEPTION', invoiceStatus: status }))).toBe('REFUNDED_AFTER_SHIPMENT')
    }
  )

  it('returns null for healthy buckets (no alert should ever open)', () => {
    expect(alertTypeForBucket(row({ bucket: 'NEEDS_FULFILLMENT' }))).toBeNull()
    expect(alertTypeForBucket(row({ bucket: 'IN_TRANSIT' }))).toBeNull()
    expect(alertTypeForBucket(row({ bucket: 'DELIVERED' }))).toBeNull()
  })
})

describe('alertMessage', () => {
  it('includes the invoice number and customer name', () => {
    const msg = alertMessage(row({ invoiceNumber: 'PS-26-42', customerName: 'John Smith' }), 'NO_LABEL')
    expect(msg).toContain('PS-26-42')
    expect(msg).toContain('John Smith')
  })

  it('STALLED_NO_MOVEMENT includes rounded age in hours when present', () => {
    const msg = alertMessage(row({ ageHours: 36.7 }), 'STALLED_NO_MOVEMENT')
    expect(msg).toContain('37h')
  })

  it('STALLED_NO_MOVEMENT omits the hour count when ageHours is null', () => {
    const msg = alertMessage(row({ ageHours: null }), 'STALLED_NO_MOVEMENT')
    expect(msg).not.toContain('h.')
  })

  it('CARRIER_EXCEPTION falls back to "unknown status" when no shipment status is present', () => {
    const msg = alertMessage(row({ shipment: null }), 'CARRIER_EXCEPTION')
    expect(msg).toContain('unknown status')
  })
})
