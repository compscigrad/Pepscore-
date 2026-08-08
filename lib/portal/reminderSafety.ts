// Pure decision logic for the invitation-reminder cron's safety gates --
// brings reminder delivery up to the same fail-safe standard the initial
// bulk-invite rollout already has (lib/portal/rolloutSafety.ts, built in
// direct response to the 2026-08-06 production incident). Reminders had
// only their own on/off flag and none of dry-run/kill-switch/allowlist/cap
// -- this closes that gap without duplicating normalization logic: email
// and phone normalization are imported from lib/portal/rolloutAudience.ts,
// the one place those conventions live, rather than reimplemented here.
import { normalizeEmail, normalizePhone } from '@/lib/portal/rolloutAudience'

export interface ReminderSafetyConfig {
  killSwitch: boolean
  dryRun: boolean
  allowlist: Set<string> // normalized emails AND normalized phones, mixed in one set
  maxPerRun: number
}

const DEFAULT_MAX_PER_RUN = 25

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const out = new Set<string>()
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    // normalizeEmail() only lowercases/trims -- it doesn't validate email
    // shape -- so a phone entry must be routed to normalizePhone() by
    // its own shape ("@" present), never by whether normalizeEmail()
    // merely returned something truthy.
    if (trimmed.includes('@')) {
      const email = normalizeEmail(trimmed)
      if (email) out.add(email)
    } else {
      const phone = normalizePhone(trimmed)
      if (phone) out.add(phone)
    }
  }
  return out
}

export function getReminderSafetyConfig(): ReminderSafetyConfig {
  return {
    killSwitch: process.env.CUSTOMER_REMINDER_KILL_SWITCH === 'true',
    // Same inverted-default convention as the rollout config: unset or
    // anything but the literal string 'false' keeps dry-run ON.
    dryRun: process.env.CUSTOMER_REMINDER_DRY_RUN !== 'false',
    allowlist: parseAllowlist(process.env.CUSTOMER_REMINDER_ALLOWLIST),
    maxPerRun: Number(process.env.CUSTOMER_REMINDER_MAX_PER_RUN) || DEFAULT_MAX_PER_RUN,
  }
}

export interface ReminderCandidate {
  inviteId: string
  customerId: string
  email: string | null
  phone: string | null
}

export type ReminderDecisionAction = 'SEND' | 'DRY_RUN_LOG' | 'SKIP_NOT_ALLOWLISTED' | 'SKIP_NO_CONTACT' | 'SKIP_CAPPED'

export interface ReminderDecision {
  action: ReminderDecisionAction
  inviteId: string
  customerId: string
}

export interface ReminderBatchResult {
  // Top-level stop reasons -- when set, no candidate is evaluated at all,
  // matching planRolloutBatch's shape.
  haltedReason: 'KILL_SWITCH' | 'PAUSED' | null
  decisions: ReminderDecision[]
}

// The one function that decides what happens to each otherwise-eligible
// reminder candidate -- never touches a database or a provider. Every
// candidate always gets exactly one decision. Unlike the initial-rollout
// planner (which silently slices to maxPerRun), candidates beyond the cap
// get an explicit SKIP_CAPPED decision so nothing is silently dropped from
// the report -- the "Deferred by cap" count the spec requires.
//
// The cap counts SEND and DRY_RUN_LOG identically (both represent "this
// would actually go out on a live run"), so a dry-run preview's boundary
// always matches what a real run would actually do -- never a false
// preview of unlimited processing that a real run would then truncate.
export function planReminderBatch(
  candidates: ReminderCandidate[],
  config: ReminderSafetyConfig,
  isPaused: boolean
): ReminderBatchResult {
  if (config.killSwitch) return { haltedReason: 'KILL_SWITCH', decisions: [] }
  if (isPaused) return { haltedReason: 'PAUSED', decisions: [] }

  const decisions: ReminderDecision[] = []
  let countedTowardCap = 0

  for (const c of candidates) {
    if (countedTowardCap >= config.maxPerRun) {
      decisions.push({ action: 'SKIP_CAPPED', inviteId: c.inviteId, customerId: c.customerId })
      continue
    }

    if (config.dryRun) {
      decisions.push({ action: 'DRY_RUN_LOG', inviteId: c.inviteId, customerId: c.customerId })
      countedTowardCap++
      continue
    }

    const email = normalizeEmail(c.email)
    const phone = normalizePhone(c.phone)
    if (!email && !phone) {
      decisions.push({ action: 'SKIP_NO_CONTACT', inviteId: c.inviteId, customerId: c.customerId })
      continue
    }

    if (config.allowlist.size > 0) {
      const allowed = (email && config.allowlist.has(email)) || (phone && config.allowlist.has(phone))
      if (!allowed) {
        decisions.push({ action: 'SKIP_NOT_ALLOWLISTED', inviteId: c.inviteId, customerId: c.customerId })
        continue
      }
    }

    decisions.push({ action: 'SEND', inviteId: c.inviteId, customerId: c.customerId })
    countedTowardCap++
  }

  return { haltedReason: null, decisions }
}
