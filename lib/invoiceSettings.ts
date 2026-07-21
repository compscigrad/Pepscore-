// Invoice module settings — currently just the auto-archive delay. A
// dedicated single-row table (fixed id 'singleton') rather than folding this
// into an env var, since the spec calls for an admin-editable UI setting,
// not a deploy-time config value.
import { prisma } from '@/lib/prisma'

const SETTINGS_ID = 'singleton'

export interface InvoiceSettingsData {
  archiveAfterDays: number | null
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return { archiveAfterDays: row.archiveAfterDays }
}

export async function updateInvoiceSettings(archiveAfterDays: number | null): Promise<InvoiceSettingsData> {
  const row = await prisma.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { archiveAfterDays },
    create: { id: SETTINGS_ID, archiveAfterDays },
  })
  return { archiveAfterDays: row.archiveAfterDays }
}
