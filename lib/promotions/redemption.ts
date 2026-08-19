// Storefront promotion-code redemption (Phase 4A Critical #1) -- the
// missing link between code issuance (lib/promotions/firstOrderOfferClaim.ts)
// and actually spending one at checkout. Nothing in this codebase validated
// or redeemed a PromotionCode by its string value before this file.
//
// Two-phase by design, so a one-time code is never permanently burned by a
// customer merely opening checkout:
//   1. resolvePromotionCode() -- pure validation, read-only, safe to call
//      repeatedly (cart preview, checkout creation). Never writes anything.
//   2. applyPromotionCodeToOrder() -- called once, inside the same
//      transaction that creates the Order at checkout (app/api/checkout/
//      route.ts) -- a *soft hold* (Order.appliedPromotionCodeId set) that
//      does NOT change PromotionCode.status/redeemedAt yet.
//   3. finalizeRedemption() -- called only from the real payment-success
//      path (lib/payments/orderFulfillment.ts's markOrderPaid()) -- this is
//      the only place PromotionCode.status ever becomes REDEEMED.
// An abandoned/failed/cancelled order never calls finalizeRedemption, so
// the code's status stays ACTIVE and the customer can retry with a fresh
// checkout attempt -- verified by real-Postgres rehearsal (see
// docs/Decisions.md).
import type { Prisma, PromotionCampaign, PromotionCode, PromotionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canApplyCampaignSet, type StackableCampaign } from './compatibility'

export type PromotionCodeInvalidReason =
  | 'INVALID_CODE'
  | 'WRONG_CUSTOMER'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'CAMPAIGN_NOT_ACTIVE'
  | 'NOT_STARTED'
  | 'CAMPAIGN_EXPIRED'
  | 'NOT_FIRST_ORDER'
  | 'MIN_PURCHASE_NOT_MET'
  | 'PRODUCT_NOT_ELIGIBLE'
  | 'CANNOT_COMBINE'
  | 'MAX_PROMOTIONS_REACHED'

// User-facing copy lives with the reasons themselves so every surface
// (cart preview, checkout, a future admin tool) shows identical wording.
export const PROMOTION_CODE_INVALID_MESSAGE: Record<PromotionCodeInvalidReason, string> = {
  INVALID_CODE: "We couldn't find that code.",
  WRONG_CUSTOMER: "This code isn't valid for your account.",
  ALREADY_USED: 'This code has already been used.',
  REVOKED: 'This code is no longer valid.',
  EXPIRED: 'This code has expired.',
  CAMPAIGN_NOT_ACTIVE: 'This offer is not currently active.',
  NOT_STARTED: "This offer hasn't started yet.",
  CAMPAIGN_EXPIRED: 'This offer has ended.',
  NOT_FIRST_ORDER: 'This offer is only available on your first order.',
  MIN_PURCHASE_NOT_MET: "Your order doesn't meet this offer's minimum purchase amount yet.",
  PRODUCT_NOT_ELIGIBLE: "None of the items in your cart are eligible for this offer.",
  CANNOT_COMBINE: "This code can't be combined with the promotion already applied.",
  MAX_PROMOTIONS_REACHED: 'Only one promotion can be applied per order.',
}

export interface ResolvePromotionCodeContext {
  customerId: string
  cartSubtotal: number
  cartProductSlugs: string[]
  // The campaign(s) already applied to this cart/order, if any -- for this
  // slice there is at most one (Order.appliedPromotionCodeId is a single
  // nullable FK; see its schema comment for why true simultaneous 2-code
  // stacking is scoped out of this slice even though the compatibility
  // engine below already supports checking it).
  existingAppliedCampaigns?: StackableCampaign[]
}

export type ResolvePromotionCodeResult =
  | {
      valid: true
      code: PromotionCode
      campaign: PromotionCampaign
      discountAmount: number
    }
  | { valid: false; reason: PromotionCodeInvalidReason }

export function normalizePromotionCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function computeDiscountAmount(discountType: PromotionType, discountValue: number, subtotal: number): number {
  const raw = discountType === 'PERCENTAGE' ? subtotal * (discountValue / 100) : discountValue
  // Never a negative total, never more than the subtotal itself -- a $50
  // fixed-amount code on a $20 cart discounts the cart to $0, not below it.
  return Math.max(0, Math.min(raw, subtotal))
}

