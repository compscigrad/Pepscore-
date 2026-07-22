// Public, token-authenticated customer intake links — see docs/Decisions.md.
// The token (never this row's own id) is the entire security boundary, same
// pattern as the Shippo webhook's ?token= and CRON_SECRET. Multi-use until
// expiry/invalidation, not single-use, so a customer who doesn't finish (or
// an admin re-requesting info on an open draft) can reuse the same link.
import crypto from 'crypto'
import type { IntakeLink } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getInvoiceSettings } from '@/lib/invoiceSettings'

// The token itself (unguessable, 48 hex chars) is the primary spam defense
// (Decision 12); this just caps brute-force attempts against a single link.
const MAX_SUBMISSION_ATTEMPTS = 20

export interface GenerateIntakeLinkInput {
  customerId?: string | null
  invoiceId?: string | null
  createdBy: string
}

export async function generateIntakeLink(input: GenerateIntakeLinkInput): Promise<IntakeLink> {
  const settings = await getInvoiceSettings()
  const expiresAt = new Date(Date.now() + settings.defaultIntakeLinkExpiryHours * 60 * 60 * 1000)
  const token = crypto.randomBytes(24).toString('hex')

  return prisma.intakeLink.create({
    data: {
      token,
      customerId: input.customerId ?? undefined,
      invoiceId: input.invoiceId ?? undefined,
      createdBy: input.createdBy,
      expiresAt,
    },
  })
}

export type IntakeLinkValidation =
  | { valid: true; link: IntakeLink }
  | { valid: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'INVALIDATED' | 'TOO_MANY_ATTEMPTS' }

// Marks viewedAt on first read — feeds the "Intake Viewed" timeline event
// and intake analytics (completion rate, avg completion time). Called on
// both GET (page load) and POST (submission uses the same validity check).
export async function validateIntakeLink(token: string): Promise<IntakeLinkValidation> {
  const link = await prisma.intakeLink.findUnique({ where: { token } })
  if (!link) return { valid: false, reason: 'NOT_FOUND' }
  if (link.invalidatedAt) return { valid: false, reason: 'INVALIDATED' }
  if (link.expiresAt < new Date()) return { valid: false, reason: 'EXPIRED' }
  if (link.submissionAttempts >= MAX_SUBMISSION_ATTEMPTS) return { valid: false, reason: 'TOO_MANY_ATTEMPTS' }

  if (!link.viewedAt) {
    await prisma.intakeLink.update({ where: { token }, data: { viewedAt: new Date() } })
  }

  return { valid: true, link }
}

export async function recordSubmissionAttempt(token: string): Promise<void> {
  await prisma.intakeLink.update({ where: { token }, data: { submissionAttempts: { increment: 1 } } })
}

export async function markIntakeLinkSubmitted(token: string): Promise<void> {
  await prisma.intakeLink.update({ where: { token }, data: { submittedAt: new Date() } })
}

export async function invalidateIntakeLink(id: string): Promise<void> {
  await prisma.intakeLink.update({ where: { id }, data: { invalidatedAt: new Date() } })
}

// Invalidate the old link and mint a fresh one with the same customer/
// invoice association — the one-click "Regenerate Link" action.
export async function regenerateIntakeLink(id: string, createdBy: string): Promise<IntakeLink> {
  const existing = await prisma.intakeLink.findUniqueOrThrow({ where: { id } })
  await invalidateIntakeLink(id)
  return generateIntakeLink({ customerId: existing.customerId, invoiceId: existing.invoiceId, createdBy })
}
