// Notification fan-out for the client's second submission (Sections 11/12/
//15/16) and the admin's approval/denial decision (Sections 18-21). Every
// function here follows the same rule as lib/invoiceIssuedEmail.tsx and
// lib/notifications/dispatch.ts: the business-state change (Invoice/
// PaymentArrangement update) has already been committed by the caller
// before any of these run, and nothing in here is allowed to throw — a
// failed or unconfigured channel is recorded, never fatal (Section 8/26).
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { routeFor } from '@/lib/notifications/routing'
import { attemptSms } from '@/lib/notifications/bestEffortSms'
import { recordCustomerActivity } from '@/lib/customers'
import {
  paymentSelectionPendingSubject,
  buildPaymentSelectionPendingHtml,
  arrangementRequestPendingSubject,
  buildArrangementRequestPendingHtml,
} from '@/emails/AdminPaymentAlerts'
import {
  arrangementApprovedSubject,
  buildArrangementApprovedHtml,
  arrangementDeniedSubject,
  buildArrangementDeniedHtml,
} from '@/emails/ClientArrangementDecision'
import {
  paymentSelectionConfirmationSubject,
  buildPaymentSelectionConfirmationHtml,
  arrangementRequestReceivedSubject,
  buildArrangementRequestReceivedHtml,
} from '@/emails/ClientSubmissionConfirmation'
import { findActiveIntakeLinkFor } from '@/lib/intakeLinks'
import type { InvoiceWithRelations } from '@/lib/invoices'
import type { PaymentArrangement, PaymentArrangementInstallment } from '@prisma/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

async function logInvoiceAndCustomerEvent(
  invoice: InvoiceWithRelations,
  eventType: string,
  newValue?: string | null
): Promise<void> {
  await prisma.invoiceActivityLog.create({ data: { invoiceId: invoice.id, eventType, newValue: newValue ?? undefined, source: 'SYSTEM' } })
  if (invoice.customerId) {
    await recordCustomerActivity({ customerId: invoice.customerId, invoiceId: invoice.id, eventType, newValue, source: 'SYSTEM' })
  }
}

function formatSchedule(installments: PaymentArrangementInstallment[]): string {
  return installments
    .map((i) => `#${i.installmentNumber} ${i.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} due ${new Date(i.dueDate).toLocaleDateString('en-US')}`)
    .join('; ')
}

// Section 12 — fired immediately after a client's Pay in Full selection is
// saved. Sends to every configured admin recipient's email; SMS is
// attempted per-recipient only when they opted in and Twilio is configured.
export async function notifyAdminPaymentSelectionPending(invoice: InvoiceWithRelations): Promise<void> {
  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)

  const html = buildPaymentSelectionPendingHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceId: invoice.id,
    clientName: invoice.customerName,
    clientPhone: invoice.customerPhone,
    clientEmail: invoice.customerEmail,
    invoiceTotal: invoice.total,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    selectedMethod: invoice.selectedPaymentMethod ?? 'Unknown',
    submittedAt: new Date(),
    appUrl: APP_URL,
  })
  const subject = paymentSelectionPendingSubject(invoice.invoiceNumber)

  let emailSent = false
  try {
    if (emailTargets.length > 0) {
      const sender = routeFor('PAYMENT_SELECTION_PENDING')
      await resend.emails.send({ from: sender.from, to: emailTargets.map((r) => r.email!), replyTo: sender.replyTo, subject, html })
      emailSent = true
    }
  } catch (err) {
    console.error('[paymentWorkflow] admin payment-selection email failed:', err)
  }

  for (const recipient of recipients.filter((r) => r.smsEnabled && r.phone)) {
    await attemptSms(recipient.phone, `Pepscore: ${invoice.customerName} selected Pay in Full for invoice #${invoice.invoiceNumber}. Awaiting manual confirmation.`)
  }

  await logInvoiceAndCustomerEvent(invoice, 'PAY_IN_FULL_SELECTED_ADMIN_NOTIFIED', emailSent ? 'Email sent' : 'No admin recipients configured')
}

// Section 11's client-facing confirmation — separate from the admin alert
// above so a failure in one never blocks the other.
export async function notifyClientPaymentSelectionConfirmation(invoice: InvoiceWithRelations): Promise<void> {
  if (invoice.customerEmail) {
    try {
      const sender = routeFor('PAYMENT_SELECTION_CONFIRMATION')
      await resend.emails.send({
        from: sender.from,
        to: invoice.customerEmail,
        replyTo: sender.replyTo,
        subject: paymentSelectionConfirmationSubject(invoice.invoiceNumber),
        html: buildPaymentSelectionConfirmationHtml(invoice.customerName, invoice.invoiceNumber),
      })
    } catch (err) {
      console.error('[paymentWorkflow] client payment-selection confirmation email failed:', err)
    }
  }
  const sms = await attemptSms(invoice.customerPhone, `Hi ${invoice.customerName}, we received your Pay in Full selection for invoice #${invoice.invoiceNumber}.`)
  await logInvoiceAndCustomerEvent(invoice, 'PAY_IN_FULL_SELECTED_CLIENT_CONFIRMED', sms.outcome)
}

