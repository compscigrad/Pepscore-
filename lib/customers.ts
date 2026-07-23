// Customer data-access + CRM logic — the customer-facing counterpart to
// lib/invoices.ts. Customer is the primary record everything else (invoices,
// intake links, notifications, the activity timeline) points at — see
// docs/Decisions.md and the Customer Intake Link plan.
import { Prisma } from '@prisma/client'
import type { Customer, CustomerStatus, TrackingEventSource, InvoicePriority, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeCustomerStatus } from '@/lib/customers/status'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'
import { hasActivePaymentArrangement } from '@/lib/paymentArrangements'
import { decideCustomerIdentityAction } from '@/lib/customerIdentity'

export interface CustomerInput {
  firstName: string
  lastName: string
  company?: string | null
  email?: string | null
  phone?: string | null
  billingAddress?: Prisma.InputJsonValue | null
  shippingAddress?: Prisma.InputJsonValue | null
  preferredContactMethod?: 'SMS' | 'EMAIL' | 'PHONE' | null
  preferredPaymentMethod?: PaymentMethod | null
  notes?: string | null
  // Only set by resolveCustomerForUser's create path below — every other
  // caller (intake, admin) leaves this unset, so Customer.userId stays null
  // exactly as before for those records.
  userId?: string | null
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } })
}

export interface ListCustomersParams {
  search?: string
  status?: CustomerStatus
  page?: number
  limit?: number
}

export async function listCustomers(params: ListCustomersParams = {}) {
  const { search, status, page = 1, limit = 25 } = params

  const where: Prisma.CustomerWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.customer.count({ where }),
  ])

  return { customers, total, page, limit }
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return prisma.customer.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company || undefined,
      email: input.email || undefined,
      phone: input.phone || undefined,
      billingAddress: input.billingAddress ?? undefined,
      shippingAddress: input.shippingAddress ?? undefined,
      preferredContactMethod: input.preferredContactMethod ?? undefined,
      preferredPaymentMethod: input.preferredPaymentMethod ?? undefined,
      notes: input.notes || undefined,
      userId: input.userId || undefined,
    },
  })
}

export type ResolveCustomerForUserResult =
  | { status: 'ALREADY_LINKED'; customer: Customer }
  | { status: 'LINKED_EXISTING'; customer: Customer }
  | { status: 'CREATED'; customer: Customer }
  | { status: 'AMBIGUOUS'; matchingCustomerIds: string[] }

// The single, centralized identity-link resolver — the Phase 2B "User and
// Customer are two separate identities" decision (docs/ProductRoadmap.md).
// Call this from every place that needs to connect a signed-in storefront
// User to their Customer/CRM record (app/account/page.tsx today, future
// checkout flows) rather than re-deriving matching rules per caller.
//
// userId must be a verified User.id — the caller is responsible for sourcing
// it from the authenticated Clerk session (never from client request data)
// and for the User row already existing (e.g. via the account page's
// existing prisma.user.upsert). This function throws if it doesn't.
export async function resolveCustomerForUser(userId: string): Promise<ResolveCustomerForUserResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error(`resolveCustomerForUser: no User found for id "${userId}"`)

  const alreadyLinked = await prisma.customer.findUnique({ where: { userId: user.id } })

  // Fetched by email alone (not filtered to unclaimed here) so the pure
  // decision function is the single place that enforces "never reassign a
  // Customer already linked to someone else" — see lib/customerIdentity.ts.
  const emailMatches = user.email
    ? await prisma.customer.findMany({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { id: true, userId: true },
      })
    : []

  const action = decideCustomerIdentityAction({
    alreadyLinked: !!alreadyLinked,
    emailMatches,
  })

  switch (action.type) {
    case 'ALREADY_LINKED':
      return { status: 'ALREADY_LINKED', customer: alreadyLinked! }

    case 'AMBIGUOUS':
      return { status: 'AMBIGUOUS', matchingCustomerIds: action.matchingCustomerIds }

    case 'LINK_EXISTING': {
      // Customer.userId's unique constraint is the ultimate backstop against
      // a race with a concurrent request; a violation here means someone
      // else won the race, so re-resolve rather than surface a raw DB error.
      try {
        const customer = await prisma.customer.update({
          where: { id: action.customerId },
          data: { userId: user.id },
        })
        return { status: 'LINKED_EXISTING', customer }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return resolveCustomerForUser(userId)
        }
        throw err
      }
    }

    case 'CREATE_NEW': {
      const [firstName, ...rest] = (user.name ?? user.email).trim().split(/\s+/)
      try {
        const customer = await createCustomer({
          firstName: firstName || 'Customer',
          lastName: rest.join(' ') || '—',
          email: user.email,
          phone: user.phone ?? undefined,
          userId: user.id,
        })
        return { status: 'CREATED', customer }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return resolveCustomerForUser(userId)
        }
        throw err
      }
    }
  }
}

