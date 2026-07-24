// POST /api/admin/invoices/quick-intake
// A lighter-weight entry point than the full "Create Invoice" flow: the admin
// has just a name and a phone/email — no products yet — and wants to send an
// intake request immediately. Creates (or reuses) a Customer and a zero-item
// DRAFT invoice linked to it, so the caller can redirect straight into the
// invoice edit page, where IntakeLinkSection's existing SMS/email send
// actions are already fully built. Deliberately bypasses invoicePayloadSchema
// (which requires items.min(1)) — same reasoning as
// lib/customers.ts's createOrUpdateDraftInvoiceFromIntake: this draft is
// meant to start empty, the customer (or the admin later) fills in the rest.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { findCustomerByEmailOrPhone, createCustomer } from '@/lib/customers'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const quickIntakeSchema = z
  .object({
    customerName: z.string().min(1, 'Customer name is required'),
    customerEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
    customerPhone: z.string().optional(),
  })
  .refine((v) => !!(v.customerEmail || v.customerPhone), {
    message: 'Provide at least an email or phone number',
    path: ['customerPhone'],
  })

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = quickIntakeSchema.parse(body)

    const [firstName, ...rest] = payload.customerName.trim().split(/\s+/)
    const existing = await findCustomerByEmailOrPhone(payload.customerEmail || null, payload.customerPhone || null)
    const customer =
      existing ??
      (await createCustomer({
        firstName: firstName || payload.customerName,
        lastName: rest.join(' '),
        email: payload.customerEmail || null,
        phone: payload.customerPhone || null,
      }))

    const invoiceNumber = await generateSequentialInvoiceNumber()
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: 'DRAFT',
        customerId: customer.id,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail || undefined,
        customerPhone: payload.customerPhone || undefined,
      },
    })

    return NextResponse.json({ id: invoice.id }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Validation failed', issues: err.issues },
        { status: 400 }
      )
    }
    console.error('[admin/invoices/quick-intake POST]', err)
    const msg = err instanceof Error ? err.message : 'Failed to start intake request'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
