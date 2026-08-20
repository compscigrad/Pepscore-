// Aggregates read-only summary data for the customer portal dashboard.
// Every query here is scoped by the caller-supplied customerId, which every
// call site resolves from getPortalCustomer() — never a client-supplied id.
// Deliberately just an aggregating read layer over the existing Invoice/
// Shipment/BackorderCondition/InvoiceRefund/CustomerAccountCredit/
// Communication models — no parallel business logic, no new source of truth.
import type { RefundStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCustomerVisibleCategory } from '@/lib/notifications/routing'
import { listCustomerPreferredPricing, listCustomerPriceMatchRequests } from '@/lib/priceMatch/requests'
import { listCustomerSafeEvaluations } from '@/lib/professionalEvaluation/service'

export interface DashboardInvoiceSummary {
  id: string
  invoiceNumber: string
  status: string
  paymentStatus: string
  orderStatus: string
  total: number
  balanceDue: number
  createdAt: Date
}

export interface DashboardTrackingSummary {
  invoiceId: string
  invoiceNumber: string
  carrier: string
  trackingNumber: string
  trackingUrl: string | null
  shippingStatus: string
}

export interface DashboardBackorderSummary {
  invoiceId: string
  invoiceNumber: string
  productName: string
  expectedAvailableDate: Date | null
}

export interface DashboardRefundSummary {
  invoiceId: string
  invoiceNumber: string
  requestedAmount: number
  status: string
}

export interface DashboardCreditSummary {
  id: string
  amount: number
  remainingAmount: number
  reason: string
}

export interface DashboardCommunicationSummary {
  id: string
  category: string
  subject: string | null
  sentAt: Date
}

export interface PortalDashboardData {
  outstandingBalance: number
  recentInvoices: DashboardInvoiceSummary[]
  activeTracking: DashboardTrackingSummary[]
  backorderNotices: DashboardBackorderSummary[]
  pendingRefunds: DashboardRefundSummary[]
  accountCredits: DashboardCreditSummary[]
  recentCommunications: DashboardCommunicationSummary[]
  requiredActions: string[]
  proEligible: boolean
  activePreferredPricingCount: number
  pendingPriceMatchCount: number
  evaluationCreditAvailable: number
}

const NON_TERMINAL_REFUND_STATUSES: RefundStatus[] = ['PENDING', 'AWAITING_MANUAL_PROCESSING', 'PROCESSING']

export async function getPortalDashboardData(customerId: string): Promise<PortalDashboardData> {
  // Three separate awaits rather than Promise.all — TypeScript's tuple
  // inference over heterogeneous Prisma include shapes doesn't reliably
  // preserve each query's specific `include` type when destructured
  // together; sequential awaits keep every result's real shape intact for
  // free, at the cost of a few extra ms on a dashboard read.
  const invoices = await prisma.invoice.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      shipments: { where: { monitoringActive: true, voidedAt: null }, orderBy: { createdAt: 'desc' } },
      backorderConditions: { where: { status: 'ACTIVE' } },
      refunds: { where: { status: { in: NON_TERMINAL_REFUND_STATUSES } } },
      paymentArrangement: { select: { id: true } },
    },
  })
  const accountCredits = await prisma.customerAccountCredit.findMany({
    where: { customerId, remainingAmount: { gt: 0 } },
    orderBy: { issuedAt: 'desc' },
  })
  const communications = await prisma.communication.findMany({
    where: { customerId },
    orderBy: { sentAt: 'desc' },
    take: 20, // over-fetch, then filter by visibility below, then trim to 5
  })
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { proEligible: true } })
  const preferredPricing = await listCustomerPreferredPricing(customerId)
  const priceMatchRequests = await listCustomerPriceMatchRequests(customerId)
  const evaluations = await listCustomerSafeEvaluations(customerId)

  const outstandingBalance = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0)

  const recentInvoices: DashboardInvoiceSummary[] = invoices.slice(0, 5).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    paymentStatus: inv.paymentStatus,
    orderStatus: inv.orderStatus,
    total: inv.total,
    balanceDue: inv.balanceDue,
    createdAt: inv.createdAt,
  }))

  const activeTracking: DashboardTrackingSummary[] = invoices.flatMap((inv) =>
    inv.shipments
      .filter((s) => s.normalizedStatus !== 'DELIVERED')
      .map((s) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        carrier: s.carrier,
        trackingNumber: s.trackingNumber,
        trackingUrl: s.trackingUrl,
        shippingStatus: s.normalizedStatus,
      }))
  )

  const backorderNotices: DashboardBackorderSummary[] = invoices.flatMap((inv) =>
    inv.backorderConditions.map((b) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      productName: b.productName,
      expectedAvailableDate: b.expectedAvailableDate,
    }))
  )

  const pendingRefunds: DashboardRefundSummary[] = invoices.flatMap((inv) =>
    inv.refunds.map((r) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      requestedAmount: r.requestedAmount,
      status: r.status,
    }))
  )

  const recentCommunications: DashboardCommunicationSummary[] = communications
    .filter((c) => isCustomerVisibleCategory(c.category))
    .slice(0, 5)
    .map((c) => ({ id: c.id, category: c.category, subject: c.subject, sentAt: c.sentAt }))

  const requiredActions: string[] = []
  if (outstandingBalance > 0) {
    const unselected = invoices.some((inv) => inv.balanceDue > 0 && !inv.selectedPaymentMethod && !inv.paymentArrangement)
    if (unselected) requiredActions.push('Select a payment method for your open balance.')
  }
  const pendingArrangementDecision = await prisma.paymentArrangement.count({
    where: { invoice: { customerId }, status: 'REQUESTED' },
  })
  if (pendingArrangementDecision > 0) requiredActions.push('Your payment arrangement request is awaiting review.')

  const moreInfoNeeded = priceMatchRequests.filter((r) => r.status === 'MORE_INFO_REQUESTED').length
  if (moreInfoNeeded > 0) {
    requiredActions.push(
      moreInfoNeeded === 1
        ? 'A price match request needs more information from you.'
        : `${moreInfoNeeded} price match requests need more information from you.`
    )
  }

  return {
    outstandingBalance,
    recentInvoices,
    activeTracking,
    backorderNotices,
    pendingRefunds,
    accountCredits: accountCredits.map((c) => ({ id: c.id, amount: c.amount, remainingAmount: c.remainingAmount, reason: c.reason })),
    recentCommunications,
    requiredActions,
    proEligible: customer?.proEligible ?? false,
    activePreferredPricingCount: preferredPricing.filter((r) => r.status === 'ACTIVE').length,
    pendingPriceMatchCount: priceMatchRequests.filter((r) => r.status === 'PENDING' || r.status === 'MORE_INFO_REQUESTED').length,
    evaluationCreditAvailable: evaluations
      .filter((e) => e.creditStatus === 'AVAILABLE')
      .reduce((sum, e) => sum + (e.creditAmount ?? 0), 0),
  }
}
