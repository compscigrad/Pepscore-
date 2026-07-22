// GET /api/admin/notifications?unreadOnly=true — the dashboard bell's poll
// target (~20s interval, see components/admin/NotificationBell.tsx).
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listNotifications } from '@/lib/notifications/queries'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true'
  const notifications = await listNotifications(unreadOnly)
  return NextResponse.json({ notifications })
}
