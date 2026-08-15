// GET /api/admin/notifications?unreadOnly=true — the dashboard bell's poll
// target (~20s interval, see components/admin/NotificationBell.tsx).
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listNotifications } from '@/lib/notifications/queries'

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true'
  const notifications = await listNotifications(unreadOnly)
  return NextResponse.json({ notifications })
}
