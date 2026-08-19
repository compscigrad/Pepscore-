// Settings > Fulfillment — return address, default package dimensions, and
// reusable package presets used by the "Create Shipping Label" panel.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFulfillmentSettings } from '@/lib/fulfillment/settings'
import { listPackagePresets } from '@/lib/fulfillment/presets'
import { FulfillmentSettingsForm } from '@/components/invoices/FulfillmentSettingsForm'
import { PackagePresetsForm } from '@/components/invoices/PackagePresetsForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function FulfillmentSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [settings, presets] = await Promise.all([getFulfillmentSettings(), listPackagePresets()])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Fulfillment Settings"
          subtitle="Settings · Fulfillment · Pepscore Lab"
          actions={
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          }
        />

        <div className="space-y-6">
          <FulfillmentSettingsForm
            initialReturnAddress={settings.returnAddress}
            initialDefaultWeightOz={settings.defaultWeightOz}
            initialDefaultLengthIn={settings.defaultLengthIn}
            initialDefaultWidthIn={settings.defaultWidthIn}
            initialDefaultHeightIn={settings.defaultHeightIn}
            initialLabelNeededHours={settings.labelNeededHours}
            initialAwaitingScanHours={settings.awaitingScanHours}
            initialStalledInTransitHours={settings.stalledInTransitHours}
          />
          <PackagePresetsForm initialPresets={presets} />
        </div>
      </div>
    </main>
  )
}
