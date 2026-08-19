// Acquisition-popup trigger/suppression/nurture-cadence settings (2026-08-19
// lead-capture/conversion engine, section 23). Singleton row, same
// upsert-on-singleton pattern as lib/promotions/firstOrderOffer.ts's
// FirstOrderOfferConfig -- one read function every server surface (the
// homepage, the admin settings page) calls, one write function the admin
// settings route calls.
import { prisma } from '@/lib/prisma'
import type { AcquisitionPopupSettings } from '@prisma/client'

const SETTINGS_ID = 'singleton'

export async function getAcquisitionPopupSettings(): Promise<AcquisitionPopupSettings> {
  return prisma.acquisitionPopupSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
}

export interface UpdateAcquisitionPopupSettingsInput {
  enabled?: boolean
  delayMs?: number
  scrollThresholdPercent?: number | null
  exitIntentEnabled?: boolean
  capturedSuppressDays?: number
  dismissedSuppressDays?: number
  reminderIntervalsHours?: number[]
  updatedBy: string
}

export class InvalidAcquisitionPopupSettingsError extends Error {}

function validate(input: UpdateAcquisitionPopupSettingsInput): void {
  if (input.delayMs !== undefined && input.delayMs < 0) {
    throw new InvalidAcquisitionPopupSettingsError('Delay cannot be negative.')
  }
  if (input.scrollThresholdPercent !== undefined && input.scrollThresholdPercent !== null) {
    if (input.scrollThresholdPercent < 1 || input.scrollThresholdPercent > 100) {
      throw new InvalidAcquisitionPopupSettingsError('Scroll threshold must be between 1 and 100.')
    }
  }
  if (input.capturedSuppressDays !== undefined && input.capturedSuppressDays < 0) {
    throw new InvalidAcquisitionPopupSettingsError('Captured-suppress days cannot be negative.')
  }
  if (input.dismissedSuppressDays !== undefined && input.dismissedSuppressDays < 0) {
    throw new InvalidAcquisitionPopupSettingsError('Dismissed-suppress days cannot be negative.')
  }
  if (input.reminderIntervalsHours !== undefined) {
    if (input.reminderIntervalsHours.length === 0) {
      throw new InvalidAcquisitionPopupSettingsError('At least one reminder interval is required.')
    }
    if (input.reminderIntervalsHours.some((h) => h <= 0)) {
      throw new InvalidAcquisitionPopupSettingsError('Reminder intervals must be positive.')
    }
    for (let i = 1; i < input.reminderIntervalsHours.length; i++) {
      if (input.reminderIntervalsHours[i] <= input.reminderIntervalsHours[i - 1]) {
        throw new InvalidAcquisitionPopupSettingsError('Reminder intervals must be strictly increasing.')
      }
    }
  }
}

export async function updateAcquisitionPopupSettings(input: UpdateAcquisitionPopupSettingsInput): Promise<AcquisitionPopupSettings> {
  validate(input)
  const data = {
    enabled: input.enabled,
    delayMs: input.delayMs,
    scrollThresholdPercent: input.scrollThresholdPercent,
    exitIntentEnabled: input.exitIntentEnabled,
    capturedSuppressDays: input.capturedSuppressDays,
    dismissedSuppressDays: input.dismissedSuppressDays,
    reminderIntervalsHours: input.reminderIntervalsHours,
    updatedBy: input.updatedBy,
  }
  return prisma.acquisitionPopupSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  })
}
