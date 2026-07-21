// Shipment-update email for the invoice tracking system — same branding as
// emails/TrackingUpdate.tsx (the Order-flow equivalent), generalized to cover
// every notification-triggering ShippingStatus rather than just "shipped".
import type { ShippingStatus } from '@prisma/client'

interface InvoiceShipmentUpdateProps {
  customerName: string
  invoiceNumber: string
  status: ShippingStatus
  carrier: string
  trackingNumber: string
  trackingUrl: string
  latestMessage: string
  estimatedDeliveryAt?: Date | null
  deliveredAt?: Date | null
}

const STATUS_COPY: Partial<Record<ShippingStatus, { subject: string; emoji: string; headline: string }>> = {
  TRACKING_ADDED: { subject: 'Your Order Has Shipped', emoji: '📦', headline: 'Your Order Has Shipped' },
  ACCEPTED_BY_CARRIER: { subject: 'Your Order Has Shipped', emoji: '📦', headline: 'Your Order Has Shipped' },
  IN_TRANSIT: { subject: 'Shipping Update', emoji: '🚚', headline: 'Your Package Is On Its Way' },
  DELAYED: { subject: 'Delivery Delay Notice', emoji: '⏱️', headline: 'Your Delivery Has Been Delayed' },
  DELIVERY_EXCEPTION: { subject: 'Shipping Update', emoji: '⚠️', headline: 'There’s an Update on Your Delivery' },
  OUT_FOR_DELIVERY: { subject: 'Your Package Is Out for Delivery', emoji: '🚛', headline: 'Out for Delivery Today' },
  DELIVERED: { subject: 'Your Package Has Been Delivered', emoji: '✅', headline: 'Your Package Has Been Delivered' },
  RETURNED_TO_SENDER: { subject: 'Shipping Update', emoji: '↩️', headline: 'Your Package Was Returned to Sender' },
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
  const copy = STATUS_COPY[status] ?? { emoji: '📦', headline: 'Shipping Update' }
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Shipment Update</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">${copy.emoji}</div>
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">${copy.headline}</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">
        Hi ${customerName}, here's the latest on invoice <strong>${invoiceNumber}</strong>.
      </p>
      <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:left">
        <p style="margin:0 0 8px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:0.1em;font-family:Helvetica,sans-serif">Tracking Information</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Carrier:</strong> ${carrier}</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Tracking #:</strong> <a href="${trackingUrl}" style="color:#C49A1A">${trackingNumber}</a></p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Latest update:</strong> ${latestMessage}</p>
        ${deliveredAt ? `<p style="margin:0 0 4px;font-size:15px"><strong>Delivered:</strong> ${formatDate(deliveredAt)}</p>` : ''}
        ${!deliveredAt && estimatedDeliveryAt ? `<p style="margin:0;font-size:15px"><strong>Estimated delivery:</strong> ${formatDate(estimatedDeliveryAt)}</p>` : ''}
      </div>
      <a href="${trackingUrl}" style="display:inline-block;background:#C49A1A;color:#fff;padding:14px 32px;border-radius:6px;font-family:Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">
        Track Your Package
      </a>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        Your updated invoice is attached to this email. Questions? Reply to this message or contact contact@pepscore.com.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · contact@pepscore.com</p>
    </div>
  </div>
</body>
</html>`
}
