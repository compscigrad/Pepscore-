// Customer-facing shipment emails — deduped per (invoice, status), gated by
// the per-status settings toggle, and never fatal to the tracking update
// that triggered them (an email failure is recorded, not thrown).
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { getInvoice } from '@/lib/invoices'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'
import { buildInvoiceShipmentUpdateHtml, shipmentUpdateSubject } from '@/emails/InvoiceShipmentUpdate'
import { getInvoiceSettings, isNotificationEnabled } from '@/lib/invoiceSettings'
import type { ShippingStatus } from '@prisma/client'
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
  status: ShippingStatus
  latestMessage: string
}

// Returns true if an email was actually attempted (sent or failed) — false
// if it was skipped (not a notifiable status, no customer email on file,
// disabled in settings, or already sent for this exact status).
export async function sendShipmentNotificationIfNeeded({ invoiceId, status, latestMessage }: NotifyParams): Promise<boolean> {
  if (!isNotifiableStatus(status)) return false

  const invoice = await getInvoice(invoiceId)
  if (!invoice || !invoice.customerEmail || !invoice.shipment) return false

  const settings = await getInvoiceSettings()
  if (!isNotificationEnabled(settings.trackingNotificationsEnabled, status)) return false

  // Dedup: never send the same status twice for the same invoice.
  const alreadySent = await prisma.shipmentNotification.findFirst({
    where: { invoiceId, notificationType: status, status: 'SENT' },
  })
  if (alreadySent) return false

  await sendShipmentEmail(invoice, status, latestMessage)
  return true
}

async function sendShipmentEmail(invoice: InvoiceWithRelations, status: ShippingStatus, latestMessage: string): Promise<void> {
  const shipment = invoice.shipment!
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

    await recordNotification(invoice.id, status, recipient, 'SENT', null)
  } catch (err) {
    console.error('[tracking notifications] send failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordNotification(invoice.id, status, recipient, 'FAILED', message)
  }
}

async function recordNotification(
  invoiceId: string,
  status: ShippingStatus,
  recipient: string,
  result: 'SENT' | 'FAILED',
  failureReason: string | null
): Promise<void> {
  await prisma.shipmentNotification.create({
    data: { invoiceId, notificationType: status, recipient, status: result, failureReason: failureReason ?? undefined },
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
// "Resend the latest customer email" admin control.
export async function resendLastNotification(invoiceId: string): Promise<boolean> {
  const invoice = await getInvoice(invoiceId)
  if (!invoice || !invoice.customerEmail || !invoice.shipment || !invoice.lastNotificationType) return false

  await sendShipmentEmail(invoice, invoice.lastNotificationType, invoice.shipment.carrierStatus ?? 'Status update')
  return true
}
