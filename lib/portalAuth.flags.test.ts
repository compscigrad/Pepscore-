import { describe, it, expect, afterEach } from 'vitest'
import {
  isSelfRegistrationEnabled,
  isAutoInvitesEnabled,
  isSmsInvitesEnabled,
  isInviteRemindersEnabled,
} from './portalAuth'

const FLAGS = [
  ['CUSTOMER_SELF_REGISTRATION_ENABLED', isSelfRegistrationEnabled] as const,
  ['CUSTOMER_AUTO_INVITES_ENABLED', isAutoInvitesEnabled] as const,
  ['CUSTOMER_SMS_INVITES_ENABLED', isSmsInvitesEnabled] as const,
  ['CUSTOMER_INVITE_REMINDERS_ENABLED', isInviteRemindersEnabled] as const,
]

describe.each(FLAGS)('%s', (envVar, check) => {
  const original = process.env[envVar]

  afterEach(() => {
    if (original === undefined) delete process.env[envVar]
    else process.env[envVar] = original
  })

  it('defaults to disabled when unset', () => {
    delete process.env[envVar]
    expect(check()).toBe(false)
  })

  it('stays disabled for any value other than the literal string "true"', () => {
    process.env[envVar] = 'false'
    expect(check()).toBe(false)
    process.env[envVar] = '1'
    expect(check()).toBe(false)
  })

  it('is enabled only once explicitly flipped to "true"', () => {
    process.env[envVar] = 'true'
    expect(check()).toBe(true)
  })
})
