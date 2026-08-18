// Owner equity movement tracking (2026-08-18 Finance Center sprint).
// Matches lib/finance/expenses.ts's established "lib does query/logic,
// API route does auth+validation" split. Deliberately its own model, never
// a FinanceExpense row -- see OwnerTransaction's schema comment for why
// these three categories (sales / expenses / owner equity) must never be
// confused in reporting.
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { OwnerTransaction, OwnerTransactionType } from '@prisma/client'
import type { DateRange } from './reports'

export interface CreateOwnerTransactionInput {
  type: OwnerTransactionType
  amount: number
  date: Date
  description: string
  sourceReference?: string | null
  notes?: string | null
}

export async function createOwnerTransaction(input: CreateOwnerTransactionInput, actorId: string): Promise<OwnerTransaction> {
  const tx = await prisma.ownerTransaction.create({ data: { ...input, createdBy: actorId } })
  await prisma.adminAuditLog.create({
    data: {
      action: 'OWNER_TRANSACTION_CREATED',
      entity: 'OwnerTransaction',
      entityId: tx.id,
      adminId: actorId,
      details: { type: tx.type, amount: tx.amount, date: tx.date.toISOString() },
    },
  })
  return tx
}

export async function updateOwnerTransaction(id: string, input: Partial<CreateOwnerTransactionInput>, actorId: string): Promise<OwnerTransaction> {
  const tx = await prisma.ownerTransaction.update({ where: { id }, data: input })
  await prisma.adminAuditLog.create({
    data: { action: 'OWNER_TRANSACTION_UPDATED', entity: 'OwnerTransaction', entityId: id, adminId: actorId, details: input as Prisma.InputJsonValue },
  })
  return tx
}

export interface OwnerTransactionFilters {
  type?: OwnerTransactionType
  from?: Date
  to?: Date
}

export async function listOwnerTransactions(filters: OwnerTransactionFilters = {}): Promise<OwnerTransaction[]> {
  return prisma.ownerTransaction.findMany({
    where: {
      type: filters.type,
      date: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    },
    orderBy: { date: 'desc' },
  })
}

export interface OwnerTransactionSummary {
  range: DateRange
  contributions: number
  distributions: number
  reimbursements: number
  ownerPaidExpenses: number
  netOwnerActivity: number // contributions + reimbursements - distributions; owner-paid expenses tracked separately, not netted (they're a form of contribution-in-kind, called out on their own line rather than assumed into the net figure)
}

export async function getOwnerTransactionSummary(range: DateRange): Promise<OwnerTransactionSummary> {
  const rows = await prisma.ownerTransaction.findMany({
    where: { date: { gte: range.from, lte: range.to } },
    select: { type: true, amount: true },
  })
  const sum = (t: OwnerTransactionType) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0)
  const contributions = sum('CONTRIBUTION')
  const distributions = sum('DISTRIBUTION')
  const reimbursements = sum('REIMBURSEMENT')
  const ownerPaidExpenses = sum('OWNER_PAID_EXPENSE')
  return {
    range,
    contributions,
    distributions,
    reimbursements,
    ownerPaidExpenses,
    netOwnerActivity: contributions + reimbursements - distributions,
  }
}
