import { describe, it, expect } from 'vitest'
import { firstOrderOfferClaimSchema } from './firstOrderOfferValidation'

describe('firstOrderOfferClaimSchema email normalization', () => {
  // 2026-08-12: same fix/reason as lib/leads/validation.test.ts -- case-
  // only email variants previously bypassed the exact-match dedup lookup,
  // letting the same person claim the offer twice under "Foo@X.com" and
  // "foo@x.com".
  it('lowercases and trims the email', () => {
    const result = firstOrderOfferClaimSchema.parse({
      name: 'Test User',
      email: '  Foo.Bar@EXAMPLE.com  ',
      phone: '3055551212',
      emailConsent: true,
      sourcePage: '/',
    })
    expect(result.email).toBe('foo.bar@example.com')
  })

  it('still rejects an invalid email after normalization', () => {
    expect(() =>
      firstOrderOfferClaimSchema.parse({
        name: 'Test User',
        email: 'not-an-email',
        phone: '3055551212',
        emailConsent: true,
        sourcePage: '/',
      })
    ).toThrow()
  })
})

describe('firstOrderOfferClaimSchema email/SMS consent split (2026-08-19)', () => {
  const base = { name: 'Test User', email: 'test@example.com', phone: '3055551212', sourcePage: '/' }

  it('requires emailConsent to be explicitly true', () => {
    expect(() => firstOrderOfferClaimSchema.parse({ ...base, emailConsent: false })).toThrow()
    expect(() => firstOrderOfferClaimSchema.parse(base)).toThrow()
  })

  it('smsConsent defaults to false when omitted -- never inferred from phone number possession', () => {
    const result = firstOrderOfferClaimSchema.parse({ ...base, emailConsent: true })
    expect(result.smsConsent).toBe(false)
  })

  it('accepts an explicit smsConsent: true independently of emailConsent', () => {
    const result = firstOrderOfferClaimSchema.parse({ ...base, emailConsent: true, smsConsent: true })
    expect(result.emailConsent).toBe(true)
    expect(result.smsConsent).toBe(true)
  })
})
