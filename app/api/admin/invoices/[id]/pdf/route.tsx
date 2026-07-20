// GET /api/admin/invoices/[id]/pdf?variant=master|recipient — streams a
// freshly generated PDF. Not cached/stored (see docs/Decisions.md #4) so the
// PDF always reflects the invoice's current state.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getInvoice } from '@/lib/invoices'
import { MasterInvoiceDocument } from '@/lib/invoice/pdf/MasterInvoiceDocument'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const variant = req.nextUrl.searchParams.get('variant') === 'recipient' ? 'recipient' : 'master'

  const invoice = await getInvoice(id)
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const document =
    variant === 'recipient' ? <RecipientReceiptDocument invoice={invoice} /> : <MasterInvoiceDocument invoice={invoice} />

  const buffer = await renderToBuffer(document)
  const filename = `${invoice.invoiceNumber}-${variant === 'recipient' ? 'receipt' : 'master-invoice'}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
