// GET /api/account/invoices/[id]/pdf — the customer's own receipt PDF.
// Ownership-checked; always the RecipientReceiptDocument variant (the
// customer-safe one) — never MasterInvoiceDocument, which carries
// internal-only figures the admin document is allowed to show.
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getPortalCustomer } from '@/lib/portalAuth'
import { getInvoice } from '@/lib/invoices'
import { RecipientReceiptDocument } from '@/lib/invoice/pdf/RecipientReceiptDocument'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const customer = await getPortalCustomer()
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice || invoice.customerId !== customer.id) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const buffer = await renderToBuffer(<RecipientReceiptDocument invoice={invoice} />)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}-receipt.pdf"`,
      // Never cached by a shared/browser cache — this is a per-customer
      // document served through an authenticated route.
      'Cache-Control': 'private, no-store',
    },
  })
}
