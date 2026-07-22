// Settings > Admin Notifications — who gets notified when a customer submits
// an intake form. Directly blocks production validation of the Phase 2A
// milestone until at least one recipient exists.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listAdminNotificationRecipients } from '@/lib/adminNotificationRecipients'
import { ADMIN_EMAIL } from '@/lib/resend'
import { NotificationRecipientsForm } from '@/components/invoices/NotificationRecipientsForm'

export default async function NotificationSettingsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const recipients = await listAdminNotificationRecipients()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Notification Settings</h1>
            <p className="text-white/50 text-sm mt-1">Settings · Admin Notifications · Pepscore</p>
          </div>
          <Link
            href="/admin/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Invoices
          </Link>
        </div>

        <NotificationRecipientsForm initialRecipients={recipients} suggestedEmail={ADMIN_EMAIL} />
      </div>
    </main>
  )
}
