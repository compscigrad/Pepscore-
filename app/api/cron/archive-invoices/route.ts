// GET /api/cron/archive-invoices — daily Vercel Cron sweep (see vercel.json)
// that auto-archives every PAID invoice whose paidAt countdown has elapsed.
// Auth is the standard Vercel Cron pattern (Authorization: Bearer CRON_SECRET)
// rather than the Clerk isAdmin gate every other invoice route uses — this
// endpoint is invoked by Vercel's scheduler, not a logged-in admin session.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sweepAutoArchive } from '@/lib/invoices'
import { getInvoiceSettings } from '@/lib/invoiceSettings'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { archiveAfterDays } = await getInvoiceSettings()
  const { archivedCount } = await sweepAutoArchive(archiveAfterDays)

  if (archivedCount > 0) {
    await prisma.adminAuditLog.create({
      data: {
        action: 'AUTO_ARCHIVE_SWEEP',
        entity: 'Invoice',
        adminId: 'cron',
        details: { archivedCount, archiveAfterDays },
      },
    })
  }

  return NextResponse.json({ archivedCount, archiveAfterDays })
}
