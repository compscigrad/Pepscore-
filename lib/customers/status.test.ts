import { describe, it, expect } from 'vitest'
import { computeCustomerStatus } from './status'

const base = {
  hasIntakeLinkSent: false,
  hasIntakeSubmitted: false,
  hasActivePaymentArrangement: false,
  latestInvoice: null,
  currentStatus: 'LEAD' as const,
}

function invoice(overrides: Partial<NonNullable<Parameters<typeof computeCustomerStatus>[0]['latestInvoice']>>) {
  return {
    status: 'ISSUED' as const,
    shippingStatus: 'NOT_SHIPPED' as const,
    archivedAt: null,
    fulfillmentOverrideAt: null,
    ...overrides,
  }
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
      expect(computeCustomerStatus({ ...base, latestInvoice: invoice({ status }) })).toBe('AWAITING_FULFILLMENT')
    }
  })

  it('maps ISSUED with no arrangement to AWAITING_PAYMENT', () => {
    expect(computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'ISSUED' }) })).toBe('AWAITING_PAYMENT')
  })

  it('maps PARTIALLY_PAID with no arrangement directly', () => {
    expect(computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'PARTIALLY_PAID' }) })).toBe(
      'PARTIALLY_PAID'
    )
  })

  it('PAYMENT_ARRANGEMENT takes priority over AWAITING_PAYMENT when an active arrangement exists', () => {
    expect(
      computeCustomerStatus({
        ...base,
        hasActivePaymentArrangement: true,
        latestInvoice: invoice({ status: 'ISSUED' }),
      })
    ).toBe('PAYMENT_ARRANGEMENT')
  })

  it('PAYMENT_ARRANGEMENT takes priority over PARTIALLY_PAID when an active arrangement exists', () => {
    expect(
      computeCustomerStatus({
        ...base,
        hasActivePaymentArrangement: true,
        latestInvoice: invoice({ status: 'PARTIALLY_PAID' }),
      })
    ).toBe('PAYMENT_ARRANGEMENT')
  })

  it('maps PAID + NOT_SHIPPED to ELIGIBLE_FOR_FULFILLMENT', () => {
    expect(computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'PAID' }) })).toBe(
      'ELIGIBLE_FOR_FULFILLMENT'
    )
  })

  it('a manual fulfillment override makes an unpaid invoice ELIGIBLE_FOR_FULFILLMENT too', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: invoice({ status: 'ISSUED', fulfillmentOverrideAt: new Date() }),
      })
    ).toBe('ELIGIBLE_FOR_FULFILLMENT')
  })

  it('maps PAID + LABEL_CREATED to LABEL_CREATED specifically, not PREPARING_SHIPMENT', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: invoice({ status: 'PAID', shippingStatus: 'LABEL_CREATED' }),
      })
    ).toBe('LABEL_CREATED')
  })

  it('maps PAID + other label/tracking-created statuses to PREPARING_SHIPMENT', () => {
    for (const shippingStatus of ['TRACKING_ADDED', 'CARRIER_AWAITING_PACKAGE', 'ACCEPTED_BY_CARRIER'] as const) {
      expect(computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'PAID', shippingStatus }) })).toBe(
        'PREPARING_SHIPMENT'
      )
    }
  })

  it('maps PAID + IN_TRANSIT to SHIPPED', () => {
    expect(
      computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'PAID', shippingStatus: 'IN_TRANSIT' }) })
    ).toBe('SHIPPED')
  })

  it('maps PAID + DELIVERED to DELIVERED', () => {
    expect(
      computeCustomerStatus({ ...base, latestInvoice: invoice({ status: 'PAID', shippingStatus: 'DELIVERED' }) })
    ).toBe('DELIVERED')
  })

  it('shipping progress wins even under an active payment arrangement (not fully paid yet)', () => {
    expect(
      computeCustomerStatus({
        ...base,
        hasActivePaymentArrangement: true,
        latestInvoice: invoice({ status: 'PARTIALLY_PAID', shippingStatus: 'IN_TRANSIT' }),
      })
    ).toBe('SHIPPED')
  })

  it('maps an archived invoice to ARCHIVED', () => {
    expect(
      computeCustomerStatus({
        ...base,
        latestInvoice: invoice({ status: 'PAID', shippingStatus: 'DELIVERED', archivedAt: new Date() }),
      })
    ).toBe('ARCHIVED')
  })

  it('holds the current status for CANCELLED/REFUNDED/VOID invoices', () => {
    expect(
      computeCustomerStatus({
        ...base,
        currentStatus: 'AWAITING_PAYMENT',
        latestInvoice: invoice({ status: 'CANCELLED' }),
      })
    ).toBe('AWAITING_PAYMENT')
  })

  it('never leaves ARCHIVED automatically', () => {
    expect(
      computeCustomerStatus({
        ...base,
        currentStatus: 'ARCHIVED',
        latestInvoice: invoice({ status: 'PAID', shippingStatus: 'DELIVERED' }),
      })
    ).toBe('ARCHIVED')
  })
})
