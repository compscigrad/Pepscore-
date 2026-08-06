// PATCH /api/admin/customers/[id] — admin edits a customer's own record.
// The one path that actually applies an approved email change requested
// through the portal (see lib/portal/profile.ts's requestEmailChange,
// which never writes Customer.email directly) — an admin reviews the
// request (surfaced in the customer's activity timeline + an email alert)
// and applies it here once verified.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())
    const before = await prisma.customer.findUniqueOrThrow({ where: { id } })

    const updated = await prisma.customer.update({
      where: { id },
      data: payload,
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
