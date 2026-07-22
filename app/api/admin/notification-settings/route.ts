// GET  /api/admin/notification-settings — list configured admin recipients
// POST /api/admin/notification-settings — add a recipient (Settings ->
// Admin Notifications). Phone/email values are entered here, never
// hardcoded in code — see docs/Decisions.md.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { listAdminNotificationRecipients, createAdminNotificationRecipient } from '@/lib/adminNotificationRecipients'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const recipientSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const recipients = await listAdminNotificationRecipients()
  return NextResponse.json({ recipients })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = recipientSchema.parse(body)
    const recipient = await createAdminNotificationRecipient(payload)
    return NextResponse.json(recipient, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/notification-settings POST]', err)
    return NextResponse.json({ error: 'Failed to create recipient' }, { status: 500 })
  }
}
