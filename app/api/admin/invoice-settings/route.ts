// GET/PATCH /api/admin/invoice-settings — the invoice module's one setting
// today: how many days after full payment a PAID invoice auto-archives.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getInvoiceSettings, updateInvoiceSettings } from '@/lib/invoiceSettings'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

// null means "Never auto-archive" — the spec's fourth radio option.
const patchSchema = z.object({ archiveAfterDays: z.number().int().positive().nullable() })

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const settings = await getInvoiceSettings()
  return NextResponse.json(settings)
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const { archiveAfterDays } = patchSchema.parse(body)
    const settings = await updateInvoiceSettings(archiveAfterDays)
    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoice-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
