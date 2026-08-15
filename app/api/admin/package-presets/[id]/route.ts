// PATCH  /api/admin/package-presets/[id] — update a preset (or deactivate)
// DELETE /api/admin/package-presets/[id] — remove a preset
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { updatePackagePreset, deletePackagePreset } from '@/lib/fulfillment/presets'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  weightOz: z.number().positive().optional(),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
  active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const { id } = await params
    const body = await req.json()
    const payload = patchSchema.parse(body)
    const preset = await updatePackagePreset(id, payload)
    return NextResponse.json(preset)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/package-presets/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  await deletePackagePreset(id)
  return NextResponse.json({ success: true })
}
