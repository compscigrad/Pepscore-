// PATCH /api/admin/notifications/mark-all-read — the bell dropdown's
// "Mark all read" action.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { markAllNotificationsRead } from '@/lib/notifications/queries'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function PATCH() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const result = await markAllNotificationsRead()
  return NextResponse.json(result)
}
