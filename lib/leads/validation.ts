// Validation for the public storefront lead-capture endpoint
// (app/api/leads/route.ts). Same honeypot shape as
// lib/contactInquiry/validation.ts's contactInquirySchema.
import { z } from 'zod'

export const LEAD_INTEREST_TYPES = [
  'GENERAL_UPDATES',
  'LAUNCH_NOTIFICATION',
  'PRODUCT_INTEREST',
  'NOTIFY_WHEN_AVAILABLE',
  'OUT_OF_STOCK_INTEREST',
  'PRICING_REVIEW_INTEREST',
  'SPA_WHOLESALE_INQUIRY',
  'SINGLE_VIAL_SPECIAL_REQUEST',
  // Price-match inquiry (2026-08-19 lead-capture/conversion engine,
  // section 19) -- "Found a lower price? Request a price match."
  'PRICE_MATCH_REQUEST',
] as const

// At least one of email/phone must be present -- a lead with neither is
// unreachable and not worth a Customer row (refined below, not a plain
// object schema, since this crosses two optional fields).
const baseLeadCaptureSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  // .toLowerCase() added 2026-08-12 -- previously only trimmed, so
  // "Foo@X.com" and "foo@x.com" normalized to two different strings and
  // could each create a separate Customer/Lead record for the same real
  // person, defeating the first-order-offer dedup this schema feeds into.
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  interestType: z.enum(LEAD_INTEREST_TYPES),
  productSlug: z.string().trim().max(200).optional(),
  productName: z.string().trim().max(200).optional(),
  productSize: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
  sourcePage: z.string().trim().min(1).max(500),
  // Sourced from lib/storefront/attribution.ts's AttributionData, whose
  // fields are `string | null` (URLSearchParams.get()'s own return type)
  // -- .nullable() alongside .optional() so a literal JSON `null` (not
  // just an absent key) validates instead of failing every submission
  // that has no referrer/UTM params to report.
  referrer: z.string().trim().max(500).nullable().optional(),
  landingUrl: z.string().trim().max(500).nullable().optional(),
  utmSource: z.string().trim().max(200).nullable().optional(),
  utmMedium: z.string().trim().max(200).nullable().optional(),
  utmCampaign: z.string().trim().max(200).nullable().optional(),
  utmTerm: z.string().trim().max(200).nullable().optional(),
  utmContent: z.string().trim().max(200).nullable().optional(),
  consent: z.boolean(),
  // Honeypot -- real visitors never see this field (hidden via CSS in the
  // form). A bot that fills it gets a fake success, never processed.
  website: z.string().optional(),
})

export const leadCaptureSchema = baseLeadCaptureSchema.refine((data) => !!data.email || !!data.phone, {
  message: 'Enter an email address or phone number',
  path: ['email'],
})

export type LeadCaptureSubmission = z.infer<typeof baseLeadCaptureSchema>

export function isHoneypotTripped(payload: Pick<LeadCaptureSubmission, 'website'>): boolean {
  return !!payload.website
}
