// Phase 2B item 7 -- the one place a storefront lead-capture submission
// gets turned into a Customer + LeadCapture row. Reuses
// upsertCustomerFromIntake() (lib/customers.ts) so a repeat submitter
// (matched by email or phone, same rule as every other intake path in
// this codebase) never creates a duplicate Customer -- a second
// submission from the same person adds a second LeadCapture row pointing
// at their existing Customer, never a second Customer.
import { prisma } from '@/lib/prisma'
import { upsertCustomerFromIntake, recordCustomerActivity } from '@/lib/customers'
import type { LeadInterestType } from '@prisma/client'

export interface CaptureLeadInput {
  name: string
  email?: string | null
  phone?: string | null
  interestType: LeadInterestType
  productSlug?: string | null
  productName?: string | null
  productSize?: string | null
  message?: string | null
  sourcePage: string
  referrer?: string | null
  landingUrl?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  consent: boolean
}

// Customer.firstName/lastName are both required, but a lead-capture form
// only ever collects a single "name" field (same convention as the
// existing contact form, lib/contactInquiry/validation.ts) -- split on
// the first space; a single-word name becomes firstName with an empty
// lastName rather than guessing.
function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() }
}

export async function captureLead(input: CaptureLeadInput) {
  const { firstName, lastName } = splitName(input.name)

  const { customer, isNewCustomer } = await upsertCustomerFromIntake({
    firstName,
    lastName,
    email: input.email,
    phone: input.phone,
  })

  const lead = await prisma.leadCapture.create({
    data: {
      customerId: customer.id,
      interestType: input.interestType,
      productSlug: input.productSlug ?? undefined,
      productName: input.productName ?? undefined,
      productSize: input.productSize ?? undefined,
      message: input.message ?? undefined,
      sourcePage: input.sourcePage,
      referrer: input.referrer ?? undefined,
      landingUrl: input.landingUrl ?? undefined,
      utmSource: input.utmSource ?? undefined,
      utmMedium: input.utmMedium ?? undefined,
      utmCampaign: input.utmCampaign ?? undefined,
      utmTerm: input.utmTerm ?? undefined,
      utmContent: input.utmContent ?? undefined,
      consent: input.consent,
    },
  })

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'LEAD_CAPTURED',
    newValue: input.interestType,
    source: 'SYSTEM',
  })

  return { lead, customer, isNewCustomer }
}
