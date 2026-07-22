// Pure customer-status computation — mirrors lib/tracking/orderStatus.ts's
// computeOrderStatus() shape so both are recomputed the same way, at the
// same mutation touchpoints, rather than derived at read time. Called from
// lib/customers.ts after any change to a customer's most recent invoice.
import type { InvoiceStatus, ShippingStatus, CustomerStatus } from '@prisma/client'

export interface CustomerStatusInput {
  hasIntakeLinkSent: boolean
  hasIntakeSubmitted: boolean
  // Whether the customer's most recent invoice has an active payment
  // arrangement (a schedule with at least one installment still owed) — see
  // lib/paymentArrangements.ts's hasActivePaymentArrangement().
  hasActivePaymentArrangement: boolean
  // The customer's most recent (non-cancelled/refunded/void) invoice, or
  // null if they don't have one yet (pre-intake-submission).
  latestInvoice: {
    status: InvoiceStatus
    shippingStatus: ShippingStatus
    archivedAt: Date | null
    // See lib/fulfillment/gate.ts — set when an admin bypassed the normal
    // payment gate to allow shipping anyway.
    fulfillmentOverrideAt: Date | null
  } | null
  currentStatus: CustomerStatus
}

const SHIPPED_STATUSES: ShippingStatus[] = [
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELAYED',
  'DELIVERY_EXCEPTION',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERY_ATTEMPTED',
  'RETURNED_TO_SENDER',
  'LOST',
]

const PREPARING_STATUSES: ShippingStatus[] = ['TRACKING_ADDED', 'CARRIER_AWAITING_PACKAGE', 'ACCEPTED_BY_CARRIER']

export function computeCustomerStatus(input: CustomerStatusInput): CustomerStatus {
  const { hasIntakeLinkSent, hasIntakeSubmitted, hasActivePaymentArrangement, latestInvoice, currentStatus } = input

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

  const { status, shippingStatus, fulfillmentOverrideAt } = latestInvoice

  // Terminal invoice states the enum has no direct equivalent for — hold at
  // whatever the customer's status already was rather than guessing.
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'VOID') {
    return currentStatus
  }

  if (status === 'DRAFT' || status === 'PENDING' || status === 'APPROVED') {
    return 'AWAITING_FULFILLMENT'
  }

  // Once a shipment genuinely exists, shipping progress is always the most
  // useful signal — regardless of payment tier, matching how a shipment
  // created under an active arrangement or a manual override should read
  // the same way a fully-paid one does.
  if (shippingStatus !== 'NOT_SHIPPED') {
    if (shippingStatus === 'DELIVERED') return 'DELIVERED'
    if (SHIPPED_STATUSES.includes(shippingStatus)) return 'SHIPPED'
    if (shippingStatus === 'LABEL_CREATED') return 'LABEL_CREATED'
    if (PREPARING_STATUSES.includes(shippingStatus)) return 'PREPARING_SHIPMENT'
  }

  // No shipment yet — where they sit depends on whether the Fulfillment
  // Gate (lib/fulfillment/gate.ts) has actually passed.
  if (status === 'PAID' || fulfillmentOverrideAt) return 'ELIGIBLE_FOR_FULFILLMENT'
  if (hasActivePaymentArrangement) return 'PAYMENT_ARRANGEMENT'
  if (status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID'
  if (status === 'ISSUED') return 'AWAITING_PAYMENT'

  return currentStatus
}
