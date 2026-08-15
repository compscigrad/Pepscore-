// GET /api/admin/orders/[id] — single Order detail (Phase 4A Critical #2),
// used by app/admin/orders/[id]/page.tsx.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { getOrderDetail } from '@/lib/orders/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const order = await getOrderDetail(id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  return NextResponse.json(order)
}
