// POST /api/webhooks/twilio/status — outbound delivery status callback.
// Register this URL as the "STATUS CALLBACK URL" on the Twilio phone
// number / Messaging Service once TWILIO_* is configured (mirrors the
// inbound webhook one directory up, same signature-verification
// discipline). Twilio calls this once per status transition for every
// message sent with a statusCallback param — bestEffortSms.ts sets that
// param to this route's absolute URL on every send, so every real customer-
// or admin-facing SMS this codebase sends gets its delivery lifecycle
// (queued -> sent -> delivered, or failed/undelivered) recorded here.
//
// Fails closed exactly like the inbound webhook: no TWILIO_AUTH_TOKEN means
// there's no way to verify the request actually came from Twilio, so it's
// rejected rather than trusted. Twilio expects a 2xx response with no
// particular body — an empty 200 is sufficient (no TwiML needed here,
// unlike the inbound webhook, since this isn't a reply-eligible message).
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    return NextResponse.json({ error: 'SMS status webhook not configured' }, { status: 404 })
  }

  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  const signature = req.headers.get('x-twilio-signature') ?? ''
  const valid = twilio.validateRequest(authToken, signature, req.url, params)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // MessageSid is what bestEffortSms.ts's client.messages.create() call
  // returns and Communication.providerMessageId already stores it as —
  // this is the join key between a Twilio callback and our own send record.
  const messageSid = params.MessageSid
  const messageStatus = params.MessageStatus // queued | sent | delivered | failed | undelivered (Twilio's own enum, not ours)
  if (!messageSid || !messageStatus) return NextResponse.json({ ok: true })

  // Never throws on a redelivered/out-of-order callback or an unknown SID
  // (a status callback for a message this codebase didn't send, or one from
  // before this feature existed) — updateMany is a safe no-op rather than
  // an error in either case.
  await prisma.communication.updateMany({
    where: { providerMessageId: messageSid },
    data: {
      providerStatus: messageStatus,
      providerStatusAt: new Date(),
      // Only overwrite failureReason on a genuine delivery failure — a
      // routine queued/sent/delivered callback must never blank out a
      // failureReason a prior FAILED send already recorded.
      ...(messageStatus === 'failed' || messageStatus === 'undelivered'
        ? { failureReason: params.ErrorMessage || (params.ErrorCode ? `Twilio error ${params.ErrorCode}` : messageStatus) }
        : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
