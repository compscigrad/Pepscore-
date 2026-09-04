// POST /api/webhooks/twilio — inbound SMS webhook. Register this URL as the
// "A MESSAGE COMES IN" webhook on the Twilio phone number / Messaging
// Service once TWILIO_* is configured (see docs/Decisions.md #27's owner
// checklist). Twilio's own carrier-level Advanced Opt-Out already blocks
// future sends to a number that's replied STOP -- this webhook exists so
// that fact is also recorded in *our* database (Customer.smsOptedOut),
// which is what lib/notifications/log.ts's sendCategorizedSms() actually
// checks before every customer-facing send, and so an admin can see opt-in/
// opt-out status on the customer profile instead of only in Twilio's console.
//
// HELP (2026-09-04 Twilio sprint) replies with a generic, campaign-agnostic
// message (see HELP_REPLY below) -- Twilio's own Advanced Opt-Out feature
// already auto-replies to HELP at the carrier level too, but recording it
// here matches STOP/START's own "also handle it ourselves, don't rely
// solely on Twilio's default" precedent. The campaign-specific HELP
// behavior A2P registration may eventually ask for is a separate, later
// decision -- not blocked by, or blocking, this generic reply.
//
// Fails closed: with no TWILIO_AUTH_TOKEN configured there's no way to
// verify a request actually came from Twilio, so every request is rejected
// rather than trusted. Twilio expects a TwiML response body, not JSON.
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { findCustomerByPhoneFlexible, recordCustomerActivity } from '@/lib/customers'
import { prisma } from '@/lib/prisma'
import { SUPPORT_EMAIL } from '@/lib/resend'

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const START_KEYWORDS = new Set(['START', 'YES', 'UNSTOP'])
const HELP_KEYWORDS = new Set(['HELP', 'INFO'])

// 2026-09-04 Twilio sprint (item 13): deliberately brand-generic, not tied
// to any specific message type/campaign -- this is the one piece of HELP
// behavior that's safe to ship before A2P Brand/Campaign registration,
// because it names no campaign-specific content that registration could
// later contradict. The exact HELP copy Twilio's Campaign Registry asks for
// at registration time (which use cases, which keywords trigger it) is a
// separate, later step -- this generic reply is NOT that, and registering a
// campaign later does not require changing this string first.
const HELP_REPLY = `Pepscore Lab: For help, email ${SUPPORT_EMAIL}. Msg&data rates may apply. Reply STOP to unsubscribe.`

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
function twimlResponse(status = 200) {
  return new NextResponse(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml' } })
}
function twimlMessage(body: string, status = 200) {
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
  return new NextResponse(xml, { status, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    return NextResponse.json({ error: 'SMS webhook not configured' }, { status: 404 })
  }

  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  const signature = req.headers.get('x-twilio-signature') ?? ''
  const valid = twilio.validateRequest(authToken, signature, req.url, params)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const from = params.From
  const body = (params.Body ?? '').trim().toUpperCase()
  if (!from || !body) return twimlResponse()

  const isStop = STOP_KEYWORDS.has(body)
  const isStart = START_KEYWORDS.has(body)
  const isHelp = HELP_KEYWORDS.has(body)
  if (!isStop && !isStart && !isHelp) return twimlResponse()

  if (isHelp) return twimlMessage(HELP_REPLY)

  const customer = await findCustomerByPhoneFlexible(from)
  if (!customer) return twimlResponse()

  const nextOptedOut = isStop
  if (customer.smsOptedOut === nextOptedOut) return twimlResponse()

  await prisma.customer.update({ where: { id: customer.id }, data: { smsOptedOut: nextOptedOut } })
  await recordCustomerActivity({
    customerId: customer.id,
    eventType: nextOptedOut ? 'SMS_OPTED_OUT' : 'SMS_OPTED_IN',
    newValue: body,
    source: 'WEBHOOK',
  })

  return twimlResponse()
}
