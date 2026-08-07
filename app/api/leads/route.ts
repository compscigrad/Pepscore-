// POST /api/leads — public, unauthenticated submission endpoint for every
// contextual storefront lead-capture form (Phase 2B item 7): general
// updates, launch notification, product/strength interest, notify-when-
// available, out-of-stock interest, pricing-review interest, SPA/wholesale
// inquiry. See components/storefront/LeadCaptureTrigger.tsx for the
// client-side form and lib/leads/service.ts for the Customer-linking logic.
import { NextRequest, NextResponse } from 'next/server'
import { leadCaptureSchema, isHoneypotTripped } from '@/lib/leads/validation'
import { captureLead } from '@/lib/leads/service'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { CONTACT_EMAIL } from '@/lib/resend'
import { leadCapturedSubject, buildLeadCapturedHtml } from '@/emails/LeadCaptured'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`lead-submit:${getClientIp(req)}`, 10, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = leadCaptureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  // Honeypot: a real visitor never sees or fills this field. Return a fake
  // success so a bot gets no signal it was caught.
  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true })
  }

  const { isNewCustomer } = await captureLead({
    name: data.name,
    email: data.email,
    phone: data.phone,
    interestType: data.interestType,
    productSlug: data.productSlug,
    productName: data.productName,
    productSize: data.productSize,
    message: data.message,
    sourcePage: data.sourcePage,
    referrer: data.referrer,
    landingUrl: data.landingUrl,
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    utmTerm: data.utmTerm,
    utmContent: data.utmContent,
    consent: data.consent,
  })

  // Admin notification is a courtesy on top of the already-durably-recorded
  // LeadCapture/Customer rows -- its failure never turns a successfully
  // captured lead into a 500 for the visitor.
  await sendCategorizedEmail(
    {
      category: 'LEAD_CAPTURED',
      to: CONTACT_EMAIL,
      subject: leadCapturedSubject({ name: data.name, interestType: data.interestType, sourcePage: data.sourcePage, isNewCustomer }),
      html: buildLeadCapturedHtml({
        name: data.name,
        email: data.email,
        phone: data.phone,
        interestType: data.interestType,
        productName: data.productName,
        productSize: data.productSize,
        message: data.message,
        sourcePage: data.sourcePage,
        isNewCustomer,
      }),
    },
    { actorType: 'SYSTEM' }
  )

  return NextResponse.json({ ok: true })
}
