// POST /api/contact — public, unauthenticated submission endpoint for the
// storefront's contact/wholesale-inquiry form (components/storefront/
// ContactSection.tsx) AND, cross-origin, for the actual public marketing
// site's form (pepscore-landing repo, live at pepscorelab.com —
// components/landing/LandingForm.tsx there). This is the one centralized
// backend both frontends submit to, rather than duplicating the
// validation/routing/logging logic in the landing repo. Notifies the
// Contact mailbox and sends the visitor a short acknowledgement, both
// through the same centralized sendCategorizedEmail() every other outbound
// email in this app uses — so this submission gets logged to Communication
// (lib/notifications/log.ts) the same way an invoice or intake email does,
// and never silently fails.
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

// Origins allowed to POST here cross-origin: the live marketing domain, its
// www alias, and that repo's own Vercel preview/production URLs (a fixed
// vercel.app host plus every preview subdomain Vercel generates for it) —
// never a wildcard "*", since this endpoint sends real email on every
// accepted request.
const ALLOWED_ORIGINS = [
  'https://pepscorelab.com',
  'https://www.pepscorelab.com',
  'https://pepscore-landing.vercel.app',
]
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/pepscore-landing-[a-z0-9-]+\.vercel\.app$/

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (ALLOWED_ORIGIN_PATTERN.test(origin)) return origin
  return null
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = resolveAllowedOrigin(origin)
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'))

  const rateLimit = checkRateLimit(`contact-submit:${getClientIp(req)}`, 5, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429, headers })
  }

  const body = await req.json().catch(() => null)
  const parsed = contactInquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400, headers })
  }
  const data = parsed.data

  // Honeypot: a real visitor never sees or fills this field. Return a fake
  // success so a bot gets no signal it was caught.
  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true }, { headers })
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
    return NextResponse.json({ error: 'Something went wrong sending your message. Please try again shortly.' }, { status: 502, headers })
  }

  return NextResponse.json({ ok: true }, { headers })
}
