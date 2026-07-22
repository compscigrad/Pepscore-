// Pluggable admin-notification-channel abstraction — mirrors the
// ShippingProvider pattern in lib/tracking/types.ts. Every delivery channel
// (dashboard, email, future SMS/Slack/Discord/Teams/push) implements
// NotificationChannel; lib/notifications/dispatch.ts fans a single event out
// to whichever channels are relevant, and nothing outside this directory
// needs to know how any one channel actually delivers.
export interface AdminNotificationRecipientLike {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  emailEnabled: boolean
  smsEnabled: boolean
}

export interface IntakeNotificationPayload {
  notificationId: string
  customerId: string
  customerName: string
  invoiceId: string
  invoiceNumber: string
  isNewCustomer: boolean
  possibleDuplicateOf?: string | null
  submittedAt: Date
}

export interface NotificationChannel {
  readonly name: string
  send(payload: IntakeNotificationPayload, recipients: AdminNotificationRecipientLike[]): Promise<void>
}
