// PATCH /api/admin/notifications/[id] — mark one notification read, called
// when the admin clicks through to its invoice from the bell dropdown.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { markNotificationRead } from '@/lib/notifications/queries'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const notification = await markNotificationRead(id)
  return NextResponse.json(notification)
}
