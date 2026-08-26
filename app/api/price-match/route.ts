// POST /api/price-match -- public, unauthenticated submission endpoint for
// the Price Match Guarantee request form (2026-08-20 Price Match sprint).
// See lib/priceMatch/requests.ts for the Customer-linking + review-queue
// logic; the database row this creates is the system of record, never the
// admin alert email this also sends.
//
// Accepts multipart/form-data (not JSON) -- the form always posts a
// FormData body, whether or not a proof file is attached, since a File can
// only travel inside multipart. Text fields arrive as strings regardless of
// their real type (numbers, the consent checkbox), so they're explicitly
// coerced here before validation -- the zod schema itself still expects
// real types, matching the JSON-based schema every other public intake
// endpoint uses.
import { NextRequest, NextResponse } from 'next/server'
import { priceMatchRequestSchema, isHoneypotTripped } from '@/lib/priceMatch/validation'
import { submitPriceMatchRequest, PriceMatchError, type SubmitPriceMatchRequestProofFile } from '@/lib/priceMatch/requests'
import { validateProofFile, ProofFileValidationError } from '@/lib/priceMatch/proofUpload'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

function stringField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberField(formData: FormData, key: string): number | undefined {
  const raw = stringField(formData, key)
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : NaN // NaN deliberately passed through so zod's .finite() rejects it with a real error, not a silent undefined
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = checkRateLimit(`price-match-submit:${ip}`, 5, 10 * 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a few minutes and try again.' }, { status: 429 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })
  }

  const payload = {
    contactName: stringField(formData, 'contactName'),
    contactEmail: stringField(formData, 'contactEmail'),
    contactPhone: stringField(formData, 'contactPhone'),
    preferredContactMethod: stringField(formData, 'preferredContactMethod'),
    productId: stringField(formData, 'productId'),
    sellUnit: stringField(formData, 'sellUnit'),
    competitorName: stringField(formData, 'competitorName'),
    competitorUrl: stringField(formData, 'competitorUrl'),
    competitorPrice: numberField(formData, 'competitorPrice'),
    competitorShippingCost: numberField(formData, 'competitorShippingCost'),
    competitorDeliveredPrice: numberField(formData, 'competitorDeliveredPrice'),
    proofUrl: stringField(formData, 'proofUrl'),
    proofNote: stringField(formData, 'proofNote'),
    customerNote: stringField(formData, 'customerNote'),
    sourcePage: stringField(formData, 'sourcePage'),
    referrer: stringField(formData, 'referrer') ?? null,
    landingUrl: stringField(formData, 'landingUrl') ?? null,
    consent: stringField(formData, 'consent') === 'true',
    website2: stringField(formData, 'website2'),
  }

  const parsed = priceMatchRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  if (isHoneypotTripped(data)) {
    return NextResponse.json({ ok: true })
  }

  // Proof file is entirely optional and never mutually exclusive with
  // competitorUrl -- a submission may include either, both, or neither.
  // Validated (real content-sniffed, size-capped) before the request is
  // ever created; an invalid file rejects the whole submission with a
  // clear message rather than silently dropping it and proceeding.
  let proofFile: SubmitPriceMatchRequestProofFile | undefined
  const uploaded = formData.get('proofFile')
  if (uploaded instanceof File && uploaded.size > 0) {
    try {
      const buffer = Buffer.from(await uploaded.arrayBuffer())
      const validated = validateProofFile(uploaded.name, uploaded.type, buffer)
      proofFile = { fileName: validated.fileName, mimeType: validated.mimeType, buffer: validated.buffer }
    } catch (err) {
      if (err instanceof ProofFileValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  }

  try {
    await submitPriceMatchRequest({
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      preferredContactMethod: data.preferredContactMethod,
      productId: data.productId,
      sellUnit: data.sellUnit,
      competitorName: data.competitorName,
      competitorUrl: data.competitorUrl,
      competitorPrice: data.competitorPrice,
      competitorShippingCost: data.competitorShippingCost,
      competitorDeliveredPrice: data.competitorDeliveredPrice,
      proofUrl: data.proofUrl,
      proofNote: data.proofNote,
      proofFile,
      customerNote: data.customerNote,
      sourcePage: data.sourcePage,
      referrer: data.referrer,
      landingUrl: data.landingUrl,
      consent: data.consent,
      ipAddress: ip,
    })
  } catch (err) {
    if (err instanceof PriceMatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
