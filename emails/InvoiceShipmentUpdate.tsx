// Shipment-update email for the invoice tracking system — same branding as
// emails/TrackingUpdate.tsx (the Order-flow equivalent), generalized to cover
// every notification-triggering ShippingStatus rather than just "shipped".
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import type { ShippingStatus, ShippingCarrier } from '@prisma/client'
import { ORDERS_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { isTrackableCarrier } from '@/lib/tracking/types'
import { formatCarrierLabel } from '@/lib/invoice/format'

interface InvoiceShipmentUpdateProps {
  customerName: string
  invoiceNumber: string
  status: ShippingStatus
  carrier: ShippingCarrier
  trackingNumber: string
  trackingUrl: string
  latestMessage: string
  estimatedDeliveryAt?: Date | null
  deliveredAt?: Date | null
}

const STATUS_COPY: Partial<Record<ShippingStatus, { subject: string; headline: string }>> = {
  TRACKING_ADDED: { subject: 'Your Order Has Shipped', headline: 'Your Order Has Shipped' },
  ACCEPTED_BY_CARRIER: { subject: 'Your Order Has Shipped', headline: 'Your Order Has Shipped' },
  IN_TRANSIT: { subject: 'Shipping Update', headline: 'Your Package Is On Its Way' },
  DELAYED: { subject: 'Delivery Delay Notice', headline: 'Your Delivery Has Been Delayed' },
  DELIVERY_EXCEPTION: { subject: 'Shipping Update', headline: 'There’s an Update on Your Delivery' },
  OUT_FOR_DELIVERY: { subject: 'Your Package Is Out for Delivery', headline: 'Out for Delivery Today' },
  DELIVERED: { subject: 'Your Package Has Been Delivered', headline: 'Your Package Has Been Delivered' },
  RETURNED_TO_SENDER: { subject: 'Shipping Update', headline: 'Your Package Was Returned to Sender' },
}

export function shipmentUpdateSubject(status: ShippingStatus, invoiceNumber: string): string {
  const copy = STATUS_COPY[status]
  return `${copy?.subject ?? 'Shipping Update'} — Invoice #${invoiceNumber}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function buildInvoiceShipmentUpdateHtml(props: InvoiceShipmentUpdateProps): string {
  const { customerName, invoiceNumber, status, carrier, trackingNumber, trackingUrl, latestMessage, estimatedDeliveryAt, deliveredAt } = props
  const copy = STATUS_COPY[status] ?? { headline: 'Shipping Update' }
  // 2026-08-19 self-delivery parity fix -- a non-trackable carrier
  // (HAND_DELIVERY/PICKUP/COURIER/OTHER) never has a real tracking URL to
  // send a customer to; the old unconditional "Track Your Package" CTA
  // resolved to a plain Google search for these, which is not a broken
  // link but is nonsensical and unprofessional. Carrier label is now
  // always the customer-facing string (formatCarrierLabel), never the
  // raw enum value.
  const trackable = isTrackableCarrier(carrier)
  const carrierLabel = formatCarrierLabel(carrier)

  const trackingPanel = emailPanel(`
    <p style="margin:0 0 8px;font-size:11px;color:${EMAIL_COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em">${trackable ? 'Tracking Information' : 'Delivery Information'}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>${trackable ? 'Carrier' : 'Delivery Method'}:</strong> ${escapeHtml(carrierLabel)}</p>
    ${trackable ? `<p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Tracking #:</strong> <a href="${trackingUrl}" style="color:${EMAIL_COLORS.gold}">${escapeHtml(trackingNumber)}</a></p>` : ''}
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Latest update:</strong> ${escapeHtml(latestMessage)}</p>
    ${deliveredAt ? `<p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Delivered:</strong> ${formatDate(deliveredAt)}</p>` : ''}
    ${!deliveredAt && !trackable ? `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}">We'll follow up once your order is on its way.</p>` : ''}
    ${!deliveredAt && trackable && estimatedDeliveryAt ? `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Estimated delivery:</strong> ${formatDate(estimatedDeliveryAt)}</p>` : ''}
  `)

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">${copy.headline}</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6">
      Hi ${escapeHtml(customerName)}, here's the latest on invoice <strong>${escapeHtml(invoiceNumber)}</strong>.
    </p>
    ${trackingPanel}
    ${trackable ? emailCta(trackingUrl, 'Track Your Package') : ''}
  `

  return buildEmailShell({
    eyebrow: 'Shipment Update',
    bodyHtml,
    footerNote: `Your updated invoice is attached to this email. Questions? Reply to this email or contact ${ORDERS_EMAIL}.`,
  })
}
