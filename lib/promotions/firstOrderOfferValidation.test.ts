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
      consent: true,
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
        consent: true,
        sourcePage: '/',
      })
    ).toThrow()
  })
})
