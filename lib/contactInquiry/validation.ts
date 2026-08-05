// Validation for the public storefront contact/wholesale-inquiry form
// (app/api/contact/route.ts). Same honeypot shape as
// lib/intake/validation.ts's intakeSubmissionSchema — a hidden `website`
// field a real visitor never sees or fills.
import { z } from 'zod'

export const contactInquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(200).optional(),
  // Free-text category from the submitting form's own picker (e.g. the
  // marketing site's "Wholesale Inquiry" / "Research Partnership" select) —
  // informational only, included in the admin notification. Every value
  // this can take is a pre-purchase/business-development inquiry per the
  // routing policy, so it never changes which mailbox this routes to
  // (always CONTACT_EMAIL, via routeFor('CONTACT_INQUIRY') in routing.ts).
  inquiryType: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1, 'Message is required').max(4000),
  // Honeypot — real visitors never see this field (hidden via CSS in the
  // form). A bot that fills it gets a fake success, never processed.
  website: z.string().optional(),
})

export type ContactInquirySubmission = z.infer<typeof contactInquirySchema>

export function isHoneypotTripped(payload: Pick<ContactInquirySubmission, 'website'>): boolean {
  return !!payload.website
}
