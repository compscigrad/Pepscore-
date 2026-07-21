// GET /api/admin/invoices/trash — list soft-deleted invoices for the Trash view.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listTrashedInvoices } from '@/lib/invoices'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const invoices = await listTrashedInvoices()
  return NextResponse.json({ invoices })
}
