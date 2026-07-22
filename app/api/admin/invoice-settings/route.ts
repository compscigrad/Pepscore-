// GET/PATCH /api/admin/invoice-settings — the invoice module's settings:
// auto-archive delay and per-status tracking notification toggles.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  updateTrackingNotificationSettings,
  updateAutoEmailInvoiceOnIssue,
  updateDefaultIntakeLinkExpiryHours,
  updateAutoEmailPaymentReceived,
} from '@/lib/invoiceSettings'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

// null means "Never auto-archive" — the spec's fourth radio option.
const patchSchema = z.object({
  archiveAfterDays: z.number().int().positive().nullable().optional(),
  trackingNotificationsEnabled: z.record(z.string(), z.boolean()).optional(),
  autoEmailInvoiceOnIssue: z.boolean().optional(),
  defaultIntakeLinkExpiryHours: z.number().int().positive().optional(),
  autoEmailPaymentReceived: z.boolean().optional(),
})

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
    const parsed = patchSchema.parse(body)

    if (parsed.trackingNotificationsEnabled) {
      const settings = await updateTrackingNotificationSettings(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.trackingNotificationsEnabled as any
      )
      return NextResponse.json(settings)
    }

    if (parsed.autoEmailInvoiceOnIssue !== undefined) {
      const settings = await updateAutoEmailInvoiceOnIssue(parsed.autoEmailInvoiceOnIssue)
      return NextResponse.json(settings)
    }

    if (parsed.defaultIntakeLinkExpiryHours !== undefined) {
      const settings = await updateDefaultIntakeLinkExpiryHours(parsed.defaultIntakeLinkExpiryHours)
      return NextResponse.json(settings)
    }

    if (parsed.autoEmailPaymentReceived !== undefined) {
      const settings = await updateAutoEmailPaymentReceived(parsed.autoEmailPaymentReceived)
      return NextResponse.json(settings)
    }

    const settings = await updateInvoiceSettings(parsed.archiveAfterDays ?? null)
    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoice-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
