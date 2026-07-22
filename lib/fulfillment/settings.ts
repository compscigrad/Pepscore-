// Fulfillment module settings — return/sender address + package defaults.
// Single-row table, same reasoning and shape as lib/invoiceSettings.ts:
// admin-editable via Settings UI rather than an env-var redeploy.
import { prisma } from '@/lib/prisma'
import type { ShippingCarrier, Prisma } from '@prisma/client'
import type { AddressInput } from '@/lib/shippo'

const SETTINGS_ID = 'singleton'

export interface FulfillmentSettingsData {
  returnAddress: AddressInput | null
  defaultCarrier: ShippingCarrier | null
  defaultService: string | null
  defaultWeightOz: number | null
  defaultLengthIn: number | null
  defaultWidthIn: number | null
  defaultHeightIn: number | null
}

function parseAddress(value: Prisma.JsonValue | null): AddressInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as unknown as AddressInput
}

function toResult(row: {
  returnAddress: Prisma.JsonValue | null
  defaultCarrier: ShippingCarrier | null
  defaultService: string | null
  defaultWeightOz: number | null
  defaultLengthIn: number | null
  defaultWidthIn: number | null
  defaultHeightIn: number | null
}): FulfillmentSettingsData {
  return {
    returnAddress: parseAddress(row.returnAddress),
    defaultCarrier: row.defaultCarrier,
    defaultService: row.defaultService,
    defaultWeightOz: row.defaultWeightOz,
    defaultLengthIn: row.defaultLengthIn,
    defaultWidthIn: row.defaultWidthIn,
    defaultHeightIn: row.defaultHeightIn,
  }
}

export async function getFulfillmentSettings(): Promise<FulfillmentSettingsData> {
  const row = await prisma.fulfillmentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return toResult(row)
}

export interface UpdateFulfillmentSettingsInput {
  // A full replace when provided — there's no partial-field address update
  // in v1, keeping this free of Prisma's Json-null-vs-undefined ambiguity.
  returnAddress?: AddressInput
  defaultCarrier?: ShippingCarrier | null
  defaultService?: string | null
  defaultWeightOz?: number | null
  defaultLengthIn?: number | null
  defaultWidthIn?: number | null
  defaultHeightIn?: number | null
}

export async function updateFulfillmentSettings(input: UpdateFulfillmentSettingsInput): Promise<FulfillmentSettingsData> {
  const data = {
    returnAddress: input.returnAddress === undefined ? undefined : (input.returnAddress as unknown as Prisma.InputJsonValue),
    defaultCarrier: input.defaultCarrier,
    defaultService: input.defaultService,
    defaultWeightOz: input.defaultWeightOz,
    defaultLengthIn: input.defaultLengthIn,
    defaultWidthIn: input.defaultWidthIn,
    defaultHeightIn: input.defaultHeightIn,
  }
  const row = await prisma.fulfillmentSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  })
  return toResult(row)
}
