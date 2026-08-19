import { describe, it, expect } from 'vitest'
import { deriveFulfillmentBucket, type FulfillmentBucketInput } from './commandCenter'

const NOW = new Date('2026-08-13T12:00:00.000Z').getTime()
const THRESHOLDS = { labelNeededHours: 24, awaitingScanHours: 24, stalledInTransitHours: 72 }

const base: FulfillmentBucketInput = {
  balanceDue: 0,
  invoiceStatus: 'PAID',
  paidAt: new Date(NOW - 1 * 60 * 60 * 1000), // 1h ago
  hasActivePaymentArrangement: false,
  hasActiveBackorder: false,
  legacyCarrier: null,
  legacyDeliveryStatus: 'PREPARING',
  shipment: null,
  thresholds: THRESHOLDS,
  now: NOW,
}

function hoursAgo(h: number): Date {
  return new Date(NOW - h * 60 * 60 * 1000)
}

describe('deriveFulfillmentBucket', () => {
  it('excludes an invoice that is not paid enough', () => {
    expect(deriveFulfillmentBucket({ ...base, balanceDue: 50 })).toBe('NOT_APPLICABLE')
  })

  it('treats an active payment arrangement as paid enough', () => {
    expect(deriveFulfillmentBucket({ ...base, balanceDue: 50, hasActivePaymentArrangement: true })).toBe('NEEDS_FULFILLMENT')
  })

  it('excludes a cancelled/void/refunded invoice with no shipment', () => {
    expect(deriveFulfillmentBucket({ ...base, invoiceStatus: 'CANCELLED' })).toBe('NOT_APPLICABLE')
    expect(deriveFulfillmentBucket({ ...base, invoiceStatus: 'VOID' })).toBe('NOT_APPLICABLE')
    expect(deriveFulfillmentBucket({ ...base, invoiceStatus: 'REFUNDED' })).toBe('NOT_APPLICABLE')
  })

  it('paid, no shipment, fresh -> NEEDS_FULFILLMENT', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(2) })).toBe('NEEDS_FULFILLMENT')
  })

  it('paid, no shipment, past the label-needed threshold -> LABEL_NEEDED', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(25) })).toBe('LABEL_NEEDED')
  })

  it('paid, no shipment, exactly at the threshold -> LABEL_NEEDED (inclusive)', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(24) })).toBe('LABEL_NEEDED')
  })

  it('label created, no carrier scan yet, within grace -> AWAITING_CARRIER_SCAN', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'LABEL_CREATED', phaseStartedAt: hoursAgo(2), monitoringActive: true, voidedAt: null },
      })
    ).toBe('AWAITING_CARRIER_SCAN')
  })

  it('label created, no carrier scan, past grace -> STALLED', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'LABEL_CREATED', phaseStartedAt: hoursAgo(30), monitoringActive: true, voidedAt: null },
      })
    ).toBe('STALLED')
  })

  it('accepted by carrier, recent movement -> IN_TRANSIT', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'IN_TRANSIT', phaseStartedAt: hoursAgo(5), monitoringActive: true, voidedAt: null },
      })
    ).toBe('IN_TRANSIT')
  })

  it('in transit, no movement past the stalled threshold -> STALLED', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'IN_TRANSIT', phaseStartedAt: hoursAgo(80), monitoringActive: true, voidedAt: null },
      })
    ).toBe('STALLED')
  })

  it('carrier exception status -> EXCEPTION regardless of age', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'DELIVERY_EXCEPTION', phaseStartedAt: hoursAgo(1), monitoringActive: true, voidedAt: null },
      })
    ).toBe('EXCEPTION')
  })

  it('delivered shipment -> DELIVERED', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'DELIVERED', phaseStartedAt: hoursAgo(10), monitoringActive: true, voidedAt: null },
      })
    ).toBe('DELIVERED')
  })

  it('cancelled shipment status -> NOT_APPLICABLE', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        shipment: { normalizedStatus: 'CANCELLED', phaseStartedAt: hoursAgo(10), monitoringActive: true, voidedAt: null },
      })
    ).toBe('NOT_APPLICABLE')
  })

  it('a shipment on a since-refunded invoice is always EXCEPTION, even mid-transit', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        invoiceStatus: 'REFUNDED',
        shipment: { normalizedStatus: 'IN_TRANSIT', phaseStartedAt: hoursAgo(1), monitoringActive: true, voidedAt: null },
      })
    ).toBe('EXCEPTION')
  })

  it('a shipment on a since-cancelled invoice that is no longer monitored is NOT_APPLICABLE, not a silent exception', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        invoiceStatus: 'CANCELLED',
        shipment: { normalizedStatus: 'IN_TRANSIT', phaseStartedAt: hoursAgo(1), monitoringActive: false, voidedAt: new Date() },
      })
    ).toBe('NOT_APPLICABLE')
  })

  it('an active backorder never changes the bucket by itself -- it is a separate flag, not a competing status', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(2), hasActiveBackorder: true })).toBe('NEEDS_FULFILLMENT')
  })

  it('unknown/unmapped shipment status is surfaced as EXCEPTION rather than silently misbucketed', () => {
    expect(
      deriveFulfillmentBucket({
        ...base,
        // @ts-expect-error -- deliberately an out-of-enum value to prove the fallback branch
        shipment: { normalizedStatus: 'SOME_FUTURE_STATUS', phaseStartedAt: hoursAgo(1), monitoringActive: true, voidedAt: null },
      })
    ).toBe('EXCEPTION')
  })

  // 2026-08-19 self-delivery parity fix: a HAND_DELIVERY/PICKUP/COURIER/OTHER
  // invoice with no real Shipment row (the legacy carrier-field path) was
  // previously indistinguishable from "genuinely needs a label" -- it fell
  // into NEEDS_FULFILLMENT/LABEL_NEEDED forever, regardless of age.
  it('a fresh self-delivery invoice (no shipment, non-trackable carrier) -> SELF_DELIVERY, not NEEDS_FULFILLMENT', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(2), legacyCarrier: 'HAND_DELIVERY' })).toBe('SELF_DELIVERY')
  })

  it('a self-delivery invoice never escalates to LABEL_NEEDED no matter how old', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(500), legacyCarrier: 'HAND_DELIVERY' })).toBe('SELF_DELIVERY')
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(500), legacyCarrier: 'PICKUP' })).toBe('SELF_DELIVERY')
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(500), legacyCarrier: 'COURIER' })).toBe('SELF_DELIVERY')
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(500), legacyCarrier: 'OTHER' })).toBe('SELF_DELIVERY')
  })

  it('a self-delivery invoice explicitly marked DELIVERED -> DELIVERED, not SELF_DELIVERY', () => {
    expect(
      deriveFulfillmentBucket({ ...base, legacyCarrier: 'HAND_DELIVERY', legacyDeliveryStatus: 'DELIVERED' })
    ).toBe('DELIVERED')
  })

  it('a trackable carrier set on the legacy field with no shipment yet still uses the normal NEEDS_FULFILLMENT/LABEL_NEEDED path', () => {
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(2), legacyCarrier: 'USPS' })).toBe('NEEDS_FULFILLMENT')
    expect(deriveFulfillmentBucket({ ...base, paidAt: hoursAgo(25), legacyCarrier: 'USPS' })).toBe('LABEL_NEEDED')
  })

  it('a real Shipment row always takes priority over the legacy carrier field, even if that carrier is non-trackable', () => {
    // Once a real Shipment exists (e.g. manually added tracking for a
    // HAND_DELIVERY carrier), the genuine shipment status drives the
    // bucket -- the legacy-field short-circuit only applies when there is
    // no Shipment row at all.
    expect(
      deriveFulfillmentBucket({
        ...base,
        legacyCarrier: 'HAND_DELIVERY',
        shipment: { normalizedStatus: 'DELIVERED', phaseStartedAt: hoursAgo(1), monitoringActive: true, voidedAt: null },
      })
    ).toBe('DELIVERED')
  })
})
