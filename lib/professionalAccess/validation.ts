// Validation for the public Professional Access application endpoint
// (app/api/professional-access/apply/route.ts). Same honeypot shape as
// lib/leads/validation.ts and lib/contactInquiry/validation.ts. Deliberately
// collects only business-verification fields -- never a human-use/treatment
// certification of any kind (section 10's standing rule).
import { z } from 'zod'

export const professionalAccessApplicationSchema = z.object({
  contactName: z.string().trim().min(1, 'Contact name is required').max(200),
  businessName: z.string().trim().min(1, 'Business/organization name is required').max(200),
  businessEmail: z.string().trim().toLowerCase().email('Enter a valid email address').max(320),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(300).optional(),
  businessType: z.string().trim().max(200).optional(),
  businessAddress: z
    .object({
      street1: z.string().trim().max(200).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      zip: z.string().trim().max(20).optional(),
      country: z.string().trim().max(100).optional(),
    })
    .optional(),
  jurisdiction: z.string().trim().max(200).optional(),
  registrationInfo: z.string().trim().max(300).optional(),
  purposeDescription: z.string().trim().max(2000).optional(),
  expectedVolume: z.string().trim().max(200).optional(),
  sourcePage: z.string().trim().min(1).max(500),
  referrer: z.string().trim().max(500).nullable().optional(),
  landingUrl: z.string().trim().max(500).nullable().optional(),
  consent: z.boolean().refine((v) => v === true, { message: 'You must agree to be contacted about this application' }),
  // Honeypot -- real visitors never see this field.
  website2: z.string().optional(),
})

export type ProfessionalAccessApplicationSubmission = z.infer<typeof professionalAccessApplicationSchema>

export function isHoneypotTripped(payload: Pick<ProfessionalAccessApplicationSubmission, 'website2'>): boolean {
  return !!payload.website2
}
