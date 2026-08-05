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
import { buildInvoiceIssuedHtml, invoiceIssuedSubject, invoiceRevisedSubject } from '@/emails/InvoiceIssued'
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

// Section 5's "notify admin of success/failure" — success is already visible
// to the admin (they're the one who just clicked Save/Issue), so only
// failure gets a proactive push; a silent failure here is exactly the kind
// of thing that goes unnoticed until a client calls asking where their
// invoice is. Follows the same direct email/SMS-to-recipients shape as
// lib/notifications/paymentWorkflow.ts's admin alerts, not the dashboard
// Notification model (that model's schema is intake-submission-specific).
async function notifyAdminOfInvoiceEmailFailure(invoice: InvoiceWithRelations, failureReason: string): Promise<void> {
  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)
  const body = `The invoice email for #${invoice.invoiceNumber} (${invoice.customerName}) failed to send: ${failureReason}`

  if (emailTargets.length > 0) {
    await sendCategorizedEmail(
      {
        category: 'ADMIN_DELIVERY_FAILURE_ALERT',
        to: emailTargets.map((r) => r.email!),
        subject: `Invoice email failed to send — #${invoice.invoiceNumber}`,
        html: `<p>${body}</p><p>Invoice: ${APP_URL}/admin/invoices/${invoice.id}</p>`,
      },
      { customerId: invoice.customerId, invoiceId: invoice.id, actorType: 'SYSTEM' }
    )
  }
  for (const recipient of recipients.filter((r) => r.smsEnabled && r.phone)) {
    await sendCategorizedSms(
      'ADMIN_DELIVERY_FAILURE_ALERT',
      recipient.phone,
      `Pepscore: ${body}`,
      { customerId: invoice.customerId, invoiceId: invoice.id, actorType: 'SYSTEM' }
    )
  }
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

async function sendInvoiceEmail(
  invoice: InvoiceWithRelations,
  source: 'SYSTEM' | 'MANUAL',
  userId?: string,
  revision?: { previousTotal: number }
): Promise<boolean> {
  const recipient = invoice.customerEmail!
  const eventType = revision ? 'INVOICE_REVISED_EMAIL_SENT' : 'INVOICE_ISSUED_EMAIL_SENT'

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
      previousTotal: revision?.previousTotal,
    })

    const result = await sendCategorizedEmail(
      {
        category: revision ? 'INVOICE_REVISED' : 'INVOICE_ISSUED',
        to: recipient,
        subject: revision ? invoiceRevisedSubject(invoice.invoiceNumber) : invoiceIssuedSubject(invoice.invoiceNumber),
        html,
        attachments: [{ filename: `${invoice.invoiceNumber}-invoice.pdf`, content: pdfBuffer }],
      },
      { customerId: invoice.customerId, invoiceId: invoice.id, actorType: source, actorUserId: userId }
    )
    if (!result.sent) throw new Error(result.failureReason ?? 'Unknown email provider error')

    await recordResult(invoice.id, 'SENT', null)
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: invoice.id, eventType, newValue: recipient, source, userId },
    })
    if (invoice.customerId) {
      await recordCustomerActivity({ customerId: invoice.customerId, invoiceId: invoice.id, eventType, newValue: recipient, source, userId })
    }
    return true
  } catch (err) {
    console.error('[invoiceIssuedEmail] send failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordResult(invoice.id, 'FAILED', message)
    await notifyAdminOfInvoiceEmailFailure(invoice, message)
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

// Called from lib/invoices.ts's updateInvoice after a save that changes the
// total on an invoice the client has already been emailed — a distinct
// "here's what changed" notification rather than silently reusing the
// issued-email framing for a change the client hasn't seen. Every genuinely
// total-changing save re-notifies (no one-time dedup): each one is a real,
// separate revision the client should know about.
export async function sendInvoiceRevisedEmailIfNeeded(invoice: InvoiceWithRelations, previousTotal: number): Promise<boolean> {
  if (!invoice.customerEmail) return false
  if (!isInvoiceEmailTriggerStatus(invoice.status)) return false
  if (previousTotal === invoice.total) return false

  const settings = await getInvoiceSettings()
  if (!settings.autoEmailInvoiceOnIssue) return false

  // Never fires for an invoice's very first issuance — that's always the
  // issued email (sendInvoiceIssuedEmailIfNeeded), not a revision.
  const everEmailed = await prisma.invoiceActivityLog.findFirst({
    where: { invoiceId: invoice.id, eventType: { in: ['INVOICE_ISSUED_EMAIL_SENT', 'INVOICE_REVISED_EMAIL_SENT'] } },
  })
  if (!everEmailed) return false

  return sendInvoiceEmail(invoice, 'SYSTEM', undefined, { previousTotal })
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
