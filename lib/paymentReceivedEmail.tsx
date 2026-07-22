// "Payment received" email — see emails/PaymentReceived.tsx for the
// template. Called once from lib/invoices.ts's recordPayment() right after
// each InvoicePayment row is created. Unlike the one-time invoice-issued
// email (lib/invoiceIssuedEmail.tsx), no dedup guard is needed: every call
// here already corresponds to exactly one real, distinct payment event —
// there's no "retry" path that could fire this twice for the same payment.
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { resend, FROM_EMAIL, BILLING_EMAIL } from '@/lib/resend'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'
import { buildPaymentReceivedHtml, paymentReceivedSubject } from '@/emails/PaymentReceived'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { recordCustomerActivity } from '@/lib/customers'
import type { InvoiceWithRelations } from '@/lib/invoices'
import type { InvoicePayment } from '@prisma/client'

export async function sendPaymentReceivedEmailIfNeeded(invoice: InvoiceWithRelations, payment: InvoicePayment): Promise<boolean> {
  if (!invoice.customerEmail) return false

  const settings = await getInvoiceSettings()
  if (!settings.autoEmailPaymentReceived) return false

  const recipient = invoice.customerEmail

  try {
    const pdfBuffer = await renderToBuffer(<RecipientReceiptDocument invoice={invoice} />)
    const html = buildPaymentReceivedHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      amountPaid: payment.amount,
      balanceDue: invoice.balanceDue,
      total: invoice.total,
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipient,
      replyTo: BILLING_EMAIL,
      subject: paymentReceivedSubject(invoice.invoiceNumber),
      html,
      attachments: [{ filename: `${invoice.invoiceNumber}-invoice.pdf`, content: pdfBuffer }],
    })

    await prisma.invoiceActivityLog.create({
      data: {
        invoiceId: invoice.id,
        eventType: 'PAYMENT_RECEIVED_EMAIL_SENT',
        newValue: recipient,
        source: 'SYSTEM',
      },
    })

    if (invoice.customerId) {
      await recordCustomerActivity({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        eventType: 'PAYMENT_RECEIVED_EMAIL_SENT',
        newValue: recipient,
        source: 'SYSTEM',
      })
    }

    return true
  } catch (err) {
    console.error('[paymentReceivedEmail] send failed:', err)
    return false
  }
}
