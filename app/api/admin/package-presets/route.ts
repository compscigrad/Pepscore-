// GET  /api/admin/package-presets — list reusable package templates
// POST /api/admin/package-presets — create one
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { listPackagePresets, createPackagePreset } from '@/lib/fulfillment/presets'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const presetSchema = z.object({
  name: z.string().min(1, 'Preset name is required'),
  weightOz: z.number().positive('Weight must be greater than zero'),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const activeOnly = req.nextUrl.searchParams.get('activeOnly') !== 'false'
  const presets = await listPackagePresets(activeOnly)
  return NextResponse.json({ presets })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = presetSchema.parse(body)
    const preset = await createPackagePreset(payload)
    return NextResponse.json(preset, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/package-presets POST]', err)
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 })
  }
}
