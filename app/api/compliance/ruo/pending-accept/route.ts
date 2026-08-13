// POST /api/compliance/ruo/pending-accept -- records a pre-signup RUO/21+
// gate acceptance for a visitor who does NOT yet have a Clerk session
// (2026-08-12 pre-signup RUO gate). Deliberately public/unauthenticated --
// that's the entire point of this route -- so it's rate-limited by IP
// rather than by user, and validates the exact two required affirmations
// server-side rather than trusting a client-only flag (a request with
// ageConfirmed/agreementConfirmed missing or false is rejected the same as
// one with neither sent at all).
//
// The opaque pendingToken this route mints is carried in an HttpOnly,
// Secure, SameSite=Lax cookie -- readable by the server (app/sign-up and
// app/account) but never by page JavaScript, and capped at the same TTL
// PENDING_RUO_TTL_MS enforces server-side in lib/compliance/ruo.ts, so an
// expired cookie and an expired DB row age out together.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { recordRuoAcceptance, RUO_PENDING_COOKIE, PENDING_RUO_TTL_SECONDS } from '@/lib/compliance/ruo'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { trackServerEvent } from '@/lib/analytics/serverTrack'
import { AnalyticsEvent } from '@/lib/analytics/events'

const bodySchema = z.object({
  ageConfirmed: z.literal(true),
  agreementConfirmed: z.literal(true),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`ruo-pending-accept:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment.' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Both the age and RUO agreement checkboxes must be checked.' }, { status: 400 })
  }

  const pendingToken = randomUUID()
  await recordRuoAcceptance({
    sessionId: pendingToken,
    source: 'pre_signup',
    ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })
  void trackServerEvent(AnalyticsEvent.SIGNUP_GATE_ACCEPTED, {})

  const res = NextResponse.json({ success: true })
  res.cookies.set(RUO_PENDING_COOKIE, pendingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PENDING_RUO_TTL_SECONDS,
  })
  return res
}
