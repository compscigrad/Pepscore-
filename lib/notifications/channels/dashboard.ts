// Dashboard delivery is trivial: the Notification row (already created by
// dispatch.ts before any channel runs) *is* the delivery — the admin
// dashboard reads it via GET /api/admin/notifications and polls for unread
// ones. Nothing to send here.
import type { NotificationChannel } from '../types'

export const dashboardChannel: NotificationChannel = {
  name: 'dashboard',
  async send() {},
}
