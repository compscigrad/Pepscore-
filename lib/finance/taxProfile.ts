// Business Tax Profile (2026-08-18 Finance Center sprint). Singleton
// settings row, same @default("singleton") pattern as the existing
// InvoiceSettings model. Every field is configuration metadata the owner
// enters -- never asserted, guessed, or defaulted to a specific real
// value by this environment.
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { BusinessTaxProfile, TaxYearType, BusinessEntityType, AccountingMethod } from '@prisma/client'

const SINGLETON_ID = 'singleton'

export async function getBusinessTaxProfile(): Promise<BusinessTaxProfile | null> {
  return prisma.businessTaxProfile.findUnique({ where: { id: SINGLETON_ID } })
}

export interface UpdateBusinessTaxProfileInput {
  legalBusinessName?: string | null
  dba?: string | null
  ein?: string | null
  stateOfFormation?: string | null
  businessAddress?: Prisma.InputJsonValue | null
  taxYearType?: TaxYearType
  entityType?: BusinessEntityType
  federalTaxClassification?: string | null
  accountingMethod?: AccountingMethod
  stateLocalTaxRegistrations?: string | null
  salesTaxRegistrations?: string | null
}

export async function upsertBusinessTaxProfile(input: UpdateBusinessTaxProfileInput, actorId: string): Promise<BusinessTaxProfile> {
  // Prisma's typed-JSON-null convention: a literal `null` in a Json?
  // field's input must be Prisma.JsonNull, not JS null, or the client
  // can't distinguish "explicitly clear this field" from "leave it alone."
  const businessAddress = input.businessAddress === null ? Prisma.JsonNull : input.businessAddress
  const profile = await prisma.businessTaxProfile.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input, businessAddress, updatedBy: actorId },
    update: { ...input, businessAddress, updatedBy: actorId },
  })
  await prisma.adminAuditLog.create({
    data: { action: 'BUSINESS_TAX_PROFILE_UPDATED', entity: 'BusinessTaxProfile', entityId: SINGLETON_ID, adminId: actorId, details: input as never },
  })
  return profile
}

// Surfaces exactly what's still unset -- read directly by the Tax Center's
// "Missing Information" section, never inferred.
export function getMissingProfileFields(profile: BusinessTaxProfile | null): string[] {
  const missing: string[] = []
  if (!profile) return ['Legal Business Name', 'EIN', 'State of Formation', 'Entity Type', 'Accounting Method']
  if (!profile.legalBusinessName) missing.push('Legal Business Name')
  if (!profile.ein) missing.push('EIN')
  if (!profile.stateOfFormation) missing.push('State of Formation')
  if (profile.entityType === 'UNKNOWN') missing.push('Entity Type')
  if (profile.accountingMethod === 'UNKNOWN') missing.push('Accounting Method')
  return missing
}
