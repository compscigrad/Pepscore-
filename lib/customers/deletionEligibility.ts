// Hard-delete eligibility for a Customer record (2026-09-03 customer
// lifecycle sprint) -- mirrors lib/invoices/deletionEligibility.ts's exact
// shape (pure decision function + one DB-querying wrapper, both API route
// and any future UI preview read the same answer, never two independently
// maintained checks). A Customer is only ever a TRUE-delete candidate when
// nothing that represents real business/financial history points at it --
// a test customer, an accidental duplicate, or an abandoned lead with no
// invoice ever issued. Everything else (an issued invoice, a stored
// payment method, an account credit, an approved Professional/Price Match
// grant) must go through Close/Archive instead (lib/portal/accountClosure.ts),
// which preserves the row and its history.
import { prisma } from '@/lib/prisma'

export type CustomerDeletionBlockReason =
  | 'HAS_INVOICES'
  | 'HAS_STOREFRONT_ORDERS'
  | 'HAS_ACCOUNT_CREDITS'
  | 'HAS_SAVED_PAYMENT_METHODS'
  | 'HAS_PRICE_MATCH_AUTHORIZATIONS'
  | 'HAS_PROFESSIONAL_ACCESS'
  | 'HAS_PROFESSIONAL_EVALUATIONS'
  | 'HAS_REDEEMED_PROMOTIONS'

export const CUSTOMER_BLOCK_REASON_LABEL: Record<CustomerDeletionBlockReason, string> = {
  HAS_INVOICES: 'Has one or more invoices (Direct Sale or storefront-linked)',
  HAS_STOREFRONT_ORDERS: 'Has one or more storefront orders',
  HAS_ACCOUNT_CREDITS: 'Has account credit history',
  HAS_SAVED_PAYMENT_METHODS: 'Has a saved payment method on file',
  HAS_PRICE_MATCH_AUTHORIZATIONS: 'Has an approved Price Match authorization',
  HAS_PROFESSIONAL_ACCESS: 'Has Professional Access history (application, invite, or grant)',
  HAS_PROFESSIONAL_EVALUATIONS: 'Has a Professional evaluation record',
  HAS_REDEEMED_PROMOTIONS: 'Has redeemed a promotion code',
}

export interface CustomerDeletionEligibility {
  customerId: string
  eligible: boolean
  blockedReasons: CustomerDeletionBlockReason[]
}

export interface CustomerDeletionFlags {
  invoiceCount: number
  orderCount: number
  accountCreditCount: number
  savedPaymentMethodCount: number
  priceMatchAuthorizationCount: number
  professionalAccessCount: number
  professionalEvaluationCount: number
  redeemedPromotionCount: number
}

// Pure decision function -- no Prisma import, unit-testable without a
// database, same discipline as computeInvoiceDeletionEligibility.
export function computeCustomerDeletionEligibility(flags: CustomerDeletionFlags): CustomerDeletionBlockReason[] {
  const blockedReasons: CustomerDeletionBlockReason[] = []
  if (flags.invoiceCount > 0) blockedReasons.push('HAS_INVOICES')
  if (flags.orderCount > 0) blockedReasons.push('HAS_STOREFRONT_ORDERS')
  if (flags.accountCreditCount > 0) blockedReasons.push('HAS_ACCOUNT_CREDITS')
  if (flags.savedPaymentMethodCount > 0) blockedReasons.push('HAS_SAVED_PAYMENT_METHODS')
  if (flags.priceMatchAuthorizationCount > 0) blockedReasons.push('HAS_PRICE_MATCH_AUTHORIZATIONS')
  if (flags.professionalAccessCount > 0) blockedReasons.push('HAS_PROFESSIONAL_ACCESS')
  if (flags.professionalEvaluationCount > 0) blockedReasons.push('HAS_PROFESSIONAL_EVALUATIONS')
  if (flags.redeemedPromotionCount > 0) blockedReasons.push('HAS_REDEEMED_PROMOTIONS')
  return blockedReasons
}

// Deliberately does NOT block on: LeadCapture (an abandoned lead is the
// canonical delete-safe example), IntakeLink (no invoice ever resulted),
// CustomerPortalInvite (pure access provisioning), Communication/
// CustomerActivityLog/CustomerAccessEvent/Notification/CampaignFunnelEvent/
// CustomerIdentityReviewCase (operational/audit trail about the customer,
// not a financial record of its own -- deleting the customer row cascades
// these away with it, same as it always has for a genuinely test/duplicate
// record). ProfessionalAccessApplication/Invite are counted regardless of
// approval status -- even a pending/declined application is a real
// interaction worth a human's eyes before erasing, not just an approved grant.
export async function getCustomerDeletionEligibility(customerId: string): Promise<CustomerDeletionEligibility> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { id: true, userId: true } })

  const [
    invoiceCount,
    orderCount,
    accountCreditCount,
    savedPaymentMethodCount,
    priceMatchAuthorizationCount,
    professionalApplicationCount,
    professionalInviteCount,
    professionalEvaluationCount,
    redeemedPromotionCount,
  ] = await Promise.all([
    prisma.invoice.count({ where: { customerId } }),
    customer.userId ? prisma.order.count({ where: { userId: customer.userId } }) : Promise.resolve(0),
    prisma.customerAccountCredit.count({ where: { customerId } }),
    prisma.savedPaymentMethod.count({ where: { customerId } }),
    prisma.priceMatchAuthorization.count({ where: { customerId } }),
    prisma.professionalAccessApplication.count({ where: { customerId } }),
    prisma.professionalAccessInvite.count({ where: { customerId } }),
    prisma.professionalEvaluation.count({ where: { customerId } }),
    prisma.promotionCode.count({ where: { customerId, status: 'REDEEMED' } }),
  ])

  const blockedReasons = computeCustomerDeletionEligibility({
    invoiceCount,
    orderCount,
    accountCreditCount,
    savedPaymentMethodCount,
    priceMatchAuthorizationCount,
    professionalAccessCount: professionalApplicationCount + professionalInviteCount,
    professionalEvaluationCount,
    redeemedPromotionCount,
  })

  return { customerId, eligible: blockedReasons.length === 0, blockedReasons }
}
