import { describe, expect, it, afterEach, vi } from 'vitest'
import { isSmsConfigured, normalizePhoneToE164 } from './delivery'

describe('normalizePhoneToE164', () => {
  it('formats a 10-digit US number', () => {
    expect(normalizePhoneToE164('5551234567')).toBe('+15551234567')
  })

  it('formats a 10-digit US number with punctuation', () => {
    expect(normalizePhoneToE164('(555) 123-4567')).toBe('+15551234567')
  })

  it('formats an 11-digit number already prefixed with country code 1', () => {
    expect(normalizePhoneToE164('15551234567')).toBe('+15551234567')
  })

  it('passes through an already-E.164 international number unchanged', () => {
    expect(normalizePhoneToE164('+442071234567')).toBe('+442071234567')
  })
})

describe('isSmsConfigured', () => {
  const ORIGINAL_ENV = process.env

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.unstubAllEnvs()
  })

  it('is false when no Twilio env vars are set', () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '')
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    vi.stubEnv('TWILIO_PHONE_NUMBER', '')
    expect(isSmsConfigured()).toBe(false)
  })

  it('is false when only some Twilio env vars are set', () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123')
    vi.stubEnv('TWILIO_AUTH_TOKEN', '')
    vi.stubEnv('TWILIO_PHONE_NUMBER', '')
    expect(isSmsConfigured()).toBe(false)
  })

  it('is true when all three Twilio env vars are set', () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123')
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567')
    expect(isSmsConfigured()).toBe(true)
  })
})
