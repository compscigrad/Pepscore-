// POST /api/admin/invoices/trash/bulk-delete — permanently deletes only the
// eligible invoices among the selected ids (2026-08-12 admin optimization
// sprint). Never partially trusts the client's own eligibility read: every
// id is re-checked against getInvoiceDeletionEligibility() here, the same
// function permanentlyDeleteInvoice() itself enforces, so a stale UI state
// can never delete something protected.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { permanentlyDeleteInvoice } from '@/lib/invoices'
import { getBulkInvoiceDeletionEligibility, BLOCK_REASON_LABEL } from '@/lib/invoices/deletionEligibility'

const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) })

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const { ids } = bodySchema.parse(await req.json())
    const eligibility = await getBulkInvoiceDeletionEligibility(ids)

    const deleted: { id: string; invoiceNumber: string }[] = []
    const blocked: { id: string; invoiceNumber: string; reasons: string[] }[] = []
    const failed: { id: string; error: string }[] = []

    for (const e of eligibility) {
      if (!e.eligible) {
        blocked.push({ id: e.invoiceId, invoiceNumber: e.invoiceNumber, reasons: e.blockedReasons.map((r) => BLOCK_REASON_LABEL[r]) })
        continue
      }
      try {
        const { invoiceNumber } = await permanentlyDeleteInvoice(e.invoiceId)
        deleted.push({ id: e.invoiceId, invoiceNumber })
      } catch (err) {
        failed.push({ id: e.invoiceId, error: err instanceof Error ? err.message : 'Delete failed' })
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        action: 'PERMANENT_DELETE_INVOICE_BULK',
        entity: 'Invoice',
        adminId: userId!,
        details: { requested: ids.length, deleted: deleted.length, blocked: blocked.length, failed: failed.length },
      },
    })

    return NextResponse.json({ deleted, blocked, failed })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/trash/bulk-delete POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Bulk delete failed' }, { status: 500 })
  }
}
