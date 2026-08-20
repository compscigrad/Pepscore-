// Professional Sample & Evaluation Program (2026-08-20) -- issuance +
// credit redemption service. Professional Access does NOT by itself
// entitle an account to a free/discounted sample; every evaluation unit is
// admin-issued, SKU-gated (Product.evaluationEligible), and tracked through
// the same canonical inventory ledger and invoice pipeline every other real
// transaction uses -- never a second, disconnected system.
import { prisma } from '@/lib/prisma'
import { applyLedgerEvent } from '@/lib/inventory/ledger'
import { refreshLowStockAlert } from '@/lib/inventory/lowStockAlerts'
import { createInvoice } from '@/lib/invoices'
import { resolveEvaluationUnitPrice, EVALUATION_CREDIT_DEFAULT_VALIDITY_DAYS, EvaluationPricingError } from './pricing'
import { resolveActivePreferredPricesByCustomerId, preferredPriceFor } from '@/lib/pricing/preferredPricing'
import { recordCustomerActivity } from '@/lib/customers'
import type { ProfessionalEvaluation, EvaluationType, InvoiceItemSellUnit } from '@prisma/client'

export class ProfessionalEvaluationError extends Error {}

export interface IssueEvaluationInput {
  customerId: string
  productId: string
  quantity?: number
  evaluationType: EvaluationType
  creditEligible?: boolean
  notes?: string | null
}

// PAID_ONLY / COMPLIMENTARY_ALLOWED / BOTH -- COMPLIMENTARY_ALLOWED reads
// symmetrically with PAID_ONLY (only complimentary is permitted for this
// SKU); BOTH explicitly permits either. A product with evaluationMethod
// unset (evaluationEligible=false) never reaches this check at all --
// issueProfessionalEvaluation rejects it earlier.
function isEvaluationTypeAllowed(method: 'PAID_ONLY' | 'COMPLIMENTARY_ALLOWED' | 'BOTH', type: EvaluationType): boolean {
  if (method === 'BOTH') return true
  if (method === 'PAID_ONLY') return type === 'PAID'
  return type === 'COMPLIMENTARY'
}

