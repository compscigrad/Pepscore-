import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getReminderSafetyConfig, planReminderBatch, type ReminderCandidate } from './reminderSafety'

const ENV_KEYS = ['CUSTOMER_REMINDER_KILL_SWITCH', 'CUSTOMER_REMINDER_DRY_RUN', 'CUSTOMER_REMINDER_ALLOWLIST', 'CUSTOMER_REMINDER_MAX_PER_RUN'] as const
const original: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key]
    delete process.env[key]
  }
})
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
})

const REAL_LOOKING_CANDIDATES: ReminderCandidate[] = [
  { inviteId: 'inv1', customerId: 'cust1', email: 'marcus.hooks@gmail.com', phone: null },
  { inviteId: 'inv2', customerId: 'cust2', email: 'roberto.cruz@msn.com', phone: null },
  { inviteId: 'inv3', customerId: 'cust3', email: 'stephanie.cardoso@gmail.com', phone: '7862532797' },
]

describe('getReminderSafetyConfig', () => {
  it('defaults to dry-run true when the env var is entirely unset', () => {
    expect(getReminderSafetyConfig().dryRun).toBe(true)
  })

  it('only leaves dry-run when the env var is the exact string "false"', () => {
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'FALSE'
    expect(getReminderSafetyConfig().dryRun).toBe(true)
    process.env.CUSTOMER_REMINDER_DRY_RUN = '0'
    expect(getReminderSafetyConfig().dryRun).toBe(true)
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    expect(getReminderSafetyConfig().dryRun).toBe(false)
  })

  it('kill switch defaults to off, requires the exact string "true"', () => {
    expect(getReminderSafetyConfig().killSwitch).toBe(false)
    process.env.CUSTOMER_REMINDER_KILL_SWITCH = 'yes'
    expect(getReminderSafetyConfig().killSwitch).toBe(false)
    process.env.CUSTOMER_REMINDER_KILL_SWITCH = 'true'
    expect(getReminderSafetyConfig().killSwitch).toBe(true)
  })

  it('parses a comma-separated allowlist mixing emails and phones, normalized the same way rolloutAudience.ts does', () => {
    process.env.CUSTOMER_REMINDER_ALLOWLIST = ' Test@Example.com, (786) 253-2797 ,,'
    const { allowlist } = getReminderSafetyConfig()
    expect(allowlist.has('test@example.com')).toBe(true)
    expect(allowlist.has('7862532797')).toBe(true)
    expect(allowlist.size).toBe(2)
  })

  it('defaults maxPerRun to 25 when unset or invalid', () => {
    expect(getReminderSafetyConfig().maxPerRun).toBe(25)
    process.env.CUSTOMER_REMINDER_MAX_PER_RUN = 'not-a-number'
    expect(getReminderSafetyConfig().maxPerRun).toBe(25)
    process.env.CUSTOMER_REMINDER_MAX_PER_RUN = '5'
    expect(getReminderSafetyConfig().maxPerRun).toBe(5)
  })
})

describe('planReminderBatch — the core incident-prevention guarantee', () => {
  it('with default config (dry-run on), real-looking candidates NEVER get a SEND decision', () => {
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    expect(result.haltedReason).toBeNull()
    expect(result.decisions).toHaveLength(3)
    for (const decision of result.decisions) {
      expect(decision.action).toBe('DRY_RUN_LOG')
    }
    expect(result.decisions.some((d) => d.action === 'SEND')).toBe(false)
  })

  it('the kill switch halts everything before any candidate is evaluated, dry-run or not', () => {
    process.env.CUSTOMER_REMINDER_KILL_SWITCH = 'true'
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    expect(result.haltedReason).toBe('KILL_SWITCH')
    expect(result.decisions).toHaveLength(0)
  })

  it('pause halts everything the same way, independent of the kill switch', () => {
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, true)
    expect(result.haltedReason).toBe('PAUSED')
    expect(result.decisions).toHaveLength(0)
  })

  it('with dry-run explicitly off and no allowlist, real sends are authorized for everyone with contact info', () => {
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    expect(result.decisions.every((d) => d.action === 'SEND')).toBe(true)
  })

  it('with dry-run off and an allowlist set, only allowlisted recipients get SEND', () => {
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    process.env.CUSTOMER_REMINDER_ALLOWLIST = 'marcus.hooks@gmail.com'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    const byId = new Map(result.decisions.map((d) => [d.customerId, d.action]))
    expect(byId.get('cust1')).toBe('SEND')
    expect(byId.get('cust2')).toBe('SKIP_NOT_ALLOWLISTED')
    expect(byId.get('cust3')).toBe('SKIP_NOT_ALLOWLISTED')
  })

  it('an allowlisted phone number matches even when formatted differently than the allowlist entry', () => {
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    process.env.CUSTOMER_REMINDER_ALLOWLIST = '+1-786-253-2797'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch([{ inviteId: 'inv3', customerId: 'cust3', email: null, phone: '(786) 253-2797' }], config, false)
    expect(result.decisions[0].action).toBe('SEND')
  })

  it('skips a candidate with neither email nor phone even when live and unrestricted', () => {
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch([{ inviteId: 'inv-none', customerId: 'cust-none', email: null, phone: null }], config, false)
    expect(result.decisions[0].action).toBe('SKIP_NO_CONTACT')
  })

  it('never SENDs/DRY_RUN_LOGs more than maxPerRun candidates -- the remainder is explicitly SKIP_CAPPED, not silently dropped', () => {
    process.env.CUSTOMER_REMINDER_MAX_PER_RUN = '2'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    expect(result.decisions).toHaveLength(3)
    expect(result.decisions.filter((d) => d.action === 'DRY_RUN_LOG')).toHaveLength(2)
    expect(result.decisions.filter((d) => d.action === 'SKIP_CAPPED')).toHaveLength(1)
  })

  it('the cap applies identically in dry-run and live mode -- the preview boundary always matches what a real run would do', () => {
    process.env.CUSTOMER_REMINDER_MAX_PER_RUN = '1'
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(REAL_LOOKING_CANDIDATES, config, false)
    expect(result.decisions.filter((d) => d.action === 'SEND')).toHaveLength(1)
    expect(result.decisions.filter((d) => d.action === 'SKIP_CAPPED')).toHaveLength(2)
  })

  it('a skipped (no-contact) candidate does not consume a cap slot', () => {
    process.env.CUSTOMER_REMINDER_MAX_PER_RUN = '1'
    process.env.CUSTOMER_REMINDER_DRY_RUN = 'false'
    const config = getReminderSafetyConfig()
    const result = planReminderBatch(
      [
        { inviteId: 'inv-none', customerId: 'cust-none', email: null, phone: null },
        { inviteId: 'inv1', customerId: 'cust1', email: 'marcus.hooks@gmail.com', phone: null },
      ],
      config,
      false
    )
    // The no-contact candidate is skipped for lack of contact info, not
    // capped -- it must never consume the one real send slot, so the
    // second (real) candidate still gets through.
    const byId = new Map(result.decisions.map((d) => [d.customerId, d.action]))
    expect(byId.get('cust-none')).toBe('SKIP_NO_CONTACT')
    expect(byId.get('cust1')).toBe('SEND')
  })

  it('an empty candidate list produces an empty (not halted) result', () => {
    const config = getReminderSafetyConfig()
    const result = planReminderBatch([], config, false)
    expect(result.haltedReason).toBeNull()
    expect(result.decisions).toHaveLength(0)
  })
})
