// Settings > Admin Notifications — who gets notified when a customer submits
// an intake form. Directly blocks production validation of the Phase 2A
// milestone until at least one recipient exists.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listAdminNotificationRecipients } from '@/lib/adminNotificationRecipients'
import { ADMIN_EMAIL } from '@/lib/resend'
import { NotificationRecipientsForm } from '@/components/invoices/NotificationRecipientsForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function NotificationSettingsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const recipients = await listAdminNotificationRecipients()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Notification Settings"
          subtitle="Settings · Admin Notifications · Pepscore Lab"
          actions={
            <>
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

        <NotificationRecipientsForm initialRecipients={recipients} suggestedEmail={ADMIN_EMAIL} />
      </div>
    </main>
  )
}
