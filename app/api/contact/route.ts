// POST /api/contact — public, unauthenticated submission endpoint for the
// storefront's contact/wholesale-inquiry form (components/storefront/
// ContactSection.tsx). Notifies the Contact mailbox and sends the visitor a
// short acknowledgement, both through the same centralized
// sendCategorizedEmail() every other outbound email in this app uses — so
// this submission gets logged to Communication (lib/notifications/log.ts)
// the same way an invoice or intake email does, and never silently fails.
import { NextRequest, NextResponse } from 'next/server'
import { CONTACT_EMAIL } from '@/lib/resend'
import { contactInquirySchema, isHoneypotTripped } from '@/lib/contactInquiry/validation'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import {
  contactInquiryAdminSubject,
  buildContactInquiryAdminHtml,
  contactInquiryAcknowledgementSubject,
  buildContactInquiryAcknowledgementHtml,
} from '@/emails/ContactInquiry'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`contact-submit:${getClientIp(req)}`, 5, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = contactInquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  // Honeypot: a real visitor never sees or fills this field. Return a fake
  // success so a bot gets no signal it was caught.
  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true })
  }

  const adminResult = await sendCategorizedEmail(
    {
      category: 'CONTACT_INQUIRY',
      to: CONTACT_EMAIL,
      subject: contactInquiryAdminSubject(data.name),
      html: buildContactInquiryAdminHtml(data),
    },
    { actorType: 'SYSTEM' }
  )

  // The acknowledgement is a courtesy, not the primary deliverable — its
  // failure never turns a successfully-recorded inquiry into a 500 for the
  // visitor. Both sends are logged to Communication regardless of outcome.
  await sendCategorizedEmail(
    {
      category: 'CONTACT_INQUIRY',
      to: data.email,
      subject: contactInquiryAcknowledgementSubject(),
      html: buildContactInquiryAcknowledgementHtml({ name: data.name }),
    },
    { actorType: 'SYSTEM' }
  )

  if (!adminResult.sent) {
    // The one failure mode that actually matters to the visitor: nobody
    // will see their message. Surface a generic failure, never the
    // underlying provider error.
    return NextResponse.json({ error: 'Something went wrong sending your message. Please try again shortly.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
