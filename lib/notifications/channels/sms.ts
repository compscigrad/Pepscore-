// SMS delivery channel — pluggable stub until a real SMS provider (Twilio)
// is configured. Logs what would have been sent server-side instead of
// throwing, so the rest of the notification fan-out is unaffected.
// Activating real SMS later means implementing the provider call in this
// one file — nothing else in lib/notifications/ or its callers changes.
import type { NotificationChannel, IntakeNotificationPayload, AdminNotificationRecipientLike } from '../types'

export const smsChannel: NotificationChannel = {
  name: 'sms',
  async send(payload: IntakeNotificationPayload, recipients: AdminNotificationRecipientLike[]) {
    const targets = recipients.filter((r) => r.smsEnabled && r.phone)
    if (targets.length === 0) return

    for (const recipient of targets) {
      console.log(
        `[notifications/sms] stub (no SMS provider configured) — would text ${recipient.phone}: ` +
          `New intake from ${payload.customerName} — draft ${payload.invoiceNumber}`
      )
    }
  },
}
