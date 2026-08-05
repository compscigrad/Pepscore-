import { describe, it, expect } from 'vitest'
import { extractBareEmail } from './resend'

// Regression test: RESEND_FROM_EMAIL was set in production to a full
// "Name <email>" string (following this file's own now-corrected comment),
// which lib/notifications/routing.ts's routeFor() then wrapped in *another*
// "<Display Name> <...>" — Resend rejected the resulting double-wrapped
// From header with "Invalid `from` field" on every real send until this was
// fixed. FROM_EMAIL must always resolve to a bare address no matter which
// format the env var holds.
describe('extractBareEmail', () => {
  it('returns a bare email address unchanged', () => {
    expect(extractBareEmail('orders@pepscorelab.com')).toBe('orders@pepscorelab.com')
  })

  it('extracts the email from a "Name <email>" formatted string', () => {
    expect(extractBareEmail('Pepscore Orders <orders@pepscorelab.com>')).toBe('orders@pepscorelab.com')
  })

  it('trims incidental whitespace', () => {
    expect(extractBareEmail('  orders@pepscorelab.com  ')).toBe('orders@pepscorelab.com')
  })
})
