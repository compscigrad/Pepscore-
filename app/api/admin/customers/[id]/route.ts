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
import { getCustomerDeletionEligibility, CUSTOMER_BLOCK_REASON_LABEL } from '@/lib/customers/deletionEligibility'
import { validateBirthdayMonthDay } from '@/lib/pricing/birthdayPromotion'

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
  // Pepscore's own birthday-marketing profile -- month/day only, never a
  // year (see Customer.birthdayMonth's schema comment). Real range
  // validation (including the Feb 29 leap-day case) happens below via
  // validateBirthdayMonthDay, shared with the automation that reads these
  // fields, rather than a second copy of the same rule in a zod refine.
  birthdayMonth: z.number().int().optional().nullable(),
  birthdayDay: z.number().int().optional().nullable(),
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

    // Both-or-neither on the FINAL state (this payload's value where
    // provided, otherwise whatever the row already had), and real range/
    // leap-day validation -- a half-entered birthday (e.g. day without
    // month) isn't a usable one, and this is the same check the birthday-
    // promotion automation itself relies on being pre-validated data.
    if (payload.birthdayMonth !== undefined || payload.birthdayDay !== undefined) {
      const finalMonth = payload.birthdayMonth !== undefined ? payload.birthdayMonth : before.birthdayMonth
      const finalDay = payload.birthdayDay !== undefined ? payload.birthdayDay : before.birthdayDay
      if ((finalMonth == null) !== (finalDay == null)) {
        return NextResponse.json({ error: 'Birthday month and day must be set (or cleared) together.' }, { status: 400 })
      }
      if (finalMonth != null && finalDay != null) {
        const error = validateBirthdayMonthDay(finalMonth, finalDay)
        if (error) return NextResponse.json({ error }, { status: 400 })
      }
    }

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
        birthdayMonth: payload.birthdayMonth,
        birthdayDay: payload.birthdayDay,
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

// GET /api/admin/customers/[id] -- deletion-eligibility preview (2026-09-03
// customer lifecycle sprint), same "check first, render the exact reason
// disabled" pattern as the merge preview (/api/admin/customers/[id]/merge).
// Only a genuinely test/duplicate/abandoned-lead record with zero business/
// financial history is eligible -- anything else must go through Close/
// Archive instead (POST .../close, .../archive), which preserves the row.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const eligibility = await getCustomerDeletionEligibility(id)
    return NextResponse.json({
      ...eligibility,
      blockedReasonLabels: eligibility.blockedReasons.map((r) => CUSTOMER_BLOCK_REASON_LABEL[r]),
    })
  } catch (err: unknown) {
    console.error('[admin/customers/:id GET]', err)
    return NextResponse.json({ error: 'Failed to check deletion eligibility' }, { status: 400 })
  }
}

// DELETE /api/admin/customers/[id] -- true, permanent delete. Only ever
// safe for a record with zero business/financial history (test customer,
// accidental duplicate, abandoned lead) -- re-checks eligibility itself
// rather than trusting a client-side preview that could be stale by the
// time the button is actually clicked.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const eligibility = await getCustomerDeletionEligibility(id)
    if (!eligibility.eligible) {
      const reasons = eligibility.blockedReasons.map((r) => CUSTOMER_BLOCK_REASON_LABEL[r]).join('; ')
      return NextResponse.json({ error: `Cannot permanently delete this customer: ${reasons}. Close/Archive instead.` }, { status: 409 })
    }

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id }, select: { firstName: true, lastName: true, email: true } })
    await prisma.customer.delete({ where: { id } })

    await prisma.adminAuditLog.create({
      data: {
        action: 'DELETE_CUSTOMER',
        entity: 'Customer',
        entityId: id,
        adminId: userId!,
        details: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[admin/customers/:id DELETE]', err)
    const msg = err instanceof Error ? err.message : 'Failed to delete customer'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
