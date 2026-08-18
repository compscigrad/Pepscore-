// AI-0B.2 -- post-generation output validation patterns (owner instruction,
// item 5: "Do not depend solely on the generating model to police itself").
// Runs against the actual generated text regardless of what category the
// input was classified as -- an ALLOWED research question can still
// produce a REFUSE-worthy answer.
import type { OutputValidationAction } from './types'

export interface OutputRule {
  pattern: RegExp
  action: OutputValidationAction
  description: string
}

export const OUTPUT_VALIDATION_RULES: OutputRule[] = [
  { pattern: /\byou should (take|inject|use)\s+\d/i, action: 'REFUSE', description: 'output contains a personal dosing instruction' },
  { pattern: /\b(inject|take)\s+\d+\s*(mg|mcg|units|iu)\b/i, action: 'REFUSE', description: 'output contains a specific administration amount' },
  { pattern: /\brecommended (dose|dosage) for (you|a person)\b/i, action: 'REFUSE', description: 'output contains a personalized dosing recommendation' },
  { pattern: /\b(ADMIN_CLERK_USER_ID|CLERK_SECRET_KEY|STRIPE_SECRET_KEY|DATABASE_URL|AI_GATEWAY_API_KEY)\b/i, action: 'REFUSE', description: 'output contains a secret/env-var name (policy leakage)' },
]
