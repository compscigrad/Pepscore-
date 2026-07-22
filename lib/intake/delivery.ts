// Delivers an intake link directly to the customer — distinct from
// lib/notifications/, which alerts the *admin* after a submission happens.
// SMS stays inert (isSmsConfigured() false, callers hide/disable the button)
// until real Twilio credentials are added as env vars; no code change is
// needed to activate it once they are — see .env.local.example.
import { resend, FROM_EMAIL, SUPPORT_EMAIL } from '@/lib/resend'
import { buildIntakeLinkRequestHtml, intakeLinkRequestSubject } from '@/emails/IntakeLinkRequest'
import { recordCustomerActivity } from '@/lib/customers'
import { prisma } from '@/lib/prisma'

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
}

// Best-effort US/CA normalization to E.164 — Twilio rejects anything else.
// Numbers that don't match a recognizable 10/11-digit US pattern are passed
// through as-is so an already-E.164 international number isn't mangled.
export function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw.startsWith('+') ? raw : `+${digits}`
}

interface SendIntakeLinkInput {
  token: string
  link: string
  customerName: string
  customerId: string | null
  invoiceId: string | null
  email?: string | null
  phone?: string | null
}

async function logSendActivity(input: SendIntakeLinkInput, eventType: string) {
  if (input.customerId) {
    await recordCustomerActivity({
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      eventType,
      source: 'MANUAL',
    })
  } else if (input.invoiceId) {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: input.invoiceId, eventType, source: 'MANUAL' },
    })
  }
}

export async function sendIntakeLinkEmail(input: SendIntakeLinkInput): Promise<void> {
  if (!input.email) throw new Error('No email address on file for this customer')

  await resend.emails.send({
    from: FROM_EMAIL,
    to: input.email,
    replyTo: SUPPORT_EMAIL,
    subject: intakeLinkRequestSubject(),
    html: buildIntakeLinkRequestHtml({ customerName: input.customerName, link: input.link }),
  })

  await logSendActivity(input, 'INTAKE_LINK_SENT_EMAIL')
}

export async function sendIntakeLinkSms(input: SendIntakeLinkInput): Promise<void> {
  if (!input.phone) throw new Error('No phone number on file for this customer')
  if (!isSmsConfigured()) throw new Error('SMS is not configured — add TWILIO_* environment variables')

  // Lazy import: avoids requiring TWILIO_* at module-load time in
  // environments (tests, build) that never actually send SMS.
  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

  await client.messages.create({
    to: normalizePhoneToE164(input.phone),
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `Hi ${input.customerName}, please complete your Pepscore order details here: ${input.link}`,
  })

  await logSendActivity(input, 'INTAKE_LINK_SENT_SMS')
}
