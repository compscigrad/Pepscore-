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

// One sender identity for every transactional customer email — deliberately
// not split per email type (invoice vs. shipping vs. intake): the mailbox
// architecture varies Reply-To by context instead, not the From address, per
// the single-sending-system decision. Falls back to Resend's own shared
// sandbox address — safe to send from even with no domain verified yet,
// unlike a made-up address on a domain we don't control. Once
// pepscorelab.com is verified in Resend, set RESEND_FROM_EMAIL to the bare
// address (e.g. "orders@pepscorelab.com") — lib/notifications/routing.ts's
// routeFor() wraps this in its own "<Display Name> <email>" From header per
// category, so a "Name <email>" value here would double-wrap into an
// invalid From header — confirmed live in production: Resend rejected the
// resulting double-wrapped address with "Invalid `from` field". Since a
// misconfigured env var can silently break every outbound email until
// someone notices, extractBareEmail() below makes FROM_EMAIL always resolve
// to a bare address regardless of which format the env var actually holds.
export function extractBareEmail(value: string): string {
  const match = value.match(/<([^>]+)>/)
  return (match ? match[1] : value).trim()
}
export const FROM_EMAIL = extractBareEmail(process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev')

// The five real pepscorelab.com mailboxes. Each is a distinct Google
// Workspace inbox; none are aliases of each other. Only ever used as display
// text or a Reply-To header — never as the SMTP sender (that's FROM_EMAIL
// above) — so none of these depend on Resend domain verification.
export const ORDERS_EMAIL = process.env.ORDERS_EMAIL ?? 'orders@pepscorelab.com'
export const BILLING_EMAIL = process.env.BILLING_EMAIL ?? 'billing@pepscorelab.com'
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'contact@pepscorelab.com'
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@pepscorelab.com'

// The owner/operator's own address — used as the suggested default when
// adding the first Admin Notification Recipient, and as the sender/footer
// address on internal (admin-facing, not customer-facing) system emails.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@pepscorelab.com'

// Default Reply-To for any send site without a more specific context —
// individual templates override with BILLING_EMAIL/CONTACT_EMAIL directly
// where a more specific mailbox applies (see docs/Decisions.md).
export const RESEND_REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL ?? SUPPORT_EMAIL
