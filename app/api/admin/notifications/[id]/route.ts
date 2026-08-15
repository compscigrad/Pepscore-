// PATCH /api/admin/notifications/[id] — mark one notification read, called
// when the admin clicks through to its invoice from the bell dropdown.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { markNotificationRead } from '@/lib/notifications/queries'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(_req: Request, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const notification = await markNotificationRead(id)
  return NextResponse.json(notification)
}
