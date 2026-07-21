// GET    /api/admin/invoices/[id] — fetch one invoice with items/discounts/payments
// PATCH  /api/admin/invoices/[id] — update an invoice (full section replace, see lib/invoices.ts)
// DELETE /api/admin/invoices/[id] — archive (not hard-delete, per spec's Archive/Restore requirement)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getInvoice,
  updateInvoice,
  archiveInvoice,
  restoreInvoice,
  duplicateInvoice,
  trashInvoice,
  restoreFromTrash,
} from '@/lib/invoices'
import { invoicePayloadSchema } from '@/lib/invoice/validation'

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
  const invoice = await getInvoice(id)
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  return NextResponse.json(invoice)
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()

    // Duplicate is a distinct action from a field update, but shares this
    // route's auth/param handling — keeping it here avoids a near-empty
    // extra route file for a single one-liner.
    if (body?.action === 'duplicate') {
      const copy = await duplicateInvoice(id)
      return NextResponse.json(copy, { status: 201 })
    }
    if (body?.action === 'restore') {
      const restored = await restoreInvoice(id)
      return NextResponse.json(restored)
    }
    if (body?.action === 'trash') {
      const trashed = await trashInvoice(id)
      await prisma.adminAuditLog.create({
        data: {
          action: 'TRASH_INVOICE',
          entity: 'Invoice',
          entityId: id,
          adminId: userId!,
          details: { invoiceNumber: trashed.invoiceNumber },
        },
      })
      return NextResponse.json(trashed)
    }
    if (body?.action === 'restore-from-trash') {
      const restored = await restoreFromTrash(id)
      await prisma.adminAuditLog.create({
        data: {
          action: 'RESTORE_INVOICE_FROM_TRASH',
          entity: 'Invoice',
          entityId: id,
          adminId: userId!,
          details: { invoiceNumber: restored.invoiceNumber },
        },
      })
      return NextResponse.json(restored)
    }

    const payload = invoicePayloadSchema.parse(body)
    const invoice = await updateInvoice(id, payload)

    await prisma.adminAuditLog.create({
      data: {
        action: 'UPDATE_INVOICE',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { invoiceNumber: invoice.invoiceNumber, status: invoice.status },
      },
    })

    return NextResponse.json(invoice)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/:id PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Failed to update invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const invoice = await archiveInvoice(id)

    await prisma.adminAuditLog.create({
      data: {
        action: 'ARCHIVE_INVOICE',
        entity: 'Invoice',
        entityId: id,
        adminId: userId!,
        details: { invoiceNumber: invoice.invoiceNumber },
      },
    })

    return NextResponse.json(invoice)
  } catch (err: unknown) {
    console.error('[admin/invoices/:id DELETE]', err)
    const msg = err instanceof Error ? err.message : 'Failed to archive invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
