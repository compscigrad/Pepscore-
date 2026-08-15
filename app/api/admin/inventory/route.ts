import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listInventoryOverview } from '@/lib/adminInventory'

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const rows = await listInventoryOverview()
  return NextResponse.json(rows)
}
