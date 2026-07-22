import { describe, it, expect } from 'vitest'
import { computeCustomerStatus } from './status'

const base = {
  hasIntakeLinkSent: false,
  hasIntakeSubmitted: false,
  latestInvoice: null,
  currentStatus: 'LEAD' as const,
}

describe('computeCustomerStatus', () => {
  it('defaults to LEAD with no intake link and no invoice', () => {
    expect(computeCustomerStatus(base)).toBe('LEAD')
  })

  it('moves to INTAKE_SENT once a link has been sent', () => {
    expect(computeCustomerStatus({ ...base, hasIntakeLinkSent: true })).toBe('INTAKE_SENT')
  })

  it('moves to INTAKE_COMPLETED once submitted with no invoice yet', () => {
    expect(computeCustomerStatus({ ...base, hasIntakeLinkSent: true, hasIntakeSubmitted: true })).toBe(
      'INTAKE_COMPLETED'
    )
  })

  it('maps DRAFT/PENDING/APPROVED invoices to AWAITING_FULFILLMENT', () => {
    for (const status of ['DRAFT', 'PENDING', 'APPROVED'] as const) {
      expect(
        computeCustomerStatus({
          ...base,
          latestInvoice: { status, shippingStatus: 'NOT_SHIPPED', archivedAt: null },
        })
      ).toBe('AWAITING_FULFILLMENT')
    }
  })

  it('maps ISSUED to AWAITING_PAYMENT', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'ISSUED', shippingStatus: 'NOT_SHIPPED', archivedAt: null },
      })
    ).toBe('AWAITING_PAYMENT')
  })

  it('maps PARTIALLY_PAID directly', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PARTIALLY_PAID', shippingStatus: 'NOT_SHIPPED', archivedAt: null },
      })
    ).toBe('PARTIALLY_PAID')
  })

  it('maps PAID + NOT_SHIPPED to PAID', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PAID', shippingStatus: 'NOT_SHIPPED', archivedAt: null },
      })
    ).toBe('PAID')
  })

  it('maps PAID + label/tracking-created statuses to PREPARING_SHIPMENT', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PAID', shippingStatus: 'LABEL_CREATED', archivedAt: null },
      })
    ).toBe('PREPARING_SHIPMENT')
  })

  it('maps PAID + IN_TRANSIT to SHIPPED', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PAID', shippingStatus: 'IN_TRANSIT', archivedAt: null },
      })
    ).toBe('SHIPPED')
  })

  it('maps PAID + DELIVERED to DELIVERED', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PAID', shippingStatus: 'DELIVERED', archivedAt: null },
      })
    ).toBe('DELIVERED')
  })

  it('maps an archived invoice to ARCHIVED', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: { status: 'PAID', shippingStatus: 'DELIVERED', archivedAt: new Date() },
      })
    ).toBe('ARCHIVED')
  })

  it('holds the current status for CANCELLED/REFUNDED/VOID invoices', () => {
    expect(
      computeCustomerStatus({
        ...base,
        currentStatus: 'AWAITING_PAYMENT',
        latestInvoice: { status: 'CANCELLED', shippingStatus: 'NOT_SHIPPED', archivedAt: null },
      })
    ).toBe('AWAITING_PAYMENT')
  })

  it('never leaves ARCHIVED automatically', () => {
    expect(
      computeCustomerStatus({
        ...base,
        currentStatus: 'ARCHIVED',
        latestInvoice: { status: 'PAID', shippingStatus: 'DELIVERED', archivedAt: null },
      })
    ).toBe('ARCHIVED')
  })
})
