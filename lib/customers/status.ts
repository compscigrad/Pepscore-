// Pure customer-status computation — mirrors lib/tracking/orderStatus.ts's
// computeOrderStatus() shape so both are recomputed the same way, at the
// same mutation touchpoints, rather than derived at read time. Called from
// lib/customers.ts after any change to a customer's most recent invoice.
import type { InvoiceStatus, ShippingStatus, CustomerStatus } from '@prisma/client'

export interface CustomerStatusInput {
  hasIntakeLinkSent: boolean
  hasIntakeSubmitted: boolean
  // The customer's most recent (non-cancelled/refunded/void) invoice, or
  // null if they don't have one yet (pre-intake-submission).
  latestInvoice: {
    status: InvoiceStatus
    shippingStatus: ShippingStatus
    archivedAt: Date | null
  } | null
  currentStatus: CustomerStatus
}

export function computeCustomerStatus(input: CustomerStatusInput): CustomerStatus {
  const { hasIntakeLinkSent, hasIntakeSubmitted, latestInvoice, currentStatus } = input

  // Never move a customer out of ARCHIVED automatically — that's an
  // explicit admin action, same "no silent downgrade" principle as
  // computeOrderStatus never leaving COMPLETED on its own.
  if (currentStatus === 'ARCHIVED') return 'ARCHIVED'

  if (!latestInvoice) {
    if (hasIntakeSubmitted) return 'INTAKE_COMPLETED'
    if (hasIntakeLinkSent) return 'INTAKE_SENT'
    return 'LEAD'
  }

  if (latestInvoice.archivedAt) return 'ARCHIVED'

  const { status, shippingStatus } = latestInvoice

  // Terminal invoice states the enum has no direct equivalent for — hold at
  // whatever the customer's status already was rather than guessing.
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'VOID') {
    return currentStatus
  }

  if (status === 'DRAFT' || status === 'PENDING' || status === 'APPROVED') {
    return 'AWAITING_FULFILLMENT'
  }

  if (status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID'

  // ISSUED: sent to the customer, nothing paid yet — "awaiting payment" is
  // the meaningful steady state (no time-based recompute exists to
  // distinguish a freshly-issued invoice from one that's been sitting).
  if (status === 'ISSUED') return 'AWAITING_PAYMENT'

  // status === 'PAID' — where they are next depends on shipping progress.
  if (shippingStatus === 'DELIVERED') return 'DELIVERED'
  if (
    shippingStatus === 'IN_TRANSIT' ||
    shippingStatus === 'OUT_FOR_DELIVERY' ||
    shippingStatus === 'DELAYED' ||
    shippingStatus === 'DELIVERY_EXCEPTION' ||
    shippingStatus === 'AVAILABLE_FOR_PICKUP' ||
    shippingStatus === 'DELIVERY_ATTEMPTED' ||
    shippingStatus === 'RETURNED_TO_SENDER' ||
    shippingStatus === 'LOST'
  ) {
    return 'SHIPPED'
  }
  if (
    shippingStatus === 'TRACKING_ADDED' ||
    shippingStatus === 'LABEL_CREATED' ||
    shippingStatus === 'CARRIER_AWAITING_PACKAGE' ||
    shippingStatus === 'ACCEPTED_BY_CARRIER'
  ) {
    return 'PREPARING_SHIPMENT'
  }
  return 'PAID'
}