// Exact match only — the auto-merge key (Decision 8). Widened name/company/
// address scoring lives in findPossibleDuplicateCustomers() below and never
// auto-merges anything on its own.
export async function findCustomerByEmailOrPhone(
  email?: string | null,
  phone?: string | null
): Promise<Customer | null> {
  if (!email && !phone) return null
  return prisma.customer.findFirst({
    where: {
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
  })
}

export interface PossibleDuplicateMatch {
  customer: Customer
  reasons: Array<'NAME' | 'COMPANY' | 'ADDRESS'>
}

function jsonZipMatches(address: Prisma.JsonValue, zip: string): boolean {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return false
  return (address as Record<string, unknown>).zip === zip
}

// Decision 16: a weak match (name, company, or address alone) never
// auto-merges — it's surfaced to the admin for review via the intake
// notification and the customer list, nothing more.
export async function findPossibleDuplicateCustomers(input: {
  firstName: string
  lastName: string
  company?: string | null
  shippingAddressZip?: string | null
  excludeCustomerId?: string
}): Promise<PossibleDuplicateMatch[]> {
  const orConditions: Prisma.CustomerWhereInput[] = [
    { firstName: { equals: input.firstName, mode: 'insensitive' }, lastName: { equals: input.lastName, mode: 'insensitive' } },
  ]
  if (input.company) {
    orConditions.push({ company: { equals: input.company, mode: 'insensitive' } })
  }
  if (input.shippingAddressZip) {
    orConditions.push({ shippingAddress: { path: ['zip'], equals: input.shippingAddressZip } })
  }

  const candidates = await prisma.customer.findMany({
    where: {
      ...(input.excludeCustomerId ? { id: { not: input.excludeCustomerId } } : {}),
      OR: orConditions,
    },
    take: 10,
  })

  return candidates.map((customer) => {
    const reasons: PossibleDuplicateMatch['reasons'] = []
    if (
      customer.firstName.toLowerCase() === input.firstName.toLowerCase() &&
      customer.lastName.toLowerCase() === input.lastName.toLowerCase()
    ) {
      reasons.push('NAME')
    }
    if (input.company && customer.company && customer.company.toLowerCase() === input.company.toLowerCase()) {
      reasons.push('COMPANY')
    }
    if (input.shippingAddressZip && jsonZipMatches(customer.shippingAddress, input.shippingAddressZip)) {
      reasons.push('ADDRESS')
    }
    return { customer, reasons }
  })
}

// Auto-merge path (Decision 8): fills only fields the existing customer is
// missing — an address already on file always wins over a new submission,
// the difference is surfaced to the admin by the caller instead.
//
// existingCustomerId: when the intake link was generated against a known
// customer (an admin's "Request Customer Information" on an existing
// record), pass their id here to update that exact customer rather than
// re-deriving one via email/phone match — the submitted email could differ
// from what's on file, and re-matching could route the update to the wrong
// person or spuriously create a duplicate.
export async function upsertCustomerFromIntake(
  input: CustomerInput,
  existingCustomerId?: string | null
): Promise<{ customer: Customer; isNewCustomer: boolean }> {
  const existing = existingCustomerId
    ? await prisma.customer.findUnique({ where: { id: existingCustomerId } })
    : await findCustomerByEmailOrPhone(input.email, input.phone)
  if (!existing) {
    const customer = await createCustomer(input)
    return { customer, isNewCustomer: true }
  }

  const data: Prisma.CustomerUpdateInput = {}
  if (!existing.company && input.company) data.company = input.company
  if (!existing.email && input.email) data.email = input.email
  if (!existing.phone && input.phone) data.phone = input.phone
  if (!existing.billingAddress && input.billingAddress) data.billingAddress = input.billingAddress
  if (!existing.shippingAddress && input.shippingAddress) data.shippingAddress = input.shippingAddress
  if (!existing.preferredContactMethod && input.preferredContactMethod) {
    data.preferredContactMethod = input.preferredContactMethod
  }
  if (!existing.preferredPaymentMethod && input.preferredPaymentMethod) {
    data.preferredPaymentMethod = input.preferredPaymentMethod
  }
  if (!existing.notes && input.notes) data.notes = input.notes

  const customer =
    Object.keys(data).length > 0 ? await prisma.customer.update({ where: { id: existing.id }, data }) : existing

  return { customer, isNewCustomer: false }
}

export interface RecordCustomerActivityInput {
  customerId: string
  invoiceId?: string | null
  eventType: string
  previousValue?: string | null
  newValue?: string | null
  source: TrackingEventSource
  userId?: string | null
}

// Decision 13: one append-only log for both the customer timeline and the
// communication log — nothing written here is ever deleted or overwritten.
export async function recordCustomerActivity(input: RecordCustomerActivityInput): Promise<void> {
  await prisma.customerActivityLog.create({
    data: {
      customerId: input.customerId,
      invoiceId: input.invoiceId ?? undefined,
      eventType: input.eventType,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      source: input.source,
      userId: input.userId ?? undefined,
    },
  })
}

// Convenience wrapper for the invoice-side touchpoints (lib/invoices.ts,
// lib/invoiceIssuedEmail.tsx, lib/tracking/service.ts): log what happened to
// the customer timeline, then recompute their status from the result — the
// two always happen together at these call sites.
export async function syncCustomerFromInvoiceEvent(input: RecordCustomerActivityInput): Promise<void> {
  await recordCustomerActivity(input)
  await recomputeAndSaveCustomerStatus(input.customerId)
}

export async function getCustomerTimeline(customerId: string) {
  return prisma.customerActivityLog.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  })
}

