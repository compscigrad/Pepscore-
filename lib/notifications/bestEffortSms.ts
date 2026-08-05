// Shared "attempt SMS, never throw" helper for every payment-workflow
// notification (client invoice-ready, admin pay-in-full/arrangement alerts,
// client arrangement decision emails). Mirrors lib/notifications/channels/
// sms.ts's safe-stub shape and lib/intake/delivery.ts's normalization/config
// check, but centralizes the actual Twilio call so none of the new
// notification functions duplicate that boilerplate. Missing/invalid Twilio
// config, or any send failure, is caught here and reported back as a result
// — it never propagates to the caller, matching Section 8's "SMS failure
// must never block a business operation" rule.
export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
}

// Best-effort US/CA normalization to E.164 — Twilio rejects anything else.
// Numbers that don't match a recognizable 10/11-digit US pattern are passed
// through as-is so an already-E.164 international number isn't mangled.
export function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw.startsWith('+') ? raw : `+${digits}`
}

export type SmsOutcome = 'SENT' | 'SKIPPED_NOT_CONFIGURED' | 'SKIPPED_NO_PHONE' | 'FAILED'

export interface SmsAttemptResult {
  outcome: SmsOutcome
  failureReason?: string
}

export async function attemptSms(phone: string | null | undefined, body: string): Promise<SmsAttemptResult> {
  if (!phone) return { outcome: 'SKIPPED_NO_PHONE' }
  if (!isSmsConfigured()) return { outcome: 'SKIPPED_NOT_CONFIGURED' }

  try {
    // Lazy import: avoids requiring TWILIO_* at module-load time in
    // environments (tests, build) that never actually send SMS.
    const twilio = (await import('twilio')).default
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    await client.messages.create({
      to: normalizePhoneToE164(phone),
      from: process.env.TWILIO_PHONE_NUMBER!,
      body,
    })
    return { outcome: 'SENT' }
  } catch (err) {
    // Never leak raw Twilio/provider error detail to a client-facing
    // surface — this is logged server-side only; callers persist just the
    // outcome + a short reason for admin review.
    console.error('[notifications/bestEffortSms] send failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown SMS provider error'
    return { outcome: 'FAILED', failureReason: message }
  }
}
