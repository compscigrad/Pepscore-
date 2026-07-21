// DELETE /api/admin/invoices/[id]/permanent — final, unrecoverable delete.
// Only reachable from the Trash view, and permanentlyDeleteInvoice() itself
// also refuses to run unless the invoice is already trashed — the two-step
// "trash first, then a separate final action" flow is enforced here, not
// just in the UI.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { permanentlyDeleteInvoice } from '@/lib/invoices'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { invoiceNumber } = await permanentlyDeleteInvoice(id)

    await prisma.adminAuditLog.create({
      data: {
        action: 'PERMANENT_DELETE_INVOICE',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { invoiceNumber },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[admin/invoices/:id/permanent DELETE]', err)
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
