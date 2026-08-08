// Read-only reminder preview -- lets the owner see exactly what the
// reminder cron would do for every non-terminal invite before any real
// reminder is ever activated. No provider send occurs from rendering this.
import type { ReminderPreviewEntry } from '@/lib/portal/reminderPreview'
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'

const STAGE_LABEL: Record<ReminderPreviewEntry['stage'], string> = {
  DAY_3_DUE: 'Day-3 reminder due',
  DAY_6_DUE: 'Day-6 reminder due',
  NOT_YET_DUE: 'Not yet due',
  MAX_REMINDERS_REACHED: 'Max reminders sent',
  EXCLUDED_TEST_DATA: 'Excluded — test/QA record',
  EXCLUDED_IDENTITY_CONFLICT: 'Excluded — identity conflict',
  EXCLUDED_NOT_ACTIVE: 'Excluded — claimed/revoked/expired',
}

const STAGE_STYLE: Record<ReminderPreviewEntry['stage'], string> = {
  DAY_3_DUE: 'border-gold/40 bg-gold/10 text-gold-light',
  DAY_6_DUE: 'border-gold/40 bg-gold/10 text-gold-light',
  NOT_YET_DUE: 'border-white/15 bg-white/5 text-white/50',
  MAX_REMINDERS_REACHED: 'border-white/15 bg-white/5 text-white/40',
  EXCLUDED_TEST_DATA: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  EXCLUDED_IDENTITY_CONFLICT: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  EXCLUDED_NOT_ACTIVE: 'border-white/15 bg-white/5 text-white/40',
}

export function ReminderPreviewTable({ entries }: { entries: ReminderPreviewEntry[] }) {
  return (
    <div className={`${card} p-6`}>
      <h3 className={sectionHeading}>Reminder Preview ({entries.length})</h3>
      <p className={`text-sm ${mutedText} mt-1 mb-4`}>
        Every open (unclaimed, unrevoked) invite and what the reminder cron would do for it right now. Contact destinations are masked. No send occurs from viewing this.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Customer</th>
              <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Contact</th>
              <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Invite Age</th>
              <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Expires</th>
              <th className="text-left py-2 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.inviteId} className="border-b border-white/5">
                <td className="py-3 pr-4 text-white whitespace-nowrap">{e.customerName}</td>
                <td className={`py-3 pr-4 whitespace-nowrap ${mutedText}`}>{e.maskedContact}</td>
                <td className={`py-3 pr-4 whitespace-nowrap ${mutedText}`}>{e.inviteAgeDays === 0 ? 'Today' : `${e.inviteAgeDays}d`}</td>
                <td className={`py-3 pr-4 whitespace-nowrap ${mutedText}`}>{new Date(e.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
                <td className="py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${STAGE_STYLE[e.stage]}`}>
                    {STAGE_LABEL[e.stage]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
