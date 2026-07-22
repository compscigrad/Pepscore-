// Invoice module settings — auto-archive delay and per-status tracking
// notification toggles. A dedicated single-row table (fixed id 'singleton')
// rather than folding this into an env var, since the spec calls for
// admin-editable UI settings, not deploy-time config values.
import { prisma } from '@/lib/prisma'
import type { ShippingStatus, Prisma } from '@prisma/client'

const SETTINGS_ID = 'singleton'

export interface InvoiceSettingsData {
  archiveAfterDays: number | null
  trackingNotificationsEnabled: Partial<Record<ShippingStatus, boolean>>
  autoEmailInvoiceOnIssue: boolean
  defaultIntakeLinkExpiryHours: number
  autoEmailPaymentReceived: boolean
}

function parseNotificationMap(value: Prisma.JsonValue | null): Partial<Record<ShippingStatus, boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Partial<Record<ShippingStatus, boolean>>
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

export async function updateInvoiceSettings(archiveAfterDays: number | null): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { archiveAfterDays },
    create: { id: SETTINGS_ID, archiveAfterDays },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

export async function updateTrackingNotificationSettings(
  enabled: Partial<Record<ShippingStatus, boolean>>
): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { trackingNotificationsEnabled: enabled as Prisma.InputJsonValue },
    create: { id: SETTINGS_ID, trackingNotificationsEnabled: enabled as Prisma.InputJsonValue },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

export async function updateAutoEmailInvoiceOnIssue(enabled: boolean): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { autoEmailInvoiceOnIssue: enabled },
    create: { id: SETTINGS_ID, autoEmailInvoiceOnIssue: enabled },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

export async function updateDefaultIntakeLinkExpiryHours(hours: number): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { defaultIntakeLinkExpiryHours: hours },
    create: { id: SETTINGS_ID, defaultIntakeLinkExpiryHours: hours },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

export async function updateAutoEmailPaymentReceived(enabled: boolean): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { autoEmailPaymentReceived: enabled },
    create: { id: SETTINGS_ID, autoEmailPaymentReceived: enabled },
  })
  return {
    archiveAfterDays: row.archiveAfterDays,
    trackingNotificationsEnabled: parseNotificationMap(row.trackingNotificationsEnabled),
    autoEmailInvoiceOnIssue: row.autoEmailInvoiceOnIssue,
    defaultIntakeLinkExpiryHours: row.defaultIntakeLinkExpiryHours,
    autoEmailPaymentReceived: row.autoEmailPaymentReceived,
  }
}

// A status missing from the map defaults to enabled — see schema comment.
export function isNotificationEnabled(
  settings: InvoiceSettingsData['trackingNotificationsEnabled'],
  status: ShippingStatus
): boolean {
  return settings[status] !== false
}
