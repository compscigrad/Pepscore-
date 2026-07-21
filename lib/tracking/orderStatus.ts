// The 4th status dimension's completion rule, kept as a pure function so both
// the payment side (lib/invoices.ts) and the shipping side (lib/tracking/
// service.ts) can recompute it after whichever one just changed, without
// either module depending on the other.
import type { InvoiceStatus, ShippingStatus, InvoiceOrderStatus } from '@prisma/client'

export function computeOrderStatus(
  paymentStatus: InvoiceStatus,
  shippingStatus: ShippingStatus,
  currentOrderStatus: InvoiceOrderStatus
): InvoiceOrderStatus {
  if (paymentStatus === 'CANCELLED' || paymentStatus === 'VOID') return 'CANCELLED'
  if (shippingStatus === 'CANCELLED') return 'CANCELLED'

  // Spec's explicit rule: paid + delivered => completed. A delivered
  // shipment on an unpaid/partially-paid invoice deliberately does NOT
  // complete the order — existing business rules don't say otherwise.
  if (paymentStatus === 'PAID' && shippingStatus === 'DELIVERED') return 'COMPLETED'

  // Never downgrade a manually-completed order just because something else
  // ticks afterward (e.g. a late tracking event arrives) — only an explicit
  // cancellation above should move it off COMPLETED.
  if (currentOrderStatus === 'COMPLETED') return 'COMPLETED'

  if (shippingStatus !== 'NOT_SHIPPED' || paymentStatus === 'PARTIALLY_PAID' || paymentStatus === 'PAID') {
    return 'IN_PROGRESS'
  }

  return 'OPEN'
}