// Admin-initiated issuance -- the one real "ISSUE EVALUATION UNIT" action.
// Automates everything reasonably possible in one call: resolves the
// customer's real current case price, calculates the per-unit evaluation
// price, decrements real inventory (when tracked), creates a real Invoice
// for a PAID evaluation (never for COMPLIMENTARY -- no fabricated revenue),
// and records the full audit trail.
export async function issueProfessionalEvaluation(input: IssueEvaluationInput, issuedBy: string): Promise<ProfessionalEvaluation> {
  const quantity = input.quantity ?? 1
  if (!Number.isInteger(quantity) || quantity <= 0) throw new ProfessionalEvaluationError('Quantity must be a positive integer')

  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.product.findUnique({ where: { id: input.productId } }),
  ])
  if (!customer) throw new ProfessionalEvaluationError('Customer not found')
  if (!product) throw new ProfessionalEvaluationError('Product not found')
  if (!product.evaluationEligible || !product.evaluationMethod) {
    throw new ProfessionalEvaluationError(`${product.name} (${product.size}) is not enabled for evaluation units. Enable it from Product Master first.`)
  }
  if (!isEvaluationTypeAllowed(product.evaluationMethod, input.evaluationType)) {
    throw new ProfessionalEvaluationError(`${product.name} only allows ${product.evaluationMethod === 'PAID_ONLY' ? 'paid' : 'complimentary'} evaluations.`)
  }

  // Credit eligibility -- section 10's explicit rule: a COMPLIMENTARY
  // evaluation never automatically carries a credit. Only a PAID evaluation
  // on a product the admin has separately opted into credit eligibility can
  // ever set creditEligible.
  const creditEligible = !!input.creditEligible && input.evaluationType === 'PAID' && product.evaluationCreditEligible
  if (input.creditEligible && input.evaluationType === 'COMPLIMENTARY') {
    throw new ProfessionalEvaluationError('A complimentary evaluation cannot automatically carry a purchase credit -- grant it as a separate, explicit action if intended.')
  }

  // Resolve the customer's real current applicable case price -- the exact
  // canonical engine every other pricing surface uses, never a second one.
  const preferredMap = await resolveActivePreferredPricesByCustomerId(customer.id, [
    { productId: product.id, sellUnit: 'CASE_STANDARD' },
    { productId: product.id, sellUnit: 'CASE_PRO' },
  ])
  const proEligible = customer.proEligible && !customer.portalAccessDisabled
  const preferredPrice = proEligible
    ? preferredPriceFor(preferredMap, product.id, 'CASE_PRO')
    : preferredPriceFor(preferredMap, product.id, 'CASE_STANDARD')

  let priced
  try {
    priced = resolveEvaluationUnitPrice({
      product: {
        activeStandardCasePrice: product.activeStandardCasePrice,
        activeProCasePrice: product.activeProCasePrice,
        activeBulkPrice: product.activeBulkPrice,
        activeIndividualVialPrice: product.activeIndividualVialPrice,
        individualSalesEnabled: product.individualSalesEnabled,
        unitsPerCase: product.unitsPerCase,
      },
      proEligible,
      preferredPrice,
    })
  } catch (err) {
    if (err instanceof EvaluationPricingError) throw new ProfessionalEvaluationError(err.message)
    throw err
  }

  const amountPaid = input.evaluationType === 'PAID' ? Math.round(priced.evaluationUnitPrice * quantity * 100) / 100 : 0
  const creditAmount = creditEligible ? amountPaid : null
  const validityDays = product.evaluationCreditValidityDays ?? EVALUATION_CREDIT_DEFAULT_VALIDITY_DAYS
  const creditExpiresAt = creditEligible ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000) : null

  // Real Invoice for a PAID evaluation -- reuses the exact createInvoice()
  // every other admin-composed sale uses, so Finance/COGS/audit-trail
  // parity is inherited, not rebuilt. A COMPLIMENTARY evaluation never
  // creates an Invoice (never fabricates a $0 "sale").
  let issuanceInvoiceId: string | null = null
  if (input.evaluationType === 'PAID') {
    const invoice = await createInvoice({
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      customerEmail: customer.email ?? undefined,
      customerPhone: customer.phone ?? undefined,
      shippingCost: 0,
      status: 'DRAFT',
      deliveryStatus: 'PREPARING',
      items: [
        {
          productId: product.id,
          name: `${product.name} (${product.size}) -- Evaluation Unit`,
          quantity,
          unitPrice: priced.evaluationUnitPrice,
          lineDiscount: 0,
          sortOrder: 0,
          sellUnit: 'INDIVIDUAL_VIAL',
          unitsPerSellUnit: 1,
          priceTier: 'MANUAL',
          skuSnapshot: product.sku,
          inventoryQuantityConsumed: quantity,
          costOfGoods: product.costOfGoods > 0 ? Math.round(product.costOfGoods * quantity * 100) / 100 : null,
        },
      ],
      discounts: [],
    })
    issuanceInvoiceId = invoice.id
  }

  // Inventory -- only for a genuinely tracked, initialized product; a
  // non-tracked product simply has nothing to decrement, same as every
  // other inventory-aware write path in this codebase.
  let inventoryLedgerEntryId: string | null = null
  if (product.inventoryTrackingEnabled && product.physicalStockOnHand !== null) {
    const entry = await applyLedgerEvent({
      productId: product.id,
      quantityDelta: -quantity,
      eventType: 'EVALUATION_ISSUANCE',
      actor: issuedBy,
      actorType: 'ADMIN',
      reason: `${input.evaluationType === 'PAID' ? 'Paid' : 'Complimentary'} evaluation unit issued`,
      invoiceId: issuanceInvoiceId ?? undefined,
    })
    inventoryLedgerEntryId = entry.id
    await refreshLowStockAlert(product.id, issuedBy)
  }

  const evaluation = await prisma.professionalEvaluation.create({
    data: {
      customerId: customer.id,
      productId: product.id,
      quantity,
      pricingSource: priced.pricingSource,
      applicableCasePrice: priced.applicableCasePrice,
      canonicalCaseQuantity: priced.canonicalCaseQuantity,
      evaluationUnitPrice: priced.evaluationUnitPrice,
      evaluationType: input.evaluationType,
      amountPaid,
      issuanceInvoiceId: issuanceInvoiceId ?? undefined,
      creditEligible,
      creditAmount: creditAmount ?? undefined,
      creditExpiresAt: creditExpiresAt ?? undefined,
      creditStatus: creditEligible ? 'AVAILABLE' : 'NONE',
      inventoryLedgerEntryId: inventoryLedgerEntryId ?? undefined,
      issuedBy,
      notes: input.notes ?? undefined,
    },
  })

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'PROFESSIONAL_EVALUATION_ISSUED',
    newValue: `${product.name} (${product.size}) x${quantity} -- ${input.evaluationType}`,
    source: 'MANUAL',
    userId: issuedBy,
  })

  return evaluation
}

