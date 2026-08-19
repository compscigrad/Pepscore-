// Settings > Acquisition Popup — first-visit lead-capture popup trigger/
// suppression/nurture-cadence mechanics (2026-08-19 lead-capture/conversion
// engine). See AcquisitionPopupSettingsForm for the actual controls.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAcquisitionPopupSettings } from '@/lib/promotions/acquisitionPopupSettings'
import { AcquisitionPopupSettingsForm } from '@/components/admin/AcquisitionPopupSettingsForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function AcquisitionPopupSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const settings = await getAcquisitionPopupSettings()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Acquisition Popup"
          subtitle="Settings · Acquisition Popup · Pepscore Lab"
          actions={
            <>
              <Link
                href="/admin/promotions"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                Campaigns →
              </Link>
              <Link
                href="/admin/settings/invoices"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                ← Invoice Settings
              </Link>
            </>
          }
        />

        <AcquisitionPopupSettingsForm
          initial={{
            enabled: settings.enabled,
            delayMs: settings.delayMs,
            scrollThresholdPercent: settings.scrollThresholdPercent,
            exitIntentEnabled: settings.exitIntentEnabled,
            capturedSuppressDays: settings.capturedSuppressDays,
            dismissedSuppressDays: settings.dismissedSuppressDays,
            reminderIntervalsHours: settings.reminderIntervalsHours,
          }}
        />
      </div>
    </main>
  )
}
