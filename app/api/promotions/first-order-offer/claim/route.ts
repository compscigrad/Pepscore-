// POST /api/promotions/first-order-offer/claim — public, unauthenticated
// claim submission for the FIRST10 offer. Mirrors app/api/leads/route.ts's
// shape (rate limit, honeypot, admin-notification-never-blocks-success)
// but requires both email and phone (see firstOrderOfferValidation.ts) and
// enforces one claim per customer via lib/promotions/firstOrderOffer.ts.
import { NextRequest, NextResponse } from 'next/server'
import { firstOrderOfferClaimSchema, isHoneypotTripped } from '@/lib/promotions/firstOrderOfferValidation'
import { claimFirstOrderOffer, FirstOrderOfferNotLiveError } from '@/lib/promotions/firstOrderOffer'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { CONTACT_EMAIL } from '@/lib/resend'
import { leadCapturedSubject, buildLeadCapturedHtml } from '@/emails/LeadCaptured'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`first-order-offer-claim:${getClientIp(req)}`, 10, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = firstOrderOfferClaimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  // Honeypot: a real visitor never sees or fills this field. Return a fake
  // success so a bot gets no signal it was caught.
  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true, alreadyClaimed: false })
  }

  try {
    const { isNewCustomer, alreadyClaimed } = await claimFirstOrderOffer({
      name: data.name,
      email: data.email,
      phone: data.phone,
      consent: data.consent,
      sourcePage: data.sourcePage,
      referrer: data.referrer,
      landingUrl: data.landingUrl,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
    })

    // Admin notification is a courtesy on top of the already-durably-
    // recorded LeadCapture/FirstOrderOfferClaim rows -- its failure never
    // turns a successful claim into a 500 for the visitor. Skipped on a
    // repeat claim so an admin isn't re-notified for the same customer.
    if (!alreadyClaimed) {
      await sendCategorizedEmail(
        {
          category: 'LEAD_CAPTURED',
          to: CONTACT_EMAIL,
          subject: leadCapturedSubject({ name: data.name, interestType: 'FIRST_ORDER_OFFER', sourcePage: data.sourcePage, isNewCustomer }),
          html: buildLeadCapturedHtml({
            name: data.name,
            email: data.email,
            phone: data.phone,
            interestType: 'FIRST_ORDER_OFFER',
            sourcePage: data.sourcePage,
            isNewCustomer,
          }),
        },
        { actorType: 'SYSTEM' }
      )
    }

    return NextResponse.json({ ok: true, alreadyClaimed })
  } catch (err) {
    if (err instanceof FirstOrderOfferNotLiveError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[promotions/first-order-offer/claim POST]', err)
    return NextResponse.json({ error: 'Something went wrong — please try again.' }, { status: 500 })
  }
}