// Applies an AVAILABLE, unexpired credit to a later qualifying full-case
// invoice as a real InvoiceDiscount -- a monetary price adjustment, never a
// physical reduction in the new invoice's case quantity (the customer's new
// case line is untouched; only the invoice total drops). Rejects wrong-
// customer, wrong-product, expired, and already-redeemed attempts; the
// AVAILABLE -> REDEEMED transition only ever happens once per credit (a
// second attempt against an already-REDEEMED row throws, matching the same
// no-double-spend discipline InventoryReservation's own status machine
// uses).
export async function redeemEvaluationCredit(evaluationId: string, invoiceId: string, adminId: string): Promise<ProfessionalEvaluation> {
  // Expiry check-and-flip happens as its own step, BEFORE the redemption
  // transaction below -- a Prisma interactive transaction that throws rolls
  // back every write made inside it, so flipping creditStatus to EXPIRED
  // and then throwing from within the same transaction would silently
  // revert the very flip it just made.
  const preCheck = await prisma.professionalEvaluation.findUnique({ where: { id: evaluationId } })
  if (!preCheck) throw new ProfessionalEvaluationError('Evaluation not found')
  if (preCheck.creditStatus === 'AVAILABLE' && preCheck.creditExpiresAt && preCheck.creditExpiresAt < new Date()) {
    await prisma.professionalEvaluation.update({ where: { id: evaluationId }, data: { creditStatus: 'EXPIRED' } })
    throw new ProfessionalEvaluationError('This evaluation credit has expired')
  }

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.professionalEvaluation.findUnique({ where: { id: evaluationId }, include: { product: true } })
    if (!evaluation) throw new ProfessionalEvaluationError('Evaluation not found')
    if (evaluation.creditStatus === 'EXPIRED') throw new ProfessionalEvaluationError('This evaluation credit has expired')
    if (evaluation.creditStatus === 'REDEEMED') throw new ProfessionalEvaluationError('This evaluation credit has already been redeemed')
    if (evaluation.creditStatus === 'CANCELLED') throw new ProfessionalEvaluationError('This evaluation credit was cancelled')
    if (evaluation.creditStatus !== 'AVAILABLE' || evaluation.creditAmount == null) {
      throw new ProfessionalEvaluationError('This evaluation has no available credit')
    }

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } })
    if (!invoice) throw new ProfessionalEvaluationError('Invoice not found')
    if (invoice.customerId !== evaluation.customerId) {
      throw new ProfessionalEvaluationError('This credit belongs to a different customer and cannot be applied to this invoice')
    }
    const qualifyingUnits: InvoiceItemSellUnit[] = ['CASE_STANDARD', 'CASE_PRO']
    const hasQualifyingLine = invoice.items.some((item) => item.productId === evaluation.productId && item.sellUnit != null && qualifyingUnits.includes(item.sellUnit))
    if (!hasQualifyingLine) {
      throw new ProfessionalEvaluationError(`This credit is specific to ${evaluation.product.name} (${evaluation.product.size}) and this invoice has no qualifying full-case line for that product`)
    }

    const creditAmount = evaluation.creditAmount
    const existingDiscountTotal = Math.round((invoice.subtotal - invoice.total) * 100) / 100
    const newDiscountTotal = Math.round((existingDiscountTotal + creditAmount) * 100) / 100
    const newTotal = Math.max(0, Math.round((invoice.subtotal - newDiscountTotal) * 100) / 100)
    const previousAmountPaid = Math.round((invoice.total - invoice.balanceDue) * 100) / 100
    const newBalanceDue = Math.round((newTotal - previousAmountPaid) * 100) / 100

    await tx.invoiceDiscount.create({
      data: {
        invoiceId,
        label: `Evaluation Credit -- ${evaluation.product.name} (${evaluation.product.size})`,
        type: 'FIXED',
        amount: creditAmount,
        appliedAmount: creditAmount,
      },
    })
    await tx.invoice.update({ where: { id: invoiceId }, data: { total: newTotal, balanceDue: newBalanceDue } })

    await tx.adminAuditLog.create({
      data: { action: 'EVALUATION_CREDIT_REDEEMED', entity: 'ProfessionalEvaluation', entityId: evaluationId, adminId, details: { invoiceId, creditAmount } },
    })

    return tx.professionalEvaluation.update({
      where: { id: evaluationId },
      data: { creditStatus: 'REDEEMED', creditRedeemedAt: new Date(), creditRedeemedInvoiceId: invoiceId },
    })
  })
}

export async function listCustomerProfessionalEvaluations(customerId: string) {
  return prisma.professionalEvaluation.findMany({
    where: { customerId },
    include: { product: { select: { name: true, size: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
