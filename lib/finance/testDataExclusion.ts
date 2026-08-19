// Shared test/rehearsal-data exclusion for FinanceExpense queries
// (2026-08-18, Finance/Tax P0 verification pass). FinanceExpense.invoiceId
// / .orderId are deliberately plain string references, not enforced FKs
// (see the schema comment on FinanceExpense), so they can't be excluded
// via a nested `invoice: { isTestData: false }` filter the way
// InvoiceItem/InvoiceRefund/StripeReconciliation already are -- this
// fetches the current test-data id set once so a caller can exclude
// expenses linked to a rehearsal/test invoice or order the same way every
// other revenue-adjacent report already does. Today this set is small
// (11 known rehearsal invoices, 0 test orders) and no FinanceExpense row
// is actually linked to any of them -- confirmed by direct query -- but a
// shipping/COGS expense recorded against a test invoice in the future
// would otherwise silently contaminate Operating Expenses/Shipping
// Expense/vendor totals with no filter catching it, the same class of gap
// the isTestData field itself was built to close for invoices.
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function getTestDataExpenseExclusion(): Promise<Prisma.FinanceExpenseWhereInput> {
  const [testInvoices, testOrders] = await Promise.all([
    prisma.invoice.findMany({ where: { isTestData: true }, select: { id: true } }),
    prisma.order.findMany({ where: { isTestData: true }, select: { id: true } }),
  ])
  const invoiceIds = testInvoices.map((i) => i.id)
  const orderIds = testOrders.map((o) => o.id)
  if (invoiceIds.length === 0 && orderIds.length === 0) return {}
  return {
    NOT: [
      ...(invoiceIds.length ? [{ invoiceId: { in: invoiceIds } }] : []),
      ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
    ],
  }
}
