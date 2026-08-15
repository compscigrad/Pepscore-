// GET /api/admin/invoices/trash — list soft-deleted invoices for the Trash view.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listTrashedInvoices } from '@/lib/invoices'

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const invoices = await listTrashedInvoices()
  return NextResponse.json({ invoices })
}
