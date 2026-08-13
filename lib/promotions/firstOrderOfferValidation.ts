// Validation for the public FIRST10 claim endpoint
// (app/api/promotions/first-order-offer/claim/route.ts). Deliberately
// stricter than lib/leads/validation.ts's leadCaptureSchema: this offer
// requires BOTH email AND phone (not "at least one"), plus a literal-true
// marketing-consent checkbox, since the whole point is a reachable,
// consented lead worth a real discount.
import { z } from 'zod'

export const firstOrderOfferClaimSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  // .toLowerCase() added 2026-08-12 -- see lib/leads/validation.ts's
  // identical fix for why (case-only email variants previously bypassed
  // the exact-match dedup lookup in findCustomerByEmailOrPhone()).
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(40),
  consent: z.boolean().refine((v) => v === true, {
    message: 'You must agree to be contacted to claim this offer.',
  }),
  sourcePage: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).nullable().optional(),
  landingUrl: z.string().trim().max(500).nullable().optional(),
  utmSource: z.string().trim().max(200).nullable().optional(),
  utmMedium: z.string().trim().max(200).nullable().optional(),
  utmCampaign: z.string().trim().max(200).nullable().optional(),
  utmTerm: z.string().trim().max(200).nullable().optional(),
  utmContent: z.string().trim().max(200).nullable().optional(),
  // Honeypot -- hidden from real visitors via CSS, matching leadCaptureSchema.
  website: z.string().optional(),
})

export type FirstOrderOfferClaimSubmission = z.infer<typeof firstOrderOfferClaimSchema>

export function isHoneypotTripped(payload: Pick<FirstOrderOfferClaimSubmission, 'website'>): boolean {
  return !!payload.website
}
