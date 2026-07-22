// zod schema for the public intake-form submission payload — same nested-
// object/optional conventions as lib/invoice/validation.ts's addressSchema,
// but deliberately permissive: a customer completes only what they know,
// and pricing/products/discounts/tracking/totals never appear on this form
// at all (there's nothing here to validate for fields that don't exist).
import { z } from 'zod'

const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be 5 digits (or ZIP+4)'),
  country: z.string().min(1).default('US'),
})

export const intakeSubmissionSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    billingAddress: addressSchema.optional(),
    shippingAddress: addressSchema.optional(),
    preferredContactMethod: z.enum(['SMS', 'EMAIL', 'PHONE']).optional(),
    preferredPaymentMethod: z
      .enum(['CASH', 'ZELLE', 'CASH_APP', 'APPLE_PAY', 'VENMO', 'ACH', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER'])
      .optional(),
    notes: z.string().optional(),
    // Honeypot — real customers never see this field; a bot filling every
    // input will. Silently accepted-and-ignored by the caller, never a hard
    // validation error, so a bot gets no signal it was caught.
    website: z.string().optional(),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: 'Provide at least an email or phone number',
    path: ['email'],
  })

export type IntakeSubmission = z.infer<typeof intakeSubmissionSchema>

export function isHoneypotTripped(payload: Pick<IntakeSubmission, 'website'>): boolean {
  return !!payload.website
}