// Section 16 — fired immediately after a client's arrangement request is saved.
export async function notifyAdminArrangementRequestPending(
  invoice: InvoiceWithRelations,
  arrangement: PaymentArrangement & { installments: PaymentArrangementInstallment[] }
): Promise<void> {
  const recipients = await prisma.adminNotificationRecipient.findMany()
  const emailTargets = recipients.filter((r) => r.emailEnabled && r.email)

  const html = buildArrangementRequestPendingHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceId: invoice.id,
    clientName: invoice.customerName,
    clientPhone: invoice.customerPhone,
    clientEmail: invoice.customerEmail,
    invoiceTotal: invoice.total,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    paymentStatus: invoice.paymentStatus,
    frequency: arrangement.frequency === 'WEEKLY' ? 'Every Week' : 'Every Two Weeks',
    proposedDownPayment: arrangement.proposedDownPayment ?? 0,
    installmentCount: arrangement.installments.length,
    scheduleSummary: formatSchedule(arrangement.installments),
    submittedAt: arrangement.requestedAt ?? new Date(),
    appUrl: APP_URL,
  })
  const subject = arrangementRequestPendingSubject(invoice.invoiceNumber)

  let emailSent = false
  try {
    if (emailTargets.length > 0) {
      const sender = routeFor('PAYMENT_ARRANGEMENT_REQUEST_PENDING')
      await resend.emails.send({ from: sender.from, to: emailTargets.map((r) => r.email!), replyTo: sender.replyTo, subject, html })
      emailSent = true
    }
  } catch (err) {
    console.error('[paymentWorkflow] admin arrangement-request email failed:', err)
  }

  for (const recipient of recipients.filter((r) => r.smsEnabled && r.phone)) {
    await attemptSms(recipient.phone, `Pepscore: ${invoice.customerName} requested a payment arrangement for invoice #${invoice.invoiceNumber}. Review required.`)
  }

  await logInvoiceAndCustomerEvent(invoice, 'ARRANGEMENT_REQUEST_ADMIN_NOTIFIED', emailSent ? 'Email sent' : 'No admin recipients configured')
}

// Section 15's client-facing confirmation.
export async function notifyClientArrangementRequestReceived(invoice: InvoiceWithRelations): Promise<void> {
  if (invoice.customerEmail) {
    try {
      const sender = routeFor('PAYMENT_ARRANGEMENT_REQUEST_RECEIVED')
      await resend.emails.send({
        from: sender.from,
        to: invoice.customerEmail,
        replyTo: sender.replyTo,
        subject: arrangementRequestReceivedSubject(invoice.invoiceNumber),
        html: buildArrangementRequestReceivedHtml(invoice.customerName, invoice.invoiceNumber),
      })
    } catch (err) {
      console.error('[paymentWorkflow] client arrangement-request confirmation email failed:', err)
    }
  }
  const sms = await attemptSms(invoice.customerPhone, `Hi ${invoice.customerName}, we received your payment-arrangement request for invoice #${invoice.invoiceNumber}. Awaiting review.`)
  await logInvoiceAndCustomerEvent(invoice, 'ARRANGEMENT_REQUEST_CLIENT_CONFIRMED', sms.outcome)
}

// Section 20 — arrangement approved.
export async function notifyClientArrangementApproved(
  invoice: InvoiceWithRelations,
  arrangement: PaymentArrangement & { installments: PaymentArrangementInstallment[] }
): Promise<void> {
  if (invoice.customerEmail) {
    try {
      const sender = routeFor('PAYMENT_ARRANGEMENT_DECISION')
      await resend.emails.send({
        from: sender.from,
        to: invoice.customerEmail,
        replyTo: sender.replyTo,
        subject: arrangementApprovedSubject(invoice.invoiceNumber),
        html: buildArrangementApprovedHtml({
          customerName: invoice.customerName,
          invoiceNumber: invoice.invoiceNumber,
          invoiceTotal: invoice.total,
          amountPaid: invoice.amountPaid,
          balanceDue: invoice.balanceDue,
          paymentStatus: invoice.paymentStatus,
          frequency: arrangement.frequency === 'WEEKLY' ? 'Every Week' : 'Every Two Weeks',
          downPayment: arrangement.proposedDownPayment ?? 0,
          installmentCount: arrangement.installments.length,
          scheduleSummary: formatSchedule(arrangement.installments),
        }),
      })
    } catch (err) {
      console.error('[paymentWorkflow] client arrangement-approved email failed:', err)
    }
  }
  const sms = await attemptSms(invoice.customerPhone, `Hi ${invoice.customerName}, your payment arrangement for invoice #${invoice.invoiceNumber} was approved.`)
  await logInvoiceAndCustomerEvent(invoice, 'ARRANGEMENT_APPROVED_CLIENT_NOTIFIED', sms.outcome)
}

// Section 21 — arrangement denied. Reuses the invoice's one existing secure
// link (never mints a new one) so the client can return to choose Pay in
// Full or revise their request.
export async function notifyClientArrangementDenied(invoice: InvoiceWithRelations, reason: string | null): Promise<void> {
  const link = await findActiveIntakeLinkFor({ customerId: invoice.customerId, invoiceId: invoice.id })
  const secureLink = link ? `${APP_URL}/intake/${link.token}` : APP_URL

  if (invoice.customerEmail) {
    try {
      const sender = routeFor('PAYMENT_ARRANGEMENT_DECISION')
      await resend.emails.send({
        from: sender.from,
        to: invoice.customerEmail,
        replyTo: sender.replyTo,
        subject: arrangementDeniedSubject(invoice.invoiceNumber),
        html: buildArrangementDeniedHtml({
          customerName: invoice.customerName,
          invoiceNumber: invoice.invoiceNumber,
          reason,
          secureLink,
          paymentStatus: invoice.paymentStatus,
          balanceDue: invoice.balanceDue,
        }),
      })
    } catch (err) {
      console.error('[paymentWorkflow] client arrangement-denied email failed:', err)
    }
  }
  const sms = await attemptSms(invoice.customerPhone, `Hi ${invoice.customerName}, your payment arrangement request for invoice #${invoice.invoiceNumber} needs a revision. Please check your email.`)
  await logInvoiceAndCustomerEvent(invoice, 'ARRANGEMENT_DENIED_CLIENT_NOTIFIED', sms.outcome)
}
