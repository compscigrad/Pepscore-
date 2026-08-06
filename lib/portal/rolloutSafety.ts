// Pure decision logic for the automated-rollout cron's safety gates --
// separated from app/api/cron/portal-invite-rollout/route.ts's DB/provider
// I/O so it's unit-testable without a database, matching this repo's
// established pure-logic convention (lib/invoice/statusBackfill.ts,
// lib/customers/linkageBackfill.ts).
//
// Built in direct response to the 2026-08-06 production incident: a
// rehearsal script called the real rollout cron handler against the real
// shared database and sent real invite emails to real customers (Resend's
// sandbox restriction was the only thing that stopped delivery -- not
// anything this codebase did on purpose). Every gate below exists so that
// mistake is structurally impossible to repeat, not just procedurally
// avoided:
//   - DRY_RUN defaults to true (safe) -- a fresh checkout, a forgotten env
//     var, or a rehearsal script that never sets it stays inert.
//   - The kill switch is checked before anything else and needs no DB
//     write to take effect.
//   - The allowlist means even a *real*, intentionally-authorized
//     (non-dry-run) run can be scoped to only synthetic/owner-controlled
//     recipients while the rest of the system is exercised for real.
export interface RolloutSafetyConfig {
  killSwitch: boolean
  dryRun: boolean
  allowlist: Set<string>
  maxPerRun: number
}

const DEFAULT_MAX_PER_RUN = 25

function normalizeEmail(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase()
  return t || null
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((e) => normalizeEmail(e))
      .filter((e): e is string => Boolean(e))
  )
}

export function getRolloutSafetyConfig(): RolloutSafetyConfig {
  return {
    killSwitch: process.env.CUSTOMER_ROLLOUT_KILL_SWITCH === 'true',
    // Inverted default on purpose: unset/anything-but-the-literal-string
    // 'false' means dry-run stays ON. Going live requires a deliberate,
    // exact opt-out, not the absence of an opt-in.
    dryRun: process.env.CUSTOMER_ROLLOUT_DRY_RUN !== 'false',
    allowlist: parseAllowlist(process.env.CUSTOMER_ROLLOUT_TEST_ALLOWLIST),
    maxPerRun: Number(process.env.CUSTOMER_ROLLOUT_MAX_PER_RUN) || DEFAULT_MAX_PER_RUN,
  }
}

export interface RolloutCandidate {
  id: string
  email: string | null
}

export type RolloutDecisionAction = 'SEND' | 'DRY_RUN_LOG' | 'SKIP_NOT_ALLOWLISTED' | 'SKIP_NO_EMAIL'

export interface RolloutDecision {
  action: RolloutDecisionAction
  customerId: string
  email: string | null
}

export interface RolloutBatchResult {
  // Top-level stop reasons -- when set, no candidate is evaluated at all.
  haltedReason: 'KILL_SWITCH' | 'PAUSED' | null
  decisions: RolloutDecision[]
}

// The one function that decides, for a batch of otherwise-eligible
// candidates, what actually happens to each -- never touches a database or
// a provider itself. Every candidate always gets exactly one of: SEND
// (real invite + real send), DRY_RUN_LOG (computed, logged, nothing
// written or sent), SKIP_NOT_ALLOWLISTED (a real send was authorized but
// this specific recipient isn't on the allowlist), or SKIP_NO_EMAIL.
export function planRolloutBatch(
  candidates: RolloutCandidate[],
  config: RolloutSafetyConfig,
  isPaused: boolean
): RolloutBatchResult {
  if (config.killSwitch) return { haltedReason: 'KILL_SWITCH', decisions: [] }
  if (isPaused) return { haltedReason: 'PAUSED', decisions: [] }

  const batch = candidates.slice(0, config.maxPerRun)
  const decisions = batch.map((c): RolloutDecision => {
    const email = normalizeEmail(c.email)

    if (config.dryRun) {
      return { action: 'DRY_RUN_LOG', customerId: c.id, email }
    }
    if (!email) {
      return { action: 'SKIP_NO_EMAIL', customerId: c.id, email: null }
    }
    if (config.allowlist.size > 0 && !config.allowlist.has(email)) {
      return { action: 'SKIP_NOT_ALLOWLISTED', customerId: c.id, email }
    }
    return { action: 'SEND', customerId: c.id, email }
  })

  return { haltedReason: null, decisions }
}
