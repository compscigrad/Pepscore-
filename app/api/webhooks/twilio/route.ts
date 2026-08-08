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
// Fails closed: with no TWILIO_AUTH_TOKEN configured there's no way to
// verify a request actually came from Twilio, so every request is rejected
// rather than trusted. Twilio expects a TwiML response body, not JSON.
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { findCustomerByPhoneFlexible, recordCustomerActivity } from '@/lib/customers'
import { prisma } from '@/lib/prisma'

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const START_KEYWORDS = new Set(['START', 'YES', 'UNSTOP'])

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
function twimlResponse(status = 200) {
  return new NextResponse(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml' } })
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
  if (!isStop && !isStart) return twimlResponse()

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
