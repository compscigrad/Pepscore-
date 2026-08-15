// Settings > Invoices — auto-archive delay, tracking notifications, and
// automatic invoice-issued emails.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { InvoiceSettingsForm } from '@/components/invoices/InvoiceSettingsForm'
import { TrackingNotificationSettingsForm } from '@/components/invoices/TrackingNotificationSettingsForm'
import { InvoiceEmailSettingsForm } from '@/components/invoices/InvoiceEmailSettingsForm'
import { PaymentReceivedEmailSettingsForm } from '@/components/invoices/PaymentReceivedEmailSettingsForm'

export default async function InvoiceSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const settings = await getInvoiceSettings()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Invoice Settings</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Invoices · Pepscore Lab</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/admin/settings/discounts"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Discount Presets →
            </Link>
            <Link
              href="/admin/settings/fulfillment"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Fulfillment Settings →
            </Link>
            <Link
              href="/admin/settings/first-order-offer"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              First-Order Offer →
            </Link>
            <Link
              href="/admin/settings/payments"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Payment Settings →
            </Link>
            <Link
              href="/admin/settings/email-templates"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              Email Templates →
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
