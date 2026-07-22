// Resend email client — lazy initialization
import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('Missing RESEND_API_KEY environment variable')
    _resend = new Resend(key)
  }
  return _resend
}

// Convenience re-export for backwards compatibility
export const resend = {
  emails: {
    send: (params: Parameters<Resend['emails']['send']>[0]) => getResend().emails.send(params),
  },
}

// Falls back to Resend's own shared sandbox address — safe to send from
// even with no domain verified yet, unlike a made-up address on a domain we
// don't control. Once pepscorelab.com is verified in Resend, set
// RESEND_FROM_EMAIL in the environment; no code change needed here.
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// Customer-facing reply-to/support address shown in every outbound email
// footer — the single source so it's never repeated (or drifts) across
// templates. Doesn't depend on Resend domain verification since it's only
// ever used as display text / a Reply-To header, never as the SMTP sender.
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'contact@pepscorelab.com'
