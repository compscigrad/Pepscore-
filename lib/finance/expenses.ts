// Expense Ledger read/write (2026-08-12 Finance & Expense Intelligence
// sprint). Thin wrapper over FinanceExpense, matching this codebase's
// existing "lib does the query/logic, API route does auth+validation"
// split (lib/adminInventory.ts, lib/invoices.ts).
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { FinanceExpense, FinanceExpenseCategory, FinanceAccountingTreatment } from '@prisma/client'
import { getTestDataExpenseExclusion } from './testDataExclusion'

export interface CreateExpenseInput {
  date: Date
  vendor?: string | null
  description: string
  amount: number
  category: FinanceExpenseCategory
  subcategory?: string | null
  paymentMethod?: string | null
  businessPurpose?: string | null
  orderId?: string | null
  invoiceId?: string | null
  shipmentId?: string | null
  productId?: string | null
  notes?: string | null
  taxTreatment?: FinanceAccountingTreatment
  receiptUrl?: string | null
  receiptFilename?: string | null
  providerReference?: string | null
}

export async function createExpense(input: CreateExpenseInput, actorId: string): Promise<FinanceExpense> {
  const expense = await prisma.financeExpense.create({
    data: { ...input, createdBy: actorId },
  })
  await prisma.adminAuditLog.create({
    data: {
      action: 'FINANCE_EXPENSE_CREATED',
      entity: 'FinanceExpense',
      entityId: expense.id,
      adminId: actorId,
      details: { category: expense.category, amount: expense.amount, vendor: expense.vendor, invoiceId: expense.invoiceId, orderId: expense.orderId },
    },
  })
  return expense
}

// Idempotent variant for provider-automated postings (a Shippo label
// purchase) -- a retry/duplicate webhook for the same provider transaction
// id is a no-op, never a second expense row. Returns the existing row on a
// unique-constraint hit rather than throwing, since "already posted" is the
// expected, successful outcome here, not an error condition.
export async function createExpenseIdempotent(input: CreateExpenseInput & { providerReference: string }, actorId: string): Promise<FinanceExpense> {
  const existing = await prisma.financeExpense.findUnique({ where: { providerReference: input.providerReference } })
  if (existing) return existing
  try {
    return await createExpense(input, actorId)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.financeExpense.findUnique({ where: { providerReference: input.providerReference } })
      if (raced) return raced
    }
    throw err
  }
}

export interface ExpenseFilters {
  category?: FinanceExpenseCategory
  taxTreatment?: FinanceAccountingTreatment
  from?: Date
  to?: Date
  query?: string
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<FinanceExpense[]> {
  const expenseTestExclusion = await getTestDataExpenseExclusion()
  return prisma.financeExpense.findMany({
    where: {
      category: filters.category,
      taxTreatment: filters.taxTreatment,
      date: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      ...expenseTestExclusion,
      ...(filters.query
        ? {
            OR: [
              { description: { contains: filters.query, mode: 'insensitive' } },
              { vendor: { contains: filters.query, mode: 'insensitive' } },
              { notes: { contains: filters.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { date: 'desc' },
  })
}

export async function updateExpense(id: string, input: Partial<CreateExpenseInput>, actorId: string): Promise<FinanceExpense> {
  const expense = await prisma.financeExpense.update({ where: { id }, data: input })
  await prisma.adminAuditLog.create({
    data: { action: 'FINANCE_EXPENSE_UPDATED', entity: 'FinanceExpense', entityId: id, adminId: actorId, details: input as Prisma.InputJsonValue },
  })
  return expense
}
