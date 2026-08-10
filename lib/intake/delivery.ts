// Delivers an intake link directly to the customer — distinct from
// lib/notifications/, which alerts the *admin* after a submission happens.
// SMS stays inert (isSmsConfigured() false, callers hide/disable the button)
// until real Twilio credentials are added as env vars; no code change is
// needed to activate it once they are — see .env.local.example.
import { buildIntakeLinkRequestHtml, intakeLinkRequestSubject } from '@/emails/IntakeLinkRequest'
import { recordCustomerActivity } from '@/lib/customers'
import { prisma } from '@/lib/prisma'
import { sendCategorizedEmail, sendCategorizedSms } from '@/lib/notifications/log'
import { isSmsConfigured } from '@/lib/notifications/bestEffortSms'

// Re-exported for existing importers (app/admin/invoices/[id]/page.tsx) —
// the canonical definition now lives in bestEffortSms.ts, which this file's
// own sendIntakeLinkEmail/sendIntakeLinkSms depend on transitively via
// lib/notifications/log.ts; defining it here directly would create a
// circular import.
export { isSmsConfigured }

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

  const result = await sendCategorizedEmail(
    {
      category: 'INTAKE_REQUEST',
      to: input.email,
      subject: intakeLinkRequestSubject(),
      html: buildIntakeLinkRequestHtml({ customerName: input.customerName, link: input.link }),
    },
    { customerId: input.customerId, invoiceId: input.invoiceId, actorType: 'MANUAL' }
  )
  if (!result.sent) throw new Error(result.failureReason ?? 'Unknown email provider error')

  await logSendActivity(input, 'INTAKE_LINK_SENT_EMAIL')
}

export async function sendIntakeLinkSms(input: SendIntakeLinkInput): Promise<void> {
  if (!input.phone) throw new Error('No phone number on file for this customer')
  if (!isSmsConfigured()) throw new Error('SMS is not configured — add TWILIO_* environment variables')

  const result = await sendCategorizedSms(
    'INTAKE_REQUEST',
    input.phone,
    `Hi ${input.customerName}, please complete your Pepscore Lab order details here: ${input.link}`,
    { customerId: input.customerId, invoiceId: input.invoiceId, actorType: 'MANUAL' }
  )
  if (result.outcome !== 'SENT') throw new Error(result.failureReason ?? 'SMS send failed')

  await logSendActivity(input, 'INTAKE_LINK_SENT_SMS')
}
