// Email delivery channel — sends to every AdminNotificationRecipient with
// emailEnabled and an email on file, via the existing Resend integration.
// Never throws: a failed send is logged, not fatal to the intake submission
// that triggered it (same "notification failure never blocks the customer
// flow" principle as lib/tracking/notifications.tsx).
import { resend, ADMIN_EMAIL } from '@/lib/resend'
import { buildAdminIntakeNotificationHtml, adminIntakeNotificationSubject } from '@/emails/AdminIntakeNotification'
import type { NotificationChannel, IntakeNotificationPayload, AdminNotificationRecipientLike } from '../types'

export const emailChannel: NotificationChannel = {
  name: 'email',
  async send(payload: IntakeNotificationPayload, recipients: AdminNotificationRecipientLike[]) {
    const targets = recipients.filter((r) => r.emailEnabled && r.email)
    if (targets.length === 0) return

    const html = buildAdminIntakeNotificationHtml(payload)
    const subject = adminIntakeNotificationSubject(payload.customerName)

    await Promise.all(
      targets.map((r) =>
        resend.emails.send({ from: ADMIN_EMAIL, to: r.email!, subject, html }).catch((err) => {
          console.error('[notifications/email] send failed:', err)
        })
      )
    )
  },
}
