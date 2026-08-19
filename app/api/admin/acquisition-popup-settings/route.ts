// GET  /api/admin/acquisition-popup-settings — read the singleton settings row
// PATCH /api/admin/acquisition-popup-settings — update trigger/suppression/
//        nurture-cadence mechanics (2026-08-19 lead-capture/conversion engine)
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import {
  getAcquisitionPopupSettings,
  updateAcquisitionPopupSettings,
  InvalidAcquisitionPopupSettingsError,
} from '@/lib/promotions/acquisitionPopupSettings'

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  scrollThresholdPercent: z.number().int().min(1).max(100).nullable().optional(),
  exitIntentEnabled: z.boolean().optional(),
  capturedSuppressDays: z.number().int().nonnegative().optional(),
  dismissedSuppressDays: z.number().int().nonnegative().optional(),
  reminderIntervalsHours: z.array(z.number().positive()).min(1).optional(),
})

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const settings = await getAcquisitionPopupSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = updateSchema.parse(body)
    const settings = await updateAcquisitionPopupSettings({ ...payload, updatedBy: userId as string })
    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvalidAcquisitionPopupSettingsError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/acquisition-popup-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
