// Email delivery channel — sends to every AdminNotificationRecipient with
// emailEnabled and an email on file, via the existing Resend integration.
// Never throws: a failed send is logged, not fatal to the intake submission
// that triggered it (same "notification failure never blocks the customer
// flow" principle as lib/tracking/notifications.tsx).
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { buildAdminIntakeNotificationHtml, adminIntakeNotificationSubject } from '@/emails/AdminIntakeNotification'
import type { NotificationChannel, IntakeNotificationPayload, AdminNotificationRecipientLike } from '../types'

export const emailChannel: NotificationChannel = {
  name: 'email',
  async send(payload: IntakeNotificationPayload, recipients: AdminNotificationRecipientLike[]) {
    const targets = recipients.filter((r) => r.emailEnabled && r.email)
    if (targets.length === 0) return

    const html = buildAdminIntakeNotificationHtml(payload)
    const subject = adminIntakeNotificationSubject(payload.customerName)

    // Was literally `from: ADMIN_EMAIL` (admin@pepscorelab.com) — Resend
    // rejects sends whose From uses an unverified domain, so this send was
    // silently failing until the routing-centralization pass fixed it.
    await Promise.all(
      targets.map((r) =>
        sendCategorizedEmail(
          { category: 'ADMIN_INTAKE_ALERT', to: r.email!, subject, html },
          { customerId: payload.customerId, invoiceId: payload.invoiceId, actorType: 'SYSTEM' }
        ).catch((err) => {
          console.error('[notifications/email] send failed:', err)
        })
      )
    )
  },
}
