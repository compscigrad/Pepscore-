// PortalRolloutSettings accessor — a one-row singleton whose existence *is*
// the real-world trigger for the automated bulk-invitation cron
// (app/api/cron/portal-invite-rollout/route.ts). Nothing in this file ever
// sets activatedAt on its own; that only happens through
// activatePortalRollout(), called exactly once from the admin-only
// POST /api/admin/portal-rollout route after a human reviews the
// launch-readiness report. See docs/ProductRoadmap.md's launch-checkpoint
// requirement — this is the "exact control that triggers real rollout."
import { prisma } from '@/lib/prisma'
import type { PortalRolloutSettings } from '@prisma/client'
import { computeEligibleInviteAudience } from '@/lib/portal/rolloutAudience'

// findFirst, not a hardcoded id — there is deliberately no seed/migration
// creating this row, so "no row yet" and "not activated" mean the same
// thing until the first (and only ever) activation call creates it.
export async function getPortalRolloutSettings(): Promise<PortalRolloutSettings | null> {
  return prisma.portalRolloutSettings.findFirst({ orderBy: { id: 'asc' } })
}

export async function isPortalRolloutActive(): Promise<boolean> {
  const settings = await getPortalRolloutSettings()
  return Boolean(settings?.activatedAt)
}

export async function isPortalRolloutPaused(): Promise<boolean> {
  const settings = await getPortalRolloutSettings()
  return Boolean(settings?.pausedAt)
}

// The exact customer ids the admin actually saw and approved at the moment
// of activation — never recomputed afterward. Returns null if the rollout
// was never activated (nothing to read yet).
export async function getAudienceSnapshotIds(): Promise<string[] | null> {
  const settings = await getPortalRolloutSettings()
  if (!settings?.audienceSnapshot) return null
  return settings.audienceSnapshot as string[]
}

export class PortalRolloutError extends Error {}

// Idempotent by design: once activated, a second call is a no-op that
// returns the existing (first) activation record rather than erroring —
// there is exactly one real go-ahead moment, and re-clicking a stale tab
// must never look like a second decision. The eligible-audience id list is
// snapshotted here, at the moment of approval, and never touched again —
// see this file's header comment and lib/portal/rolloutSafety.ts.
export async function activatePortalRollout(adminUserId: string): Promise<PortalRolloutSettings> {
  const existing = await getPortalRolloutSettings()
  if (existing?.activatedAt) return existing

  const audience = await computeEligibleInviteAudience()
  const audienceSnapshot = audience.eligible.map((c) => c.id)

  if (existing) {
    return prisma.portalRolloutSettings.update({
      where: { id: existing.id },
      data: { activatedAt: new Date(), activatedBy: adminUserId, audienceSnapshot },
    })
  }
  return prisma.portalRolloutSettings.create({
    data: { activatedAt: new Date(), activatedBy: adminUserId, audienceSnapshot },
  })
}

// Pause/resume — a softer, admin-facing stop than deactivation: the batch
// stops on the next cron tick but the activation record (and its audience
// snapshot) stays intact, so resuming doesn't re-open the approval gate.
export async function pauseRollout(adminUserId: string): Promise<PortalRolloutSettings> {
  const existing = await getPortalRolloutSettings()
  if (!existing?.activatedAt) throw new PortalRolloutError('Rollout has not been activated — nothing to pause.')
  return prisma.portalRolloutSettings.update({
    where: { id: existing.id },
    data: { pausedAt: new Date(), pausedBy: adminUserId },
  })
}

export async function resumeRollout(): Promise<PortalRolloutSettings> {
  const existing = await getPortalRolloutSettings()
  if (!existing?.pausedAt) throw new PortalRolloutError('Rollout is not currently paused.')
  return prisma.portalRolloutSettings.update({
    where: { id: existing.id },
    data: { pausedAt: null, pausedBy: null },
  })
}
