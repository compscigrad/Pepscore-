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
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function InvoiceSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const settings = await getInvoiceSettings()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Invoice Settings"
          subtitle="Settings · Invoices · Pepscore Lab"
          actions={
            <>
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
                href="/admin/settings/acquisition-popup"
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
              >
                Acquisition Popup →
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
            </>
          }
        />

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
