// Read-only, side-effect-free preview of every non-terminal portal invite's
// reminder status -- the data behind /admin/portal-rollout's reminder
// section and its detailed preview table. Never sends anything; classifying
// an invite here has zero effect on what the cron actually does (the cron
// runs the identical classifyReminderStage() independently).
import { prisma } from '@/lib/prisma'
import { classifyReminderStage, type ReminderStage } from '@/lib/portal/reminderEligibility'

export interface ReminderPreviewEntry {
  customerId: string
  inviteId: string
  customerName: string
  maskedContact: string
  stage: ReminderStage
  inviteAgeDays: number
  expiresAt: Date
}

export interface ReminderPreviewSummary {
  entries: ReminderPreviewEntry[]
  eligibleDay3: number
  eligibleDay6: number
}

// Never shows a full email/phone in an admin list rendered from a live
// database read -- masking the same way every other "show it's real
// without exposing it" surface in this codebase does (see
// components/account's payment-method last4 pattern).
export function maskContact(email: string | null, phone: string | null): string {
  if (email) {
    const [local, domain] = email.split('@')
    if (!domain) return '•••'
    const visible = local.slice(0, 2)
    return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}@${domain}`
  }
  if (phone) {
    const digits = phone.replace(/\D/g, '')
    const last4 = digits.slice(-4)
    return last4.length === 4 ? `(•••) •••-${last4}` : '•••'
  }
  return '—'
}

export async function getReminderPreview(): Promise<ReminderPreviewSummary> {
  const [invites, openReviewCases] = await Promise.all([
    prisma.customerPortalInvite.findMany({
      where: { claimedAt: null, revokedAt: null },
      include: { customer: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customerIdentityReviewCase.findMany({ where: { status: 'OPEN' }, select: { customerId: true } }),
  ])
  const conflictCustomerIds = new Set(openReviewCases.map((r) => r.customerId).filter((id): id is string => Boolean(id)))
  const now = Date.now()

  const entries: ReminderPreviewEntry[] = invites.map((invite) => ({
    customerId: invite.customerId,
    inviteId: invite.id,
    customerName: `${invite.customer.firstName} ${invite.customer.lastName}`.trim(),
    maskedContact: maskContact(invite.customer.email, invite.customer.phone),
    stage: classifyReminderStage(invite, invite.customer, { now, conflictCustomerIds }),
    inviteAgeDays: Math.floor((now - invite.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    expiresAt: invite.expiresAt,
  }))

  return {
    entries,
    eligibleDay3: entries.filter((e) => e.stage === 'DAY_3_DUE').length,
    eligibleDay6: entries.filter((e) => e.stage === 'DAY_6_DUE').length,
  }
}
