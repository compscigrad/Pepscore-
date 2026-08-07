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
] as const

// At least one of email/phone must be present -- a lead with neither is
// unreachable and not worth a Customer row (refined below, not a plain
// object schema, since this crosses two optional fields).
const baseLeadCaptureSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  interestType: z.enum(LEAD_INTEREST_TYPES),
  productSlug: z.string().trim().max(200).optional(),
  productName: z.string().trim().max(200).optional(),
  productSize: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
  sourcePage: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).optional(),
  landingUrl: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
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
