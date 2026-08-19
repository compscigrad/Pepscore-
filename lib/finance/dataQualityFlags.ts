// Financial data-quality flags (2026-08-18 Finance Center sprint, extended
// 2026-08-18 P0 verification pass). Surfaces discrepancies for admin
// review -- never silently corrects financial history (spec explicit: "do
// not silently fix financial history"). Only flags conditions genuinely
// detectable from existing schema constraints or genuinely possible given
// current data; several conditions the P0 spec lists are correctly absent
// here, not missed:
//   - DUPLICATE_PROCESSOR_ID: impossible given @unique on
//     Payment.stripePaymentIntentId/providerTransactionId and
//     FinanceExpense.providerReference.
//   - PAYMENT_WITHOUT_ORDER: impossible -- Payment.orderId is a required
//     (non-nullable) FK to Order, enforced at the DB level.
//   - MISSING_EXPENSE_CATEGORY: impossible -- FinanceExpense.category is a
//     required, non-nullable enum column.
//   - STRIPE_TOTAL_MISMATCH / UNRECONCILED_TRANSACTION: already a
//     first-class report (Admin -> Finance -> Reconciliation,
//     `stripeReconciliation.ts`'s MATCHED/PARTIAL/MISMATCH/PENDING status
//     derivation), not duplicated here as a second, parallel check that
//     could drift from it.
//   - REFUND_MISMATCH: `InvoiceRefund` already carries its own
//     status/completedAmount lifecycle and its own report (Refunds tab);
//     Order/Payment-side refund mismatches will get the same treatment
//     once the storefront's Order table has real rows to check.
// ORDER_WITHOUT_PAYMENT is genuinely new and checkable today (0 current
// matches, since the Order table has zero rows until storefront checkout
// launches) -- included so the check exists and is tested before real
// orders exist, not bolted on after the fact.
import { prisma } from '@/lib/prisma'

export interface DataQualityFlag {
  type:
    | 'INVOICE_BALANCE_MISMATCH'
    | 'MISSING_COGS'
    | 'MISSING_SHIPPING_COST_ON_SHIPPED_ORDER'
    | 'NEGATIVE_IMPOSSIBLE_TOTAL'
    | 'EXPENSE_NEEDS_ACCOUNTANT_REVIEW'
    | 'ORDER_WITHOUT_PAYMENT'
  entityType: 'Invoice' | 'Order' | 'FinanceExpense'
  entityId: string
  reference: string // invoice/order number or expense description, for display
  detail: string
}

export async function getDataQualityFlags(): Promise<DataQualityFlag[]> {
  const flags: DataQualityFlag[] = []

  // Invoice.total should equal amountPaid + balanceDue - overpaidAmount
  // (allowing a cent of float slack) -- a real mismatch here means
  // something wrote an inconsistent total outside the normal payment flow.
  const invoices = await prisma.invoice.findMany({
    where: { isTestData: false, deletedAt: null },
    select: { id: true, invoiceNumber: true, total: true, amountPaid: true, balanceDue: true, overpaidAmount: true },
  })
  for (const inv of invoices) {
    const expected = inv.amountPaid + inv.balanceDue - inv.overpaidAmount
    if (Math.abs(expected - inv.total) > 0.01) {
      flags.push({
        type: 'INVOICE_BALANCE_MISMATCH',
        entityType: 'Invoice',
        entityId: inv.id,
        reference: inv.invoiceNumber,
        detail: `total ($${inv.total.toFixed(2)}) != amountPaid + balanceDue - overpaidAmount ($${expected.toFixed(2)})`,
      })
    }
    if (inv.total < 0 || inv.balanceDue < 0) {
      flags.push({
        type: 'NEGATIVE_IMPOSSIBLE_TOTAL',
        entityType: 'Invoice',
        entityId: inv.id,
        reference: inv.invoiceNumber,
        detail: `total=$${inv.total.toFixed(2)}, balanceDue=$${inv.balanceDue.toFixed(2)}`,
      })
    }
  }

  // Recognized-revenue invoices with at least one line item missing a
  // costOfGoods value -- expected to be common on older invoices (the
  // field is new), surfaced for visibility, not treated as urgent.
  const itemsMissingCogs = await prisma.invoiceItem.findMany({
    where: { costOfGoods: null, invoice: { status: { in: ['ISSUED', 'REFUNDED'] }, isTestData: false, deletedAt: null } },
    select: { id: true, name: true, invoice: { select: { invoiceNumber: true } } },
    take: 200, // capped -- this is a visibility list, not a full audit dump
  })
  for (const item of itemsMissingCogs) {
    flags.push({
      type: 'MISSING_COGS',
      entityType: 'Invoice',
      entityId: item.id,
      reference: item.invoice.invoiceNumber,
      detail: `line item "${item.name}" has no recorded cost of goods`,
    })
  }

  // A shipped/delivered invoice with $0 shippingCost recorded is worth a
  // glance -- either genuinely free, or the cost was never entered.
  const shippedNoCost = await prisma.invoice.findMany({
    where: { deliveryStatus: { in: ['SHIPPED', 'DELIVERED'] }, shippingCost: 0, isTestData: false, deletedAt: null },
    select: { id: true, invoiceNumber: true },
    take: 200,
  })
  for (const inv of shippedNoCost) {
    flags.push({
      type: 'MISSING_SHIPPING_COST_ON_SHIPPED_ORDER',
      entityType: 'Invoice',
      entityId: inv.id,
      reference: inv.invoiceNumber,
      detail: 'shipped/delivered with $0 recorded shipping cost',
    })
  }

  const needsReview = await prisma.financeExpense.findMany({
    where: { taxTreatment: 'NEEDS_ACCOUNTANT_REVIEW' },
    select: { id: true, description: true, amount: true },
    take: 200,
  })
  for (const exp of needsReview) {
    flags.push({
      type: 'EXPENSE_NEEDS_ACCOUNTANT_REVIEW',
      entityType: 'FinanceExpense',
      entityId: exp.id,
      reference: exp.description,
      detail: `$${exp.amount.toFixed(2)} -- accounting treatment not yet classified`,
    })
  }

  // A storefront Order past PENDING (i.e. the customer-facing flow
  // believes payment succeeded) with no linked Payment row that ever
  // reached SUCCEEDED/PARTIALLY_REFUNDED/REFUNDED is a genuine
  // reconciliation gap -- money the order record implies was collected
  // with no payment evidence backing it. Zero matches today (Order table
  // is empty pre-launch); this exists so the check is real and tested
  // before the first live storefront sale, not added reactively after one.
  const ordersWithoutPayment = await prisma.order.findMany({
    where: {
      isTestData: false,
      status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] },
      payments: { none: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } },
    },
    select: { id: true, orderNumber: true, total: true, status: true },
    take: 200,
  })
  for (const order of ordersWithoutPayment) {
    flags.push({
      type: 'ORDER_WITHOUT_PAYMENT',
      entityType: 'Order',
      entityId: order.id,
      reference: order.orderNumber,
      detail: `status=${order.status}, total=$${order.total.toFixed(2)} -- no linked Payment ever reached SUCCEEDED`,
    })
  }

  return flags
}
