// Settings > Fulfillment — return address, default package dimensions, and
// reusable package presets used by the "Create Shipping Label" panel.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFulfillmentSettings } from '@/lib/fulfillment/settings'
import { listPackagePresets } from '@/lib/fulfillment/presets'
import { FulfillmentSettingsForm } from '@/components/invoices/FulfillmentSettingsForm'
import { PackagePresetsForm } from '@/components/invoices/PackagePresetsForm'

export default async function FulfillmentSettingsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const [settings, presets] = await Promise.all([getFulfillmentSettings(), listPackagePresets()])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Fulfillment Settings</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Fulfillment · Pepscore</p>
          </div>
          <Link
            href="/admin/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Invoices
          </Link>
        </div>

        <div className="space-y-6">
          <FulfillmentSettingsForm
            initialReturnAddress={settings.returnAddress}
            initialDefaultWeightOz={settings.defaultWeightOz}
            initialDefaultLengthIn={settings.defaultLengthIn}
            initialDefaultWidthIn={settings.defaultWidthIn}
            initialDefaultHeightIn={settings.defaultHeightIn}
          />
          <PackagePresetsForm initialPresets={presets} />
        </div>
      </div>
    </main>
  )
}
