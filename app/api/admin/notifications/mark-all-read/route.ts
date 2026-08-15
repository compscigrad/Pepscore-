// PATCH /api/admin/notifications/mark-all-read — the bell dropdown's
// "Mark all read" action.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { markAllNotificationsRead } from '@/lib/notifications/queries'

export async function PATCH() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const result = await markAllNotificationsRead()
  return NextResponse.json(result)
}
