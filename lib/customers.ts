// Customer data-access + CRM logic — the customer-facing counterpart to
// lib/invoices.ts. Customer is the primary record everything else (invoices,
// intake links, notifications, the activity timeline) points at — see
// docs/Decisions.md and the Customer Intake Link plan.
import { Prisma } from '@prisma/client'
import type { Customer, CustomerStatus, LeadStatus, LeadInterestType, TrackingEventSource, InvoicePriority, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeCustomerStatus } from '@/lib/customers/status'
import { generateSequentialInvoiceNumber } from '@/lib/invoice/numbering'
import { hasActivePaymentArrangement } from '@/lib/paymentArrangements'
import { digitsOnly, phoneNumbersMatch } from '@/lib/notifications/phoneMatch'
import { buildPeriodDateFilter, type InvoiceHistoryPeriod } from '@/lib/invoice/historyPeriod'

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
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } })
}

export interface ListCustomersParams {
  search?: string
  status?: CustomerStatus
  // CRM/lead filters (Phase 2B item 8) -- interestType/hasConsent/campaign
  // all filter via the related LeadCapture rows (a Customer can have zero
  // or many), never fields stored directly on Customer.
  leadStatus?: LeadStatus
  interestType?: LeadInterestType
  hasConsent?: boolean
  // Matches either utmCampaign or utmSource on any of the customer's
  // LeadCapture rows -- "campaign/source" is one filter field in the UI
  // since most submissions only ever populate one or the other.
  campaign?: string
  page?: number
  limit?: number
  sortBy?: 'newest' | 'oldest' | 'name'
}

export async function listCustomers(params: ListCustomersParams = {}) {
  const { search, status, leadStatus, interestType, hasConsent, campaign, page = 1, limit = 25, sortBy = 'newest' } = params

  const leadCaptureFilters: Prisma.LeadCaptureWhereInput[] = []
  if (interestType) leadCaptureFilters.push({ interestType })
  if (hasConsent !== undefined) leadCaptureFilters.push({ consent: hasConsent })
  if (campaign) {
    leadCaptureFilters.push({
      OR: [
        { utmCampaign: { contains: campaign, mode: 'insensitive' } },
        { utmSource: { contains: campaign, mode: 'insensitive' } },
      ],
    })
  }

  const where: Prisma.CustomerWhereInput = {
    ...(status ? { status } : {}),
    ...(leadStatus ? { leadStatus } : {}),
    // AND across filter *kinds*, but each kind only needs to match *some*
    // one LeadCapture row -- e.g. a customer who once submitted a
    // consent=true PRODUCT_INTEREST lead and separately a consent=false
    // GENERAL_UPDATES lead still matches interestType=PRODUCT_INTEREST +
    // hasConsent=true (the same real submission satisfies both), which is
    // the intuitive reading of "has a lead matching this."
    ...(leadCaptureFilters.length > 0 ? { leadCaptures: { some: { AND: leadCaptureFilters } } } : {}),
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

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    sortBy === 'oldest' ? { createdAt: 'asc' } : sortBy === 'name' ? { firstName: 'asc' } : { createdAt: 'desc' }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        // Lightweight -- just enough for the list view's "most recent
        // interest" column. Full history is only fetched on the profile
        // page (getCustomerProfileData's customerProfileInclude).
        leadCaptures: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { interestType: true, productName: true, productSize: true, consent: true, createdAt: true },
        },
      },
    }),
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
    },
  })
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

// Flexible counterpart to findCustomerByEmailOrPhone's exact match --
// Customer.phone is stored exactly as typed (no write-time normalization),
// while an inbound Twilio webhook's `From` is always E.164. Used only for
// app/api/webhooks/twilio/route.ts's STOP/START handling, where matching
// the real customer actually matters (a missed match leaves someone
// wrongly still subscribed; a false match would wrongly opt someone else
// out) -- everywhere else in the app keeps using the exact-match lookup.
// A Prisma `contains` can't narrow this the way it does for
// findPossibleDuplicateCustomers's other fields, since punctuation in the
// stored value (dashes, parens, spaces) breaks a digits-only substring
// match -- so this scans every customer with a phone on file and compares
// digit sequences in JS. Fine at today's customer-table scale; if that
// ever stops being true, a normalized-phone column with its own index
// would be the fix, not a cleverer query against the raw field.
export async function findCustomerByPhoneFlexible(rawPhone: string): Promise<Customer | null> {
  const digits = digitsOnly(rawPhone)
  if (digits.length < 7) return null

  const candidates = await prisma.customer.findMany({ where: { phone: { not: null } } })
  return candidates.find((c) => c.phone && phoneNumbersMatch(c.phone, rawPhone)) ?? null
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
      select: { id: true, status: true, paymentStatus: true, shippingStatus: true, archivedAt: true, fulfillmentOverrideAt: true },
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

const customerProfileInclude = Prisma.validator<Prisma.CustomerDefaultArgs>()({
  include: {
    invoices: {
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        payments: { orderBy: { paidAt: 'desc' } },
        refunds: { orderBy: { requestedAt: 'desc' } },
        backorderConditions: { orderBy: { appliedAt: 'desc' } },
        paymentArrangement: {
          include: { installments: { orderBy: { installmentNumber: 'asc' } } },
        },
        shipments: { orderBy: { createdAt: 'desc' } },
      },
    },
    accountCredits: { orderBy: { issuedAt: 'desc' } },
    communications: { orderBy: { sentAt: 'desc' } },
    activityLog: { orderBy: { createdAt: 'desc' } },
    intakeLinks: { orderBy: { createdAt: 'desc' } },
    leadCaptures: { orderBy: { createdAt: 'desc' } },
    // Most recent invite only -- the Customer Portal section derives status
    // from computePortalAdoptionOverview() (same source of truth as the
    // rollout/adoption dashboard), this is just for invite/reminder dates.
    portalInvites: { orderBy: { createdAt: 'desc' }, take: 1 },
  },
})
export type CustomerProfile = Prisma.CustomerGetPayload<typeof customerProfileInclude>

// Single rich fetch for the admin customer-profile page — everything the
// spec's profile view needs in one round trip, mirroring InvoiceWithRelations'
// shape/rationale in lib/invoices.ts. Not used by listCustomers/getCustomer,
// which stay intentionally cheap for table/lookup use.
export async function getCustomerProfileData(customerId: string): Promise<CustomerProfile | null> {
  return prisma.customer.findUnique({ where: { id: customerId }, ...customerProfileInclude })
}

// Separate, lightweight query for the profile page's Invoices table only --
// deliberately NOT used for the "Total Outstanding"/"Invoices" count stats
// above it, which stay computed from getCustomerProfileData's unbounded
// customer.invoices. Scoping this one to a period must never make those
// lifetime totals look wrong.
export async function getCustomerInvoiceHistory(customerId: string, period?: InvoiceHistoryPeriod) {
  return prisma.invoice.findMany({
    where: { customerId, deletedAt: null, ...buildPeriodDateFilter(period) },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      paymentStatus: true,
      balanceDue: true,
      createdAt: true,
      carrier: true,
      trackingNumber: true,
      archivedAt: true,
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
