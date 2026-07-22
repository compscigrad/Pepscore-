// Settings > Invoices — auto-archive delay, tracking notifications, and
// automatic invoice-issued emails.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { InvoiceSettingsForm } from '@/components/invoices/InvoiceSettingsForm'
import { TrackingNotificationSettingsForm } from '@/components/invoices/TrackingNotificationSettingsForm'
import { InvoiceEmailSettingsForm } from '@/components/invoices/InvoiceEmailSettingsForm'
import { PaymentReceivedEmailSettingsForm } from '@/components/invoices/PaymentReceivedEmailSettingsForm'

export default async function InvoiceSettingsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const settings = await getInvoiceSettings()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Invoice Settings</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Invoices · Pepscore</p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/admin/settings/fulfillment"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Fulfillment Settings →
            </Link>
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <InvoiceSettingsForm initialArchiveAfterDays={settings.archiveAfterDays} />
          <InvoiceEmailSettingsForm initialEnabled={settings.autoEmailInvoiceOnIssue} />
          <PaymentReceivedEmailSettingsForm initialEnabled={settings.autoEmailPaymentReceived} />
          <TrackingNotificationSettingsForm initialEnabled={settings.trackingNotificationsEnabled} />
        </div>
      </div>
    </main>
  )
}
