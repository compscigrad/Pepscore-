// POST /api/intake/[token] — public, unauthenticated submission endpoint for
// the customer intake form. Runs the existing duplicate-detection ->
// customer-upsert -> draft-invoice-creation pipeline (lib/customers.ts) and
// fires the existing admin notification (lib/notifications/dispatch.ts) —
// all of that logic already existed before this route did; this just calls
// it in the right order.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  validateIntakeLink,
  recordSubmissionAttempt,
  markIntakeLinkSubmitted,
} from '@/lib/intakeLinks'
import { intakeSubmissionSchema } from '@/lib/intake/validation'
import {
  findPossibleDuplicateCustomers,
  upsertCustomerFromIntake,
  createOrUpdateDraftInvoiceFromIntake,
  recordCustomerActivity,
  recomputeAndSaveCustomerStatus,
} from '@/lib/customers'
import { notifyIntakeSubmitted } from '@/lib/notifications/dispatch'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import type { CustomerInput } from '@/lib/customers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const rateLimit = checkRateLimit(`intake-submit:${getClientIp(req)}`, 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment and try again.' }, { status: 429 })
  }

  const validation = await validateIntakeLink(token)
  if (!validation.valid) {
    return NextResponse.json({ error: 'This link is no longer valid.', reason: validation.reason }, { status: 410 })
  }
  const { link } = validation

  const body = await req.json().catch(() => null)
  const parsed = intakeSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    await recordSubmissionAttempt(token)
    return NextResponse.json({ error: 'Please check the form and try again.', issues: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  // Honeypot: a real customer never sees or fills this field. Return a fake
  // success so a bot gets no signal it was caught — never process, never
  // count against the real submission-attempt limit.
  if (data.website) {
    return NextResponse.json({ ok: true })
  }

  await recordSubmissionAttempt(token)

  const customerInput: CustomerInput = {
    firstName: data.firstName,
    lastName: data.lastName,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    billingAddress: data.billingAddress ?? null,
    shippingAddress: data.shippingAddress ?? null,
    preferredContactMethod: data.preferredContactMethod ?? null,
    preferredPaymentMethod: data.preferredPaymentMethod ?? null,
    notes: data.notes || null,
  }

  const { customer, isNewCustomer } = await upsertCustomerFromIntake(customerInput, link.customerId)

  let possibleDuplicateOf: string | null = null
  if (isNewCustomer) {
    const matches = await findPossibleDuplicateCustomers({
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company || null,
      shippingAddressZip: data.shippingAddress?.zip ?? data.billingAddress?.zip ?? null,
      excludeCustomerId: customer.id,
    })
    possibleDuplicateOf = matches[0]?.customer.id ?? null
  }

  const submittedAt = new Date()
  const invoice = await createOrUpdateDraftInvoiceFromIntake({
    customer,
    invoiceId: link.invoiceId,
    submittedAt,
  })

  await markIntakeLinkSubmitted(token)

  // Backfill the link's customer/invoice association if it was generated
  // "cold" (a brand-new client with no existing customer/draft yet) — so
  // findActiveIntakeLinkFor() and the admin's own view of this link can
  // still resolve it to the record it actually produced.
  if (!link.customerId || !link.invoiceId) {
    await prisma.intakeLink.update({
      where: { token },
      data: { customerId: link.customerId ?? customer.id, invoiceId: link.invoiceId ?? invoice.id },
    })
  }

  await recordCustomerActivity({
    customerId: customer.id,
    invoiceId: invoice.id,
    eventType: 'CUSTOMER_UPDATED_FROM_INTAKE',
    source: 'SYSTEM',
  })
  await prisma.invoiceActivityLog.create({
    data: {
      invoiceId: invoice.id,
      eventType: link.invoiceId ? 'DRAFT_INVOICE_UPDATED_FROM_INTAKE' : 'DRAFT_INVOICE_CREATED_FROM_INTAKE',
      source: 'SYSTEM',
    },
  })
  await recordCustomerActivity({
    customerId: customer.id,
    invoiceId: invoice.id,
    eventType: 'INTAKE_SUBMITTED',
    source: 'SYSTEM',
  })
  await recomputeAndSaveCustomerStatus(customer.id)

  await notifyIntakeSubmitted({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    isNewCustomer,
    possibleDuplicateOf,
  })

  return NextResponse.json({ ok: true })
}