// Decision 14: recomputed and persisted at the same touchpoints that write
// CustomerActivityLog (lib/invoices.ts, lib/invoiceIssuedEmail.tsx, the
// tracking-notification dispatch path, and the intake submission flow) —
// never derived at read time.
export async function recomputeAndSaveCustomerStatus(customerId: string): Promise<CustomerStatus> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })
  const [latestInvoice, latestIntakeLink] = await Promise.all([
    prisma.invoice.findFirst({
      where: { customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, shippingStatus: true, archivedAt: true, fulfillmentOverrideAt: true },
    }),
    prisma.intakeLink.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { submittedAt: true },
    }),
  ])

  const status = computeCustomerStatus({
    hasIntakeLinkSent: !!latestIntakeLink,
    hasIntakeSubmitted: !!latestIntakeLink?.submittedAt,
    hasActivePaymentArrangement: latestInvoice ? await hasActivePaymentArrangement(latestInvoice.id) : false,
    latestInvoice,
    currentStatus: customer.status,
  })

  if (status !== customer.status) {
    await prisma.customer.update({ where: { id: customerId }, data: { status } })
  }
  return status
}

export interface CreateOrUpdateDraftFromIntakeInput {
  customer: Customer
  // Set when the IntakeLink that was submitted was tied to an existing
  // in-progress draft (the "Request Customer Information" case) — updates
  // that invoice in place instead of creating a new one.
  invoiceId?: string | null
  submittedAt: Date
}

// Bypasses invoicePayloadSchema (which requires items.min(1)) — the
// intake-created draft has zero items by design, admin fills those in.
// Never used for the admin's own manual invoice creation, so that
// validation stays exactly as strict as it is today for everyone else.
export async function createOrUpdateDraftInvoiceFromIntake(input: CreateOrUpdateDraftFromIntakeInput) {
  const { customer, invoiceId, submittedAt } = input
  const customerName = `${customer.firstName} ${customer.lastName}`.trim()

  const sharedData = {
    customerId: customer.id,
    customerName,
    customerCompany: customer.company ?? undefined,
    customerEmail: customer.email ?? undefined,
    customerPhone: customer.phone ?? undefined,
    billingAddress: customer.billingAddress ?? undefined,
    shippingAddress: customer.shippingAddress ?? undefined,
    intakeSubmittedAt: submittedAt,
  }

  if (invoiceId) {
    return prisma.invoice.update({ where: { id: invoiceId }, data: sharedData })
  }

  const invoiceNumber = await generateSequentialInvoiceNumber()
  return prisma.invoice.create({
    data: {
      invoiceNumber,
      status: 'DRAFT',
      ...sharedData,
    },
  })
}

export interface FulfillmentQueueParams {
  sortBy?: 'oldest' | 'newest' | 'priority' | 'customerName'
  search?: string
  priority?: InvoicePriority
}

// Every intake-originated DRAFT invoice — a row drops off the moment its
// status moves off DRAFT (Decision 9), no separate dismiss action needed.
export async function getFulfillmentQueue(params: FulfillmentQueueParams = {}) {
  const { sortBy = 'oldest', search, priority } = params

  const orderBy: Prisma.InvoiceOrderByWithRelationInput =
    sortBy === 'newest'
      ? { intakeSubmittedAt: 'desc' }
      : sortBy === 'priority'
        ? { priority: 'desc' }
        : sortBy === 'customerName'
          ? { customerName: 'asc' }
          : { intakeSubmittedAt: 'asc' }

  return prisma.invoice.findMany({
    where: {
      status: 'DRAFT',
      intakeSubmittedAt: { not: null },
      deletedAt: null,
      ...(priority ? { priority } : {}),
      ...(search ? { customerName: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy,
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerId: true,
      intakeSubmittedAt: true,
      priority: true,
    },
  })
}
