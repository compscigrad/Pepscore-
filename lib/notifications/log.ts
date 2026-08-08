// The single place any email or SMS actually gets sent AND logged. Resend
// delivers through its own infrastructure, not Google Workspace SMTP, so
// nothing sent through here ever shows up in the admin@ Gmail Sent folder —
// the Communication table this writes to is the only authoritative record
// of what Pepscore has actually sent a customer (or an admin alert), what it
// said, and whether it succeeded.
//
// Resend's SDK returns delivery errors as a value (`{ data, error }`), not a
// thrown exception — every previous direct `resend.emails.send(...)` call
// site ignored that return value entirely, so an unverified-domain rejection
// (or any other API-level failure) was silently discarded. Routing every
// send through here fixes that for good, not just for the sites migrated on
// this pass.
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { routeFor, type MessageCategory } from './routing'
import { attemptSms, type SmsOutcome } from './bestEffortSms'
import { phoneNumbersMatch } from './phoneMatch'
import type { TrackingEventSource } from '@prisma/client'

export interface SendContext {
  customerId?: string | null
  invoiceId?: string | null
  relatedPaymentId?: string | null
  relatedRefundId?: string | null
  relatedBackorderConditionId?: string | null
  relatedIntakeLinkId?: string | null
  actorType: TrackingEventSource
  actorUserId?: string | null
}

async function recordCommunication(input: {
  channel: 'EMAIL' | 'SMS'
  category: MessageCategory | string
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  fromAddress?: string | null
  fromName?: string | null
  replyTo?: string | null
  toAddress: string
  subject?: string | null
  body: string
  providerName?: string | null
  providerMessageId?: string | null
  failureReason?: string | null
  context: SendContext
}): Promise<void> {
  await prisma.communication.create({
    data: {
      channel: input.channel,
      category: input.category,
      status: input.status,
      fromAddress: input.fromAddress ?? undefined,
      fromName: input.fromName ?? undefined,
      replyTo: input.replyTo ?? undefined,
      toAddress: input.toAddress,
      subject: input.subject ?? undefined,
      body: input.body,
      customerId: input.context.customerId ?? undefined,
      invoiceId: input.context.invoiceId ?? undefined,
      relatedPaymentId: input.context.relatedPaymentId ?? undefined,
      relatedRefundId: input.context.relatedRefundId ?? undefined,
      relatedBackorderConditionId: input.context.relatedBackorderConditionId ?? undefined,
      relatedIntakeLinkId: input.context.relatedIntakeLinkId ?? undefined,
      providerName: input.providerName ?? undefined,
      providerMessageId: input.providerMessageId ?? undefined,
      failureReason: input.failureReason ?? undefined,
      actorType: input.context.actorType,
      actorUserId: input.context.actorUserId ?? undefined,
    },
  })
}

export interface SendEmailInput {
  category: MessageCategory
  to: string | string[]
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}

export interface SendEmailResult {
  sent: boolean
  providerMessageId: string | null
  failureReason: string | null
}

// Sends one categorized email and records exactly one Communication row for
// it, success or failure — never throws (a failed send is a result, not an
// exception), matching every existing "notification failure never blocks
// the business operation" call site in this codebase.
export async function sendCategorizedEmail(input: SendEmailInput, context: SendContext): Promise<SendEmailResult> {
  const sender = routeFor(input.category)
  const toAddress = Array.isArray(input.to) ? input.to.join(', ') : input.to

  let providerMessageId: string | null = null
  let failureReason: string | null = null

  try {
    const { data, error } = await resend.emails.send({
      from: sender.from,
      to: input.to,
      replyTo: sender.replyTo,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    })
    if (error) {
      failureReason = error.message
    } else {
      providerMessageId = data?.id ?? null
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : 'Unknown email provider error'
  }

  await recordCommunication({
    channel: 'EMAIL',
    category: input.category,
    status: failureReason ? 'FAILED' : 'SENT',
    fromAddress: sender.from,
    replyTo: sender.replyTo,
    toAddress,
    subject: input.subject,
    body: input.html,
    providerName: 'resend',
    providerMessageId,
    failureReason,
    context,
  })

  return { sent: !failureReason, providerMessageId, failureReason }
}

export interface SendSmsResult {
  outcome: SmsOutcome
  failureReason?: string
}

// Same idea for SMS — wraps the existing attemptSms (never-throws) helper
// and records a Communication row for every real attempt. Genuinely skipped
// sends (no phone on file, Twilio not configured) are recorded as SKIPPED
// rather than silently producing no correspondence trail at all.
export async function sendCategorizedSms(
  category: MessageCategory,
  phone: string | null | undefined,
  body: string,
  context: SendContext
): Promise<SendSmsResult> {
  // Only ever suppresses a send TO the customer's own opted-out phone --
  // context.customerId marks which customer a message concerns, not who
  // it's going to (an admin alert about a customer's activity carries the
  // same customerId but goes to an AdminNotificationRecipient's phone, and
  // must never be silently dropped just because that customer opted out).
  if (phone && context.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: context.customerId },
      select: { phone: true, smsOptedOut: true },
    })
    if (customer?.smsOptedOut && customer.phone && phoneNumbersMatch(customer.phone, phone)) {
      await recordCommunication({
        channel: 'SMS',
        category,
        status: 'SKIPPED',
        toAddress: phone,
        body,
        providerName: 'twilio',
        failureReason: 'SKIPPED_OPTED_OUT',
        context,
      })
      return { outcome: 'SKIPPED_OPTED_OUT' }
    }
  }

  const result = await attemptSms(phone, body)

  await recordCommunication({
    channel: 'SMS',
    category,
    status: result.outcome === 'SENT' ? 'SENT' : result.outcome === 'FAILED' ? 'FAILED' : 'SKIPPED',
    toAddress: phone ?? 'unknown',
    body,
    providerName: 'twilio',
    failureReason: result.failureReason ?? (result.outcome !== 'SENT' ? result.outcome : undefined),
    context,
  })

  return result
}
