// Public, token-authenticated customer intake links — see docs/Decisions.md.
// The token (never this row's own id) is the entire security boundary, same
// pattern as the Shippo webhook's ?token= and CRON_SECRET. Multi-use until
// expiry/invalidation, not single-use, so a customer who doesn't finish (or
// an admin re-requesting info on an open draft) can reuse the same link.
import crypto from 'crypto'
import type { IntakeLink } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { recordCustomerActivity } from '@/lib/customers'
import { MAX_SUBMISSION_ATTEMPTS, getIntakeLinkState } from '@/lib/intakeLinkState'
import type { IntakeLinkState } from '@/lib/intakeLinkState'

// Re-exported so existing server-side importers of this file keep working —
// but a client component must import these from '@/lib/intakeLinkState'
// directly, never from this file (which pulls in crypto/prisma).
export { getIntakeLinkState }
export type { IntakeLinkState }

export interface GenerateIntakeLinkInput {
  customerId?: string | null
  invoiceId?: string | null
  createdBy: string
}

export async function generateIntakeLink(input: GenerateIntakeLinkInput): Promise<IntakeLink> {
  const settings = await getInvoiceSettings()
  const expiresAt = new Date(Date.now() + settings.defaultIntakeLinkExpiryHours * 60 * 60 * 1000)
  const token = crypto.randomBytes(24).toString('hex')

  const link = await prisma.intakeLink.create({
    data: {
      token,
      customerId: input.customerId ?? undefined,
      invoiceId: input.invoiceId ?? undefined,
      createdBy: input.createdBy,
      expiresAt,
    },
  })

  // Timeline entry — write to whichever record already exists; a brand-new
  // customer won't have one yet, so this may log to the invoice only.
  if (link.customerId) {
    await recordCustomerActivity({
      customerId: link.customerId,
      invoiceId: link.invoiceId,
      eventType: 'INTAKE_LINK_GENERATED',
      source: 'MANUAL',
      userId: input.createdBy,
    })
  } else if (link.invoiceId) {
    await prisma.invoiceActivityLog.create({
      data: { invoiceId: link.invoiceId, eventType: 'INTAKE_LINK_GENERATED', source: 'MANUAL', userId: input.createdBy },
    })
  }

  return link
}

const USABLE_STATES: IntakeLinkState[] = ['ACTIVE', 'VIEWED', 'SUBMITTED']

// The requirement-11 safeguard: before minting a new link for an invoice or
// customer, check whether a still-usable one already exists so the admin can
// reuse/copy it instead of silently creating a second active link.
export async function findActiveIntakeLinkFor(input: {
  customerId?: string | null
  invoiceId?: string | null
}): Promise<IntakeLink | null> {
  if (!input.customerId && !input.invoiceId) return null

  const candidates = await prisma.intakeLink.findMany({
    where: {
      invalidatedAt: null,
      OR: [
        ...(input.customerId ? [{ customerId: input.customerId }] : []),
        ...(input.invoiceId ? [{ invoiceId: input.invoiceId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  return candidates.find((link) => USABLE_STATES.includes(getIntakeLinkState(link))) ?? null
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
    const viewedAt = new Date()
    await prisma.intakeLink.update({ where: { token }, data: { viewedAt } })
    link.viewedAt = viewedAt // the caller relies on this reflecting the just-made update, not the pre-update fetch
    if (link.customerId) {
      await recordCustomerActivity({
        customerId: link.customerId,
        invoiceId: link.invoiceId,
        eventType: 'INTAKE_LINK_VIEWED',
        source: 'SYSTEM',
      })
    } else if (link.invoiceId) {
      await prisma.invoiceActivityLog.create({
        data: { invoiceId: link.invoiceId, eventType: 'INTAKE_LINK_VIEWED', source: 'SYSTEM' },
      })
    }
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
