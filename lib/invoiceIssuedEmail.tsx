// "Here's your invoice" email — see emails/InvoiceIssued.tsx for the
// template. Auto-sent once, the first time an invoice reaches ISSUED/PAID/
// PARTIALLY_PAID (lib/invoices.ts calls sendInvoiceIssuedEmailIfNeeded after
// create/update), or manually anytime via the "Email Invoice to Customer"
// admin action. Same dedup/failure-handling shape as
// lib/tracking/notifications.tsx: never throws, always records what
// happened.
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { resend, FROM_EMAIL, BILLING_EMAIL } from '@/lib/resend'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'
import { buildInvoiceIssuedHtml, invoiceIssuedSubject } from '@/emails/InvoiceIssued'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { recordCustomerActivity } from '@/lib/customers'
import type { InvoiceWithRelations } from '@/lib/invoices'

const TRIGGER_STATUSES = ['ISSUED', 'PAID', 'PARTIALLY_PAID']

export function isInvoiceEmailTriggerStatus(status: string): boolean {
  return TRIGGER_STATUSES.includes(status)
}

async function recordResult(invoiceId: string, result: 'SENT' | 'FAILED', failureReason: string | null): Promise<void> {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      lastInvoiceEmailSentAt: new Date(),
      lastInvoiceEmailStatus: result,
      lastInvoiceEmailFailureReason: failureReason ?? undefined,
    },
  })
}

async function sendInvoiceEmail(invoice: InvoiceWithRelations, source: 'SYSTEM' | 'MANUAL', userId?: string): Promise<boolean> {
  const recipient = invoice.customerEmail!

  try {
    const pdfBuffer = await renderToBuffer(<RecipientReceiptDocument invoice={invoice} />)
    const html = buildInvoiceIssuedHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient,
      replyTo: BILLING_EMAIL,
      subject: invoiceIssuedSubject(invoice.invoiceNumber),
      html,
      attachments: [{ filename: `${invoice.invoiceNumber}-invoice.pdf`, content: pdfBuffer }],
    })

    await recordResult(invoice.id, 'SENT', null)
    await prisma.invoiceActivityLog.create({
      data: {
        invoiceId: invoice.id,
        eventType: 'INVOICE_ISSUED_EMAIL_SENT',
        newValue: recipient,
        source,
        userId,
      },
    })
    if (invoice.customerId) {
      await recordCustomerActivity({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        eventType: 'INVOICE_ISSUED_EMAIL_SENT',
        newValue: recipient,
        source,
        userId,
      })
    }
    return true
  } catch (err) {
    console.error('[invoiceIssuedEmail] send failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordResult(invoice.id, 'FAILED', message)
    return false
  }
}

// Called from lib/invoices.ts after create/update. Fires at most once per
// invoice — dedup is "has an INVOICE_ISSUED_EMAIL_SENT activity-log row ever
// been written for this invoice," not a boolean flag, so a later manual
// resend can never be confused with "the auto-send hasn't happened yet."
export async function sendInvoiceIssuedEmailIfNeeded(invoice: InvoiceWithRelations): Promise<boolean> {
  if (!invoice.customerEmail) return false
  if (!isInvoiceEmailTriggerStatus(invoice.status)) return false

  const settings = await getInvoiceSettings()
  if (!settings.autoEmailInvoiceOnIssue) return false

  const alreadySent = await prisma.invoiceActivityLog.findFirst({
    where: { invoiceId: invoice.id, eventType: 'INVOICE_ISSUED_EMAIL_SENT' },
  })
  if (alreadySent) return false

  return sendInvoiceEmail(invoice, 'SYSTEM')
}

// Admin "Email Invoice to Customer" manual action — always sends regardless
// of whether the one-time auto-send already fired.
export async function sendInvoiceEmailManually(invoice: InvoiceWithRelations, userId: string): Promise<boolean> {
  if (!invoice.customerEmail) return false
  return sendInvoiceEmail(invoice, 'MANUAL', userId)
}
