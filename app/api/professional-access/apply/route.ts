// POST /api/professional-access/apply — public, unauthenticated submission
// endpoint for the Professional Access application (2026-08-19 Professional
// Access sprint, section 10). See lib/professionalAccess/applications.ts for
// the Customer-linking + review-queue logic.
import { NextRequest, NextResponse } from 'next/server'
import { professionalAccessApplicationSchema, isHoneypotTripped } from '@/lib/professionalAccess/validation'
import { submitProfessionalAccessApplication } from '@/lib/professionalAccess/applications'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`professional-access-apply:${getClientIp(req)}`, 5, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = professionalAccessApplicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true })
  }

  await submitProfessionalAccessApplication({
    contactName: data.contactName,
    businessName: data.businessName,
    businessEmail: data.businessEmail,
    phone: data.phone,
    website: data.website,
    businessType: data.businessType,
    businessAddress: data.businessAddress,
    jurisdiction: data.jurisdiction,
    registrationInfo: data.registrationInfo,
    purposeDescription: data.purposeDescription,
    expectedVolume: data.expectedVolume,
    sourcePage: data.sourcePage,
    referrer: data.referrer,
    landingUrl: data.landingUrl,
    consent: data.consent,
  })

  return NextResponse.json({ ok: true })
}
