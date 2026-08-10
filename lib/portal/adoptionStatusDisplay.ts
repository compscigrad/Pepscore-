// Shared label/style maps for PortalAdoptionStatus -- used by both the
// customer profile page's Customer Portal section and the customer list's
// Portal column/filter, so the two views can never show different wording
// for the same underlying status.
import type { PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'

export const PORTAL_ADOPTION_STATUS_LABEL: Record<PortalAdoptionStatus, string> = {
  NOT_ELIGIBLE: 'Not Yet Eligible',
  ELIGIBLE: 'Eligible — Not Yet Invited',
  INVITE_PENDING: 'Invite Pending Next Automated Run',
  INVITED: 'Invited',
  REMINDER_1_SENT: 'Invited — Reminder Sent',
  REMINDER_2_SENT: 'Invited — Final Reminder Sent',
  PORTAL_ACTIVE: 'Portal Active',
  EXCLUDED: 'Excluded',
  IDENTITY_REVIEW_REQUIRED: 'Needs Identity Review',
}

export const PORTAL_ADOPTION_STATUS_STYLE: Record<PortalAdoptionStatus, string> = {
  NOT_ELIGIBLE: 'bg-white/5 text-white/40 border border-white/10',
  ELIGIBLE: 'bg-white/5 text-white/60 border border-white/10',
  INVITE_PENDING: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  INVITED: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  REMINDER_1_SENT: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  REMINDER_2_SENT: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
  PORTAL_ACTIVE: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20',
  EXCLUDED: 'bg-white/5 text-white/40 border border-white/10',
  IDENTITY_REVIEW_REQUIRED: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
}

export const PORTAL_ADOPTION_STATUS_VALUES: PortalAdoptionStatus[] = [
  'NOT_ELIGIBLE',
  'ELIGIBLE',
  'INVITE_PENDING',
  'INVITED',
  'REMINDER_1_SENT',
  'REMINDER_2_SENT',
  'PORTAL_ACTIVE',
  'EXCLUDED',
  'IDENTITY_REVIEW_REQUIRED',
]