// Real, current first-order eligibility -- never trusts a prior claim
// record alone (a customer who has since placed a REAL order, whether or
// not via this exact code, is no longer a first-order customer, even if a
// brand-new first-order campaign has since gone live). Checks both real
// sale records: manual Invoices (customerId-linked) and storefront Orders
// (userId-linked, since Order has no direct Customer relation).
// Exported (2026-08-19 lead-capture/conversion engine, section 1/3/4) --
// the canonical "has this customer ever completed a real transaction on
// any sales channel" check, reused at ISSUANCE time by
// lib/promotions/firstOrderOfferClaim.ts as well as here at REDEMPTION
// time. Never based on account/portal/login/device signals -- only real
// Invoice/Order history, so an existing direct-sale customer who is merely
// new to the website/portal is correctly recognized as ineligible for a
// first-order offer at both points, not just one.
export async function hasAnyPriorOrder(customerId: string): Promise<boolean> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { userId: true } })
  const [invoiceCount, orderCount] = await Promise.all([
    prisma.invoice.count({ where: { customerId, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED', 'VOID'] } } }),
    customer?.userId ? prisma.order.count({ where: { userId: customer.userId, status: { notIn: ['PENDING', 'CANCELLED'] } } }) : Promise.resolve(0),
  ])
  return invoiceCount > 0 || orderCount > 0
}

export async function resolvePromotionCode(rawCode: string, context: ResolvePromotionCodeContext): Promise<ResolvePromotionCodeResult> {
  const code = normalizePromotionCode(rawCode)
  const promotionCode = await prisma.promotionCode.findUnique({ where: { code }, include: { campaign: true } })

  if (!promotionCode) return { valid: false, reason: 'INVALID_CODE' }
  if (promotionCode.customerId !== context.customerId) return { valid: false, reason: 'WRONG_CUSTOMER' }
  if (promotionCode.revokedAt) return { valid: false, reason: 'REVOKED' }
  if (promotionCode.status === 'REDEEMED') return { valid: false, reason: 'ALREADY_USED' }
  if (promotionCode.status === 'EXPIRED') return { valid: false, reason: 'EXPIRED' }
  if (promotionCode.expiresAt && promotionCode.expiresAt < new Date()) return { valid: false, reason: 'EXPIRED' }

  const campaign = promotionCode.campaign
  if (campaign.status !== 'ACTIVE') return { valid: false, reason: 'CAMPAIGN_NOT_ACTIVE' }
  if (campaign.startsAt && campaign.startsAt > new Date()) return { valid: false, reason: 'NOT_STARTED' }
  if (campaign.expiresAt && campaign.expiresAt < new Date()) return { valid: false, reason: 'CAMPAIGN_EXPIRED' }

  if (campaign.firstOrderOnly) {
    const hasPriorOrder = await hasAnyPriorOrder(context.customerId)
    if (hasPriorOrder) return { valid: false, reason: 'NOT_FIRST_ORDER' }
  }

  if (campaign.minPurchaseAmount && context.cartSubtotal < campaign.minPurchaseAmount) {
    return { valid: false, reason: 'MIN_PURCHASE_NOT_MET' }
  }

  if (campaign.eligibleProductSlugs.length > 0) {
    const hasEligibleItem = context.cartProductSlugs.some((slug) => campaign.eligibleProductSlugs.includes(slug))
    if (!hasEligibleItem) return { valid: false, reason: 'PRODUCT_NOT_ELIGIBLE' }
  }
  if (campaign.excludedProductSlugs.length > 0) {
    const everyItemExcluded = context.cartProductSlugs.length > 0 && context.cartProductSlugs.every((slug) => campaign.excludedProductSlugs.includes(slug))
    if (everyItemExcluded) return { valid: false, reason: 'PRODUCT_NOT_ELIGIBLE' }
  }

  if (campaign.maxUses !== null) {
    const totalRedeemed = await prisma.promotionCode.count({ where: { campaignId: campaign.id, status: 'REDEEMED' } })
    if (totalRedeemed >= campaign.maxUses) return { valid: false, reason: 'CAMPAIGN_NOT_ACTIVE' }
  }
  const redeemedByThisCustomer = await prisma.promotionCode.count({ where: { campaignId: campaign.id, customerId: context.customerId, status: 'REDEEMED' } })
  if (redeemedByThisCustomer >= campaign.usesPerCustomer) return { valid: false, reason: 'ALREADY_USED' }

  const existing = context.existingAppliedCampaigns ?? []
  if (existing.length > 0) {
    const combined = [...existing, { id: campaign.id, stackingPolicy: campaign.stackingPolicy }]
    if (!canApplyCampaignSet(combined)) {
      const wouldExceedMax = combined.length > 2 // MAX_SIMULTANEOUS_PROMOTIONS, see compatibility.ts
      return { valid: false, reason: wouldExceedMax ? 'MAX_PROMOTIONS_REACHED' : 'CANNOT_COMBINE' }
    }
  }

  const discountAmount = computeDiscountAmount(campaign.discountType, campaign.discountValue, context.cartSubtotal)
  return { valid: true, code: promotionCode, campaign, discountAmount }
}

// Resolves the checkout customer's Customer.id from their authenticated
// identity -- a code's owner (Customer.customerId) may not be linked to a
// User yet (FIRST10 claims work for a not-yet-account-holding lead), so
// this falls back to an email match, the same identity-resolution pattern
// lib/portal/selfServiceResolve.ts already uses elsewhere in this codebase.
export async function resolveCustomerIdForCheckout(userId: string | null, email: string): Promise<string | null> {
  if (userId) {
    const byUser = await prisma.customer.findFirst({ where: { userId } })
    if (byUser) return byUser.id
  }
  const byEmail = await prisma.customer.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  return byEmail?.id ?? null
}

// Soft-holds a validated code against a just-created Order -- called inside
// the same transaction app/api/checkout/route.ts already uses to create the
// Order, never a second round trip. Does NOT touch PromotionCode.status;
// that only happens in finalizeRedemption() on real payment success.
export async function applyPromotionCodeToOrderTx(tx: Prisma.TransactionClient, orderId: string, promotionCodeId: string): Promise<void> {
  await tx.order.update({ where: { id: orderId }, data: { appliedPromotionCodeId: promotionCodeId } })
}

// The only place a PromotionCode ever becomes REDEEMED -- called from
// markOrderPaid() once payment has actually succeeded. Idempotent by a
// conditional update (WHERE status = 'ACTIVE'): a second call for the same
// order (e.g. a redelivered/duplicate webhook, already guarded upstream by
// markOrderPaid's own idempotency check, or the narrow two-simultaneous-
// tabs edge case) safely no-ops rather than double-redeeming or throwing --
// the discounted total was already locked into Order.total at checkout
// creation time regardless of this bookkeeping step's outcome.
export async function finalizeRedemption(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { appliedPromotionCodeId: true } })
  if (!order?.appliedPromotionCodeId) return

  await prisma.promotionCode.updateMany({
    where: { id: order.appliedPromotionCodeId, status: 'ACTIVE' },
    data: { status: 'REDEEMED', redeemedAt: new Date(), redeemedOrderId: orderId },
  })
}
