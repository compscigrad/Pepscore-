// PATCH /api/admin/customers/[id] — admin edits a customer's own record.
// The one path that actually applies an approved email change requested
// through the portal (see lib/portal/profile.ts's requestEmailChange,
// which never writes Customer.email directly) — an admin reviews the
// request (surfaced in the customer's activity timeline + an email alert)
// and applies it here once verified.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import { addressSchema } from '@/lib/invoice/validation'

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'] as const

// Every field here is .optional() and the update below always spreads the
// parsed payload directly into Prisma's `data` -- a field the admin didn't
// touch is simply absent from the request body, parses to `undefined`, and
// Prisma skips it entirely. That's what makes this safe against the
// blank-value-overwrite failure mode: there is no code path here that ever
// sends an explicit empty string/null for a field the UI didn't present for
// editing (CustomerContactEditor only includes the fields it actually
// renders inputs for).
const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  billingAddress: addressSchema.optional().nullable(),
  shippingAddress: addressSchema.optional().nullable(),
  // CRM triage status (Phase 2B item 8) -- see Customer.leadStatus's schema
  // comment for why this is separate from the fulfillment-lifecycle `status`.
  leadStatus: z.enum(LEAD_STATUSES).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())
    const before = await prisma.customer.findUniqueOrThrow({ where: { id } })

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        company: payload.company,
        email: payload.email,
        phone: payload.phone,
        notes: payload.notes,
        leadStatus: payload.leadStatus,
        // Prisma's JSON columns need an explicit Prisma.JsonNull to clear a
        // value -- a plain `null` is only valid for genuinely nullable
        // scalar columns. `undefined` (the field simply wasn't in the
        // request body) still means "leave untouched" either way.
        billingAddress: payload.billingAddress === null ? Prisma.JsonNull : payload.billingAddress,
        shippingAddress: payload.shippingAddress === null ? Prisma.JsonNull : payload.shippingAddress,
      },
    })

    if (payload.email !== undefined && payload.email !== before.email) {
      await recordCustomerActivity({
        customerId: id,
        eventType: 'EMAIL_CHANGED_BY_ADMIN',
        previousValue: before.email,
        newValue: payload.email,
        source: 'MANUAL',
        userId: userId!,
      })
    }
    if (payload.billingAddress !== undefined || payload.shippingAddress !== undefined) {
      await recordCustomerActivity({
        customerId: id,
        eventType: 'ADDRESS_UPDATED_BY_ADMIN',
        previousValue: JSON.stringify({ billingAddress: before.billingAddress, shippingAddress: before.shippingAddress }),
        newValue: JSON.stringify({ billingAddress: payload.billingAddress ?? before.billingAddress, shippingAddress: payload.shippingAddress ?? before.shippingAddress }),
        source: 'MANUAL',
        userId: userId!,
      })
    }
    if (payload.leadStatus !== undefined && payload.leadStatus !== before.leadStatus) {
      await recordCustomerActivity({
        customerId: id,
        eventType: 'LEAD_STATUS_CHANGED',
        previousValue: before.leadStatus,
        newValue: payload.leadStatus,
        source: 'MANUAL',
        userId: userId!,
      })
    }

    await prisma.adminAuditLog.create({
      data: { action: 'UPDATE_CUSTOMER', entity: 'Customer', entityId: id, adminId: userId!, details: payload },
    })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/customers/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 400 })
  }
}
