import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getRolloutSafetyConfig, planRolloutBatch, type RolloutCandidate } from './rolloutSafety'

const ENV_KEYS = ['CUSTOMER_ROLLOUT_KILL_SWITCH', 'CUSTOMER_ROLLOUT_DRY_RUN', 'CUSTOMER_ROLLOUT_TEST_ALLOWLIST', 'CUSTOMER_ROLLOUT_MAX_PER_RUN'] as const
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

const REAL_LOOKING_CUSTOMERS: RolloutCandidate[] = [
  { id: 'cust1', email: 'marcus.hooks@gmail.com' },
  { id: 'cust2', email: 'roberto.cruz@msn.com' },
  { id: 'cust3', email: 'stephanie.cardoso@gmail.com' },
]

describe('getRolloutSafetyConfig', () => {
  it('defaults to dry-run true when the env var is entirely unset', () => {
    expect(getRolloutSafetyConfig().dryRun).toBe(true)
  })

  it('only leaves dry-run when the env var is the exact string "false"', () => {
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'FALSE'
    expect(getRolloutSafetyConfig().dryRun).toBe(true)
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = '0'
    expect(getRolloutSafetyConfig().dryRun).toBe(true)
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'false'
    expect(getRolloutSafetyConfig().dryRun).toBe(false)
  })

  it('kill switch defaults to off, requires the exact string "true"', () => {
    expect(getRolloutSafetyConfig().killSwitch).toBe(false)
    process.env.CUSTOMER_ROLLOUT_KILL_SWITCH = 'yes'
    expect(getRolloutSafetyConfig().killSwitch).toBe(false)
    process.env.CUSTOMER_ROLLOUT_KILL_SWITCH = 'true'
    expect(getRolloutSafetyConfig().killSwitch).toBe(true)
  })

  it('parses a comma-separated, normalized allowlist', () => {
    process.env.CUSTOMER_ROLLOUT_TEST_ALLOWLIST = ' Test@Example.com, other@example.com ,,'
    const { allowlist } = getRolloutSafetyConfig()
    expect(allowlist.has('test@example.com')).toBe(true)
    expect(allowlist.has('other@example.com')).toBe(true)
    expect(allowlist.size).toBe(2)
  })

  it('defaults maxPerRun to 25 when unset or invalid', () => {
    expect(getRolloutSafetyConfig().maxPerRun).toBe(25)
    process.env.CUSTOMER_ROLLOUT_MAX_PER_RUN = 'not-a-number'
    expect(getRolloutSafetyConfig().maxPerRun).toBe(25)
    process.env.CUSTOMER_ROLLOUT_MAX_PER_RUN = '5'
    expect(getRolloutSafetyConfig().maxPerRun).toBe(5)
  })
})

describe('planRolloutBatch — the core incident-prevention guarantee', () => {
  it('with default config (dry-run on), real-looking customers NEVER get a SEND decision', () => {
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, false)
    expect(result.haltedReason).toBeNull()
    expect(result.decisions).toHaveLength(3)
    for (const decision of result.decisions) {
      expect(decision.action).toBe('DRY_RUN_LOG')
    }
    expect(result.decisions.some((d) => d.action === 'SEND')).toBe(false)
  })

  it('the kill switch halts everything before any candidate is even evaluated, dry-run or not', () => {
    process.env.CUSTOMER_ROLLOUT_KILL_SWITCH = 'true'
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'false' // even with a "real send" config
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, false)
    expect(result.haltedReason).toBe('KILL_SWITCH')
    expect(result.decisions).toHaveLength(0)
  })

  it('pause halts everything the same way, independent of the kill switch', () => {
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, true)
    expect(result.haltedReason).toBe('PAUSED')
    expect(result.decisions).toHaveLength(0)
  })

  it('with dry-run explicitly off and no allowlist, real sends are authorized for everyone with an email', () => {
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'false'
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, false)
    expect(result.decisions.every((d) => d.action === 'SEND')).toBe(true)
  })

  it('with dry-run off and an allowlist set, only allowlisted recipients get SEND -- everyone else is blocked, not sent', () => {
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'false'
    process.env.CUSTOMER_ROLLOUT_TEST_ALLOWLIST = 'marcus.hooks@gmail.com'
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, false)
    const byId = new Map(result.decisions.map((d) => [d.customerId, d.action]))
    expect(byId.get('cust1')).toBe('SEND')
    expect(byId.get('cust2')).toBe('SKIP_NOT_ALLOWLISTED')
    expect(byId.get('cust3')).toBe('SKIP_NOT_ALLOWLISTED')
  })

  it('skips (never sends to) a candidate with no email even when live and unrestricted', () => {
    process.env.CUSTOMER_ROLLOUT_DRY_RUN = 'false'
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch([{ id: 'no-email', email: null }], config, false)
    expect(result.decisions[0].action).toBe('SKIP_NO_EMAIL')
  })

  it('never evaluates more than maxPerRun candidates, dry-run or live', () => {
    process.env.CUSTOMER_ROLLOUT_MAX_PER_RUN = '2'
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch(REAL_LOOKING_CUSTOMERS, config, false)
    expect(result.decisions).toHaveLength(2)
  })

  it('an empty candidate list produces an empty (not halted) result', () => {
    const config = getRolloutSafetyConfig()
    const result = planRolloutBatch([], config, false)
    expect(result.haltedReason).toBeNull()
    expect(result.decisions).toHaveLength(0)
  })
})
