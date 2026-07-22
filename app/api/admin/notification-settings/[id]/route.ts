// PATCH  /api/admin/notification-settings/[id] — update a recipient
// DELETE /api/admin/notification-settings/[id] — remove a recipient
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { updateAdminNotificationRecipient, deleteAdminNotificationRecipient } from '@/lib/adminNotificationRecipients'

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

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const { id } = await params
    const body = await req.json()
    const payload = recipientSchema.parse(body)
    const recipient = await updateAdminNotificationRecipient(id, payload)
    return NextResponse.json(recipient)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/notification-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update recipient' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  await deleteAdminNotificationRecipient(id)
  return NextResponse.json({ success: true })
}
