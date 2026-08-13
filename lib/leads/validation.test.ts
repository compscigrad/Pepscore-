import { describe, it, expect } from 'vitest'
import { leadCaptureSchema } from './validation'

describe('leadCaptureSchema email normalization', () => {
  // 2026-08-12: previously only .trim()'d, so "Foo@X.com" and "foo@x.com"
  // normalized to two different strings and could each create a separate
  // Customer record for the same real person, defeating dedup.
  it('lowercases the email', () => {
    const result = leadCaptureSchema.parse({
      name: 'Test User',
      email: 'Foo.Bar@EXAMPLE.com',
      interestType: 'GENERAL_UPDATES',
      sourcePage: '/',
      consent: true,
    })
    expect(result.email).toBe('foo.bar@example.com')
  })

  it('trims whitespace and lowercases together', () => {
    const result = leadCaptureSchema.parse({
      name: 'Test User',
      email: '  Foo@Bar.COM  ',
      interestType: 'GENERAL_UPDATES',
      sourcePage: '/',
      consent: true,
    })
    expect(result.email).toBe('foo@bar.com')
  })
})
