// POST /api/admin/portal-rollout — { action: 'activate' | 'pause' | 'resume' }.
// 'activate' is the one action this entire codebase treats as
// irreversible-in-spirit: once set, the portal-invite-rollout cron starts
// actually sending real customers real invitations on its next run
// (subject to the CUSTOMER_ROLLOUT_DRY_RUN/KILL_SWITCH/TEST_ALLOWLIST
// safeguards in lib/portal/rolloutSafety.ts). 'pause'/'resume' are a
// softer, reversible stop that doesn't touch the activation record or its
// approved audience snapshot. See lib/portal/rollout.ts.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { activatePortalRollout, pauseRollout, resumeRollout, PortalRolloutError } from '@/lib/portal/rollout'

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
])

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = patchSchema.parse(await req.json())

    switch (payload.action) {
      case 'activate': {
        const settings = await activatePortalRollout(userId!)
        await prisma.adminAuditLog.create({
          data: { action: 'ACTIVATE_PORTAL_ROLLOUT', entity: 'PortalRolloutSettings', entityId: settings.id, adminId: userId! },
        })
        return NextResponse.json(settings)
      }
      case 'pause': {
        const settings = await pauseRollout(userId!)
        await prisma.adminAuditLog.create({
          data: { action: 'PAUSE_PORTAL_ROLLOUT', entity: 'PortalRolloutSettings', entityId: settings.id, adminId: userId! },
        })
        return NextResponse.json(settings)
      }
      case 'resume': {
        const settings = await resumeRollout()
        await prisma.adminAuditLog.create({
          data: { action: 'RESUME_PORTAL_ROLLOUT', entity: 'PortalRolloutSettings', entityId: settings.id, adminId: userId! },
        })
        return NextResponse.json(settings)
      }
    }
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof PortalRolloutError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/portal-rollout POST]', err)
    return NextResponse.json({ error: 'Failed to update rollout state' }, { status: 400 })
  }
}
