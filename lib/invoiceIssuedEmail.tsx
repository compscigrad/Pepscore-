// "Here's your invoice" email — see emails/InvoiceIssued.tsx for the
// template. Auto-sent once, the first time an invoice reaches Issued/Pending
// (lib/invoices.ts calls sendInvoiceIssuedEmailIfNeeded after create/
// update/recordPayment), or manually anytime via the "Email Invoice to
// Customer" admin action. Same dedup/failure-handling shape as
// lib/tracking/notifications.tsx: never throws, always records what
// happened. sendInvoiceIssuedSmsIfNeeded below is the SMS companion, same
// one-time dedup pattern, using lib/notifications/bestEffortSms.ts so a
// missing/failed Twilio config is recorded, never fatal.
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'
import { buildInvoiceIssuedHtml, invoiceIssuedSubject } from '@/emails/InvoiceIssued'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { recordCustomerActivity } from '@/lib/customers'
import { findActiveIntakeLinkFor, generateIntakeLink } from '@/lib/intakeLinks'
import { sendCategorizedEmail, sendCategorizedSms } from '@/lib/notifications/log'
import type { InvoiceWithRelations } from '@/lib/invoices'

// Issued and Pending are both "has been issued at least once" (see
// lib/invoice/status.ts) — Pending just means a balance still remains.
const TRIGGER_STATUSES = ['ISSUED', 'PENDING']

export function isInvoiceEmailTriggerStatus(status: string): boolean {
  return TRIGGER_STATUSES.includes(status)
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// The one secure link this invoice has ever had (Section 1: never generate
// a second one). Reuses whatever's active; only mints a fresh one on the
// rare manually-built invoice that skipped the intake flow entirely and so
// has never had a link at all — this is the single point where that gap is
// closed, not a new link minted on every notification.
async function resolveSecureLink(invoice: InvoiceWithRelations): Promise<string | null> {
  const existing = await findActiveIntakeLinkFor({ customerId: invoice.customerId, invoiceId: invoice.id })
  if (existing) return `${APP_URL}/intake/${existing.token}`

  if (invoice.intakeLinks.length > 0) {
    // Every existing link is expired/invalidated/attempt-limited — the
    // client needs a fresh one, but per Section 1 that's still a
    // regenerate of the same association, not a "second" link concept.
    const fresh = await generateIntakeLink({ customerId: invoice.customerId, invoiceId: invoice.id, createdBy: 'system' })
    return `${APP_URL}/intake/${fresh.token}`
  }

  // No link has ever existed for this invoice (a manually-built invoice
  // that never went through the intake flow) — mint the first one now so
  // the client has somewhere to go for payment selection.
  const first = await generateIntakeLink({ customerId: invoice.customerId, invoiceId: invoice.id, createdBy: 'system' })
  return `${APP_URL}/intake/${first.token}`
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
    const secureLink = await resolveSecureLink(invoice)
    const html = buildInvoiceIssuedHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      secureLink,
    })

    const result = await sendCategorizedEmail(
      {
        category: 'INVOICE_ISSUED',
        to: recipient,
        subject: invoiceIssuedSubject(invoice.invoiceNumber),
        html,
        attachments: [{ filename: `${invoice.invoiceNumber}-invoice.pdf`, content: pdfBuffer }],
      },
      { customerId: invoice.customerId, invoiceId: invoice.id, actorType: source, actorUserId: userId }
    )
    if (!result.sent) throw new Error(result.failureReason ?? 'Unknown email provider error')

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

const SMS_ATTEMPT_EVENT_TYPES = ['INVOICE_ISSUED_SMS_SENT', 'INVOICE_ISSUED_SMS_SKIPPED', 'INVOICE_ISSUED_SMS_FAILED']

function invoiceReadySmsBody(invoice: InvoiceWithRelations, secureLink: string | null): string {
  const linkPart = secureLink ? ` ${secureLink}` : ''
  if (invoice.balanceDue <= 0) {
    return `Hi ${invoice.customerName}, your Pepscore invoice #${invoice.invoiceNumber} has been prepared and your payment has been recorded.${linkPart}`
  }
  return `Hi ${invoice.customerName}, your Pepscore invoice #${invoice.invoiceNumber} is ready. Please review and choose how you'd like to pay:${linkPart}`
}

// SMS companion to sendInvoiceIssuedEmailIfNeeded — same trigger/one-time
// semantics, but never blocks or fails the caller (Section 8): a missing
// Twilio config or a send error is recorded as SKIPPED/FAILED, not thrown.
// Dedup is "has any SMS-attempt activity-log row ever been written," same
// shape as the email's own dedup check, so a retry never double-texts.
export async function sendInvoiceIssuedSmsIfNeeded(invoice: InvoiceWithRelations): Promise<void> {
  if (!isInvoiceEmailTriggerStatus(invoice.status)) return

  const alreadyAttempted = await prisma.invoiceActivityLog.findFirst({
    where: { invoiceId: invoice.id, eventType: { in: SMS_ATTEMPT_EVENT_TYPES } },
  })
  if (alreadyAttempted) return

  const secureLink = await resolveSecureLink(invoice)
  const result = await sendCategorizedSms(
    'INVOICE_ISSUED',
    invoice.customerPhone,
    invoiceReadySmsBody(invoice, secureLink),
    { customerId: invoice.customerId, invoiceId: invoice.id, actorType: 'SYSTEM' }
  )

  const eventType =
    result.outcome === 'SENT'
      ? 'INVOICE_ISSUED_SMS_SENT'
      : result.outcome === 'FAILED'
        ? 'INVOICE_ISSUED_SMS_FAILED'
        : 'INVOICE_ISSUED_SMS_SKIPPED'
  const newValue =
    result.outcome === 'SENT'
      ? invoice.customerPhone
      : result.outcome === 'SKIPPED_NOT_CONFIGURED'
        ? 'SMS provider not configured'
        : result.outcome === 'SKIPPED_NO_PHONE'
          ? 'No phone number on file'
          : (result.failureReason ?? 'SMS send failed')

  await prisma.invoiceActivityLog.create({ data: { invoiceId: invoice.id, eventType, newValue, source: 'SYSTEM' } })
  if (invoice.customerId) {
    await recordCustomerActivity({ customerId: invoice.customerId, invoiceId: invoice.id, eventType, newValue, source: 'SYSTEM' })
  }
}
