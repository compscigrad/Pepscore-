// POST /api/admin/invoices/[id]/email — "Email Invoice to Customer" admin
// action. Always sends (or resends), independent of whether the one-time
// auto-send already fired — see lib/invoiceIssuedEmail.tsx.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getInvoice } from '@/lib/invoices'
import { sendInvoiceEmailManually } from '@/lib/invoiceIssuedEmail'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const invoice = await getInvoice(id)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (!invoice.customerEmail) return NextResponse.json({ error: 'No customer email on file' }, { status: 400 })

    const sent = await sendInvoiceEmailManually(invoice, userId!)
    if (!sent) return NextResponse.json({ error: 'Failed to send invoice email' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[admin/invoices/:id/email POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to send invoice email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
