// Admin Payment Settings -- single-row table, same upsert pattern as
// lib/invoiceSettings.ts's InvoiceSettings. See PaymentSettings' schema
// comment for which fields are real Stripe Checkout gates vs. readiness-
// only display flags.
import { prisma } from '@/lib/prisma'

const SETTINGS_ID = 'singleton'

export interface PaymentSettingsData {
  cardEnabled: boolean
  achEnabled: boolean
  cashAppEnabled: boolean
  applePayEnabled: boolean
  googlePayEnabled: boolean
  paypalEnabled: boolean
  venmoEnabled: boolean
  updatedAt: Date
  updatedBy: string | null
}

export async function getPaymentSettings(): Promise<PaymentSettingsData> {
  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
}

export interface UpdatePaymentSettingsInput {
  cardEnabled?: boolean
  achEnabled?: boolean
  cashAppEnabled?: boolean
  applePayEnabled?: boolean
  googlePayEnabled?: boolean
  paypalEnabled?: boolean
  venmoEnabled?: boolean
  updatedBy: string
}

export class PaymentSettingsError extends Error {}

// At least one real checkout method must stay on -- an admin turning
// every gate off would leave the (already-off-by-default) storefront
// checkout with literally nothing to offer if it were ever enabled.
export async function updatePaymentSettings(input: UpdatePaymentSettingsInput): Promise<PaymentSettingsData> {
  const current = await getPaymentSettings()
  const next = {
    cardEnabled: input.cardEnabled ?? current.cardEnabled,
    achEnabled: input.achEnabled ?? current.achEnabled,
    cashAppEnabled: input.cashAppEnabled ?? current.cashAppEnabled,
  }
  if (!next.cardEnabled && !next.achEnabled && !next.cashAppEnabled) {
    throw new PaymentSettingsError('At least one checkout payment method must remain enabled.')
  }

  return prisma.paymentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      cardEnabled: input.cardEnabled,
      achEnabled: input.achEnabled,
      cashAppEnabled: input.cashAppEnabled,
      applePayEnabled: input.applePayEnabled,
      googlePayEnabled: input.googlePayEnabled,
      paypalEnabled: input.paypalEnabled,
      venmoEnabled: input.venmoEnabled,
      updatedBy: input.updatedBy,
    },
    create: { id: SETTINGS_ID, ...next, updatedBy: input.updatedBy },
  })
}
