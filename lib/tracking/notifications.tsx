// Customer-facing shipment emails — deduped per (shipment, status) since an
// invoice can have multiple shipments (Decision 4), gated by the per-status
// settings toggle, and never fatal to the tracking update that triggered
// them (an email failure is recorded, not thrown).
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { getInvoice } from '@/lib/invoices'
import { getPrimaryShipment } from '@/lib/shipments/primary'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'
import { buildInvoiceShipmentUpdateHtml, shipmentUpdateSubject } from '@/emails/InvoiceShipmentUpdate'
import { getInvoiceSettings, isNotificationEnabled } from '@/lib/invoiceSettings'
import type { ShippingStatus, Shipment } from '@prisma/client'
import type { InvoiceWithRelations } from '@/lib/invoices'

// Only these statuses ever trigger a customer email — matches the spec's
// explicit trigger list exactly (tracking added, accepted, in transit,
// delayed, exception, out for delivery, delivered, returned).
const NOTIFICATION_STATUSES: ShippingStatus[] = [
  'TRACKING_ADDED',
  'ACCEPTED_BY_CARRIER',
  'IN_TRANSIT',
  'DELAYED',
  'DELIVERY_EXCEPTION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED_TO_SENDER',
]

export function isNotifiableStatus(status: ShippingStatus): boolean {
  return NOTIFICATION_STATUSES.includes(status)
}

interface NotifyParams {
  invoiceId: string
  shipmentId: string
  status: ShippingStatus
  latestMessage: string
}

// Returns true if an email was actually attempted (sent or failed) — false
// if it was skipped (not a notifiable status, no customer email on file,
// disabled in settings, or already sent for this exact shipment+status).
export async function sendShipmentNotificationIfNeeded({
  invoiceId,
  shipmentId,
  status,
  latestMessage,
}: NotifyParams): Promise<boolean> {
  if (!isNotifiableStatus(status)) return false

  const [invoice, shipment] = await Promise.all([
    getInvoice(invoiceId),
    prisma.shipment.findUnique({ where: { id: shipmentId } }),
  ])
  if (!invoice || !invoice.customerEmail || !shipment) return false

  const settings = await getInvoiceSettings()
  if (!isNotificationEnabled(settings.trackingNotificationsEnabled, status)) return false

  // Dedup: never send the same status twice for the same shipment — a
  // second shipment on the same invoice reaching this status independently
  // still gets its own notification.
  const alreadySent = await prisma.shipmentNotification.findFirst({
    where: { shipmentId, notificationType: status, status: 'SENT' },
  })
  if (alreadySent) return false

  await sendShipmentEmail(invoice, shipment, status, latestMessage)
  return true
}

async function sendShipmentEmail(
  invoice: InvoiceWithRelations,
  shipment: Shipment,
  status: ShippingStatus,
  latestMessage: string
): Promise<void> {
  const recipient = invoice.customerEmail!

  try {
    const pdfBuffer = await renderToBuffer(<RecipientReceiptDocument invoice={invoice} />)
    const html = buildInvoiceShipmentUpdateHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl ?? '#',
      latestMessage,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt,
      deliveredAt: shipment.deliveredAt,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient,
      subject: shipmentUpdateSubject(status, invoice.invoiceNumber),
      html,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}-invoice.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    await recordNotification(invoice.id, shipment.id, status, recipient, 'SENT', null)
  } catch (err) {
    console.error('[tracking notifications] send failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordNotification(invoice.id, shipment.id, status, recipient, 'FAILED', message)
  }
}

async function recordNotification(
  invoiceId: string,
  shipmentId: string,
  status: ShippingStatus,
  recipient: string,
  result: 'SENT' | 'FAILED',
  failureReason: string | null
): Promise<void> {
  await prisma.shipmentNotification.create({
    data: { invoiceId, shipmentId, notificationType: status, recipient, status: result, failureReason: failureReason ?? undefined },
  })
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      lastNotificationType: status,
      lastNotificationStatus: result,
      lastNotificationSentAt: new Date(),
      lastNotificationRecipient: recipient,
      lastNotificationFailureReason: failureReason,
    },
  })
}

// Admin-triggered manual resend of the most recent notification — per spec's
// "Resend the latest customer email" admin control. Resends using the
// invoice's primary shipment (Decision 2) and its most recent carrier status.
export async function resendLastNotification(invoiceId: string): Promise<boolean> {
  const invoice = await getInvoice(invoiceId)
  if (!invoice || !invoice.customerEmail || !invoice.lastNotificationType) return false

  const shipment = getPrimaryShipment(invoice.shipments)
  if (!shipment) return false

  await sendShipmentEmail(invoice, shipment, invoice.lastNotificationType, shipment.carrierStatus ?? 'Status update')
  return true
}
