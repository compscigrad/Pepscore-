// Contractor/vendor 1099 foundation (2026-08-18 Finance Center sprint).
// Never stores a full TIN/SSN -- only whether a W-9 was received and the
// last 4 digits, matching Payment.bankAccountLast4's existing safe-display
// pattern. Year-to-date payment totals are computed live from
// FinanceExpense.vendor (never cached on this model) so the dollar figure
// can never drift from the actual expense ledger, which stays the one
// source of truth for money.
import { prisma } from '@/lib/prisma'
import type { Vendor1099, VendorPayeeType, Vendor1099ReviewStatus } from '@prisma/client'

export interface CreateVendor1099Input {
  vendorName: string
  payeeType?: VendorPayeeType
  w9Received?: boolean
  tinLast4?: string | null
  reviewStatus?: Vendor1099ReviewStatus
  notes?: string | null
}

function assertSafeTinLast4(tinLast4: string | null | undefined): void {
  if (tinLast4 != null && !/^\d{4}$/.test(tinLast4)) {
    throw new Error('tinLast4 must be exactly 4 digits, never a full TIN/SSN')
  }
}

export async function createVendor1099(input: CreateVendor1099Input, actorId: string): Promise<Vendor1099> {
  assertSafeTinLast4(input.tinLast4)
  const vendor = await prisma.vendor1099.create({ data: { ...input, createdBy: actorId } })
  await prisma.adminAuditLog.create({
    data: { action: 'VENDOR_1099_CREATED', entity: 'Vendor1099', entityId: vendor.id, adminId: actorId, details: { vendorName: vendor.vendorName } },
  })
  return vendor
}

export async function updateVendor1099(id: string, input: Partial<CreateVendor1099Input>, actorId: string): Promise<Vendor1099> {
  assertSafeTinLast4(input.tinLast4)
  const vendor = await prisma.vendor1099.update({ where: { id }, data: input })
  await prisma.adminAuditLog.create({
    data: { action: 'VENDOR_1099_UPDATED', entity: 'Vendor1099', entityId: id, adminId: actorId, details: input as never },
  })
  return vendor
}

export interface Vendor1099WithPayments extends Vendor1099 {
  paymentsYtd: number
}

export async function listVendors1099WithPayments(year: number): Promise<Vendor1099WithPayments[]> {
  const vendors = await prisma.vendor1099.findMany({ orderBy: { vendorName: 'asc' } })
  const from = new Date(year, 0, 1)
  const to = new Date(year, 11, 31, 23, 59, 59, 999)

  const results = await Promise.all(
    vendors.map(async (v) => {
      const agg = await prisma.financeExpense.aggregate({
        where: { vendor: v.vendorName, date: { gte: from, lte: to } },
        _sum: { amount: true },
      })
      return { ...v, paymentsYtd: agg._sum.amount ?? 0 }
    })
  )
  return results
}
