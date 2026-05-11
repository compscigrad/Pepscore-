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

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'orders@pepscore.com'
