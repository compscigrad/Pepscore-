// Monthly close checklist (2026-08-18 Finance Center sprint). A tracking/
// visibility workflow only -- nothing in the app is prevented from being
// edited after a month is "closed," and reopening is always available.
// Never destructive, matching the spec's explicit requirement.
import { prisma } from '@/lib/prisma'
import type { MonthlyClose } from '@prisma/client'

export async function getOrCreateMonthlyClose(year: number, month: number): Promise<MonthlyClose> {
  return prisma.monthlyClose.upsert({
    where: { year_month: { year, month } },
    create: { year, month },
    update: {},
  })
}

export interface MonthlyCloseChecklistInput {
  ordersReconciled?: boolean
  paymentsReconciled?: boolean
  refundsReconciled?: boolean
  shippingReconciled?: boolean
  expensesEntered?: boolean
  receiptsReviewed?: boolean
  salesTaxReviewed?: boolean
  bankReconciled?: boolean
}

const CHECKLIST_KEYS: (keyof MonthlyCloseChecklistInput)[] = [
  'ordersReconciled', 'paymentsReconciled', 'refundsReconciled', 'shippingReconciled',
  'expensesEntered', 'receiptsReviewed', 'salesTaxReviewed', 'bankReconciled',
]

export function isChecklistComplete(close: MonthlyCloseChecklistInput): boolean {
  return CHECKLIST_KEYS.every((k) => close[k] === true)
}

export async function updateMonthlyCloseChecklist(year: number, month: number, input: MonthlyCloseChecklistInput, actorId: string): Promise<MonthlyClose> {
  const close = await prisma.monthlyClose.upsert({
    where: { year_month: { year, month } },
    create: { year, month, ...input },
    update: input,
  })
  await prisma.adminAuditLog.create({
    data: { action: 'MONTHLY_CLOSE_CHECKLIST_UPDATED', entity: 'MonthlyClose', entityId: close.id, adminId: actorId, details: { year, month, ...input } },
  })
  return close
}

export async function closeMonth(year: number, month: number, actorId: string): Promise<MonthlyClose> {
  const close = await prisma.monthlyClose.update({
    where: { year_month: { year, month } },
    data: { closedAt: new Date(), closedBy: actorId, reopenedAt: null, reopenedBy: null },
  })
  await prisma.adminAuditLog.create({
    data: { action: 'MONTH_CLOSED', entity: 'MonthlyClose', entityId: close.id, adminId: actorId, details: { year, month } },
  })
  return close
}

export async function reopenMonth(year: number, month: number, actorId: string): Promise<MonthlyClose> {
  const close = await prisma.monthlyClose.update({
    where: { year_month: { year, month } },
    data: { reopenedAt: new Date(), reopenedBy: actorId },
  })
  await prisma.adminAuditLog.create({
    data: { action: 'MONTH_REOPENED', entity: 'MonthlyClose', entityId: close.id, adminId: actorId, details: { year, month } },
  })
  return close
}

export async function listMonthlyCloses(year: number): Promise<MonthlyClose[]> {
  return prisma.monthlyClose.findMany({ where: { year }, orderBy: { month: 'asc' } })
}
