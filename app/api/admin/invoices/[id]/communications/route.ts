// GET /api/admin/invoices/[id]/communications — every email/SMS ever sent
// that referenced this invoice, newest first. Read-only: this history is
// written exclusively by lib/notifications/log.ts at send time.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const communications = await prisma.communication.findMany({
    where: { invoiceId: id },
    orderBy: { sentAt: 'desc' },
  })
  return NextResponse.json(communications)
}
