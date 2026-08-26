// Validation for the public Price Match Guarantee submission endpoint
// (app/api/price-match/route.ts). Same honeypot shape as
// lib/professionalAccess/validation.ts and lib/leads/validation.ts.
// Delivered-price comparison basis is enforced structurally: competitorPrice
// and competitorDeliveredPrice are always collected as two separate numbers
// (never a single free-typed "price"), so a submission can't skip past the
// distinction the owner explicitly locked (sticker price is not the basis;
// delivered price is).
import { z } from 'zod'

const SELL_UNITS = ['CASE_STANDARD', 'CASE_PRO', 'CASE_BULK', 'INDIVIDUAL_VIAL'] as const

export const priceMatchRequestSchema = z.object({
  contactName: z.string().trim().min(1, 'Name is required').max(200),
  contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  contactPhone: z.string().trim().max(40).optional(),
  // Only EMAIL/PHONE are ever offered here (never SMS) -- reuses
  // Customer.preferredContactMethod's existing enum values.
  preferredContactMethod: z.enum(['EMAIL', 'PHONE']),

  productId: z.string().trim().min(1, 'Select a product'),
  sellUnit: z.enum(SELL_UNITS),

  competitorName: z.string().trim().min(1, 'Competitor / source name is required').max(200),
  competitorUrl: z.string().trim().max(500).optional(),
  competitorPrice: z.number().finite().positive('Enter the competitor’s listed price'),
  competitorShippingCost: z.number().finite().min(0).optional(),
  competitorDeliveredPrice: z.number().finite().positive('Enter the total delivered price (item + shipping)'),

  proofUrl: z.string().trim().max(500).optional(),
  proofNote: z.string().trim().max(1000).optional(),
  customerNote: z.string().trim().max(1000).optional(),

  sourcePage: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).nullable().optional(),
  landingUrl: z.string().trim().max(500).nullable().optional(),
  consent: z.boolean().refine((v) => v === true, { message: 'You must agree to be contacted about this request' }),
  // Honeypot -- real visitors never see this field.
  website2: z.string().optional(),
}).refine((data) => data.preferredContactMethod !== 'PHONE' || !!data.contactPhone, {
  message: 'Enter a phone number to be contacted by phone',
  path: ['contactPhone'],
})

export type PriceMatchRequestSubmission = z.infer<typeof priceMatchRequestSchema>

export function isHoneypotTripped(payload: Pick<PriceMatchRequestSubmission, 'website2'>): boolean {
  return !!payload.website2
}
