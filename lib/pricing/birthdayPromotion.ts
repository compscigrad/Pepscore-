// Birthday promotion: canonical eligibility, code generation/redemption,
// and the locked discount math (2026-09-03 customer lifecycle sprint).
// Resolved through this one module -- never checkout-only arithmetic --
// so cart, checkout, order, receipt, portal, admin, and Finance can all
// explain a birthday-discounted price the same way.
//
// LOCKED RULE (categorical, no exceptions): a Professional Access account
// is NEVER birthday-eligible. Checked at generation (never issue a code to
// one) AND at redemption (never honor a code someone became Professional
// after receiving, or that reached them through stale data/another path).
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'
import type { Customer, Prisma } from '@prisma/client'

export const BIRTHDAY_DISCOUNT_PERCENT = 15
export const BIRTHDAY_CODE_VALIDITY_DAYS = 90

export class ProfessionalAccountBirthdayError extends Error {
  constructor() {
    super('Professional Access accounts are never eligible for the birthday promotion.')
  }
}
export class BirthdayCodeInvalidError extends Error {}
export class DuplicateBirthdayIssuanceError extends Error {}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ─── Profile validation ─────────────────────────────────────────────────

const DAYS_IN_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
}

// Feb 29 is always accepted at the profile-validation level (a leap-day
// birthday is a real birthday every year) -- issuance itself resolves what
// "first of the birthday month" means for a Feb 29 customer in a
// non-leap year (see resolveBirthdayIssuanceDay below), never rejected here.
export function validateBirthdayMonthDay(month: number, day: number): string | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Birthday month must be between 1 and 12.'
  if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_MONTH[month]) {
    return `Birthday day must be between 1 and ${DAYS_IN_MONTH[month]} for that month.`
  }
  return null
}

// A Feb 29 birthday, in a non-leap issuance year, is issued on Feb 28 --
// never skipped, never bumped into March (which would fall outside the
// customer's actual birthday month for that year).
export function resolveBirthdayIssuanceDay(month: number, day: number, year: number): number {
  if (month === 2 && day === 29) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return isLeap ? 29 : 28
  }
  return day
}

// ─── Eligibility ────────────────────────────────────────────────────────

export function isCustomerBirthdayEligible(customer: Pick<Customer, 'proEligible' | 'birthdayMonth' | 'birthdayDay'>): boolean {
  if (customer.proEligible) return false
  return customer.birthdayMonth != null && customer.birthdayDay != null
}

// ─── Discount math (locked order of operations, section 17) ───────────────
// FIRST: resolve the approved Price Match unit price. SECOND: multiply by
// eligible quantity -> the Price Match merchandise subtotal. THIRD: apply
// 15% to THAT subtotal. `eligibleMerchandiseSubtotal` must already be the
// post-Price-Match figure (i.e. the sum of resolveCanonicalPricing's
// lineTotal for the eligible lines) -- this function never re-derives or
// second-guesses Price Match resolution, it only ever discounts whatever
// merchandise subtotal it's handed.
export function resolveBirthdayDiscountAmount(eligibleMerchandiseSubtotal: number): number {
  if (eligibleMerchandiseSubtotal <= 0) return 0
  return round2(eligibleMerchandiseSubtotal * (BIRTHDAY_DISCOUNT_PERCENT / 100))
}

export function applyBirthdayDiscount(eligibleMerchandiseSubtotal: number): number {
  return round2(eligibleMerchandiseSubtotal - resolveBirthdayDiscountAmount(eligibleMerchandiseSubtotal))
}

// ─── Code generation ────────────────────────────────────────────────────

function generateCode(customer: Pick<Customer, 'firstName'>): string {
  const initials = (customer.firstName || 'BDAY').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '')
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `BDAY-${initials || 'GIFT'}-${random}`
}

// Issues one birthday code for this customer's CURRENT birthday cycle
// (identified by the calendar year the code is issued in -- the @@unique
// [customerId, cycleYear] constraint is the actual duplicate-issuance
// guard, not just this function's own pre-check, so a race between two
// concurrent automation runs can't double-issue). Throws rather than
// silently skipping a Professional account or an already-issued cycle --
// callers (the monthly automation loop) catch and log, never let one
// customer's failure stop the batch.
export async function generateBirthdayCode(customerId: string, cycleYear: number): Promise<{ code: string; expiresAt: Date }> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })

  if (!isCustomerBirthdayEligible(customer)) {
    throw new ProfessionalAccountBirthdayError()
  }

  const existing = await prisma.birthdayPromotionCode.findUnique({ where: { customerId_cycleYear: { customerId, cycleYear } } })
  if (existing) {
    throw new DuplicateBirthdayIssuanceError(`Customer ${customerId} already has a birthday code for ${cycleYear}.`)
  }

  const code = generateCode(customer)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + BIRTHDAY_CODE_VALIDITY_DAYS)

  await prisma.birthdayPromotionCode.create({
    data: { code, customerId, cycleYear, expiresAt, discountPercent: BIRTHDAY_DISCOUNT_PERCENT },
  })

  await recordCustomerActivity({
    customerId,
    eventType: 'BIRTHDAY_PROMOTION_ISSUED',
    newValue: code,
    source: 'SYSTEM',
  })

  return { code, expiresAt }
}

// ─── Redemption ─────────────────────────────────────────────────────────

export interface BirthdayCodeValidation {
  valid: boolean
  reason?: string
  codeId?: string
  discountPercent?: number
}

// Read-only check -- never mutates. The actual redemption (markBirthday
// CodeRedeemed) is a separate, explicit step taken only once an order/
// invoice referencing this code actually commits, same "validate, then
// commit" split as every other promotion-redemption path in this codebase.
export async function validateBirthdayCode(code: string, customerId: string): Promise<BirthdayCodeValidation> {
  const row = await prisma.birthdayPromotionCode.findUnique({ where: { code } })
  if (!row) return { valid: false, reason: 'Code not found.' }
  if (row.customerId !== customerId) return { valid: false, reason: 'This code does not belong to this customer.' }
  if (row.status === 'REDEEMED') return { valid: false, reason: 'This code has already been redeemed.' }
  if (row.status === 'REVOKED') return { valid: false, reason: 'This code has been revoked.' }
  if (row.status === 'EXPIRED' || row.expiresAt < new Date()) return { valid: false, reason: 'This code has expired.' }

  // Re-check Professional status at redemption time too -- never trust that
  // eligibility hasn't changed since issuance (section 16's explicit
  // "audit both generation and redemption" requirement).
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { proEligible: true } })
  if (customer.proEligible) return { valid: false, reason: 'Professional Access accounts cannot redeem the birthday promotion.' }

  return { valid: true, codeId: row.id, discountPercent: row.discountPercent }
}

export async function markBirthdayCodeRedeemed(codeId: string, orderId: string | null): Promise<void> {
  const row = await prisma.birthdayPromotionCode.findUniqueOrThrow({ where: { id: codeId } })
  if (row.status !== 'ACTIVE') {
    throw new BirthdayCodeInvalidError(`Cannot redeem a code in status ${row.status}.`)
  }
  await prisma.birthdayPromotionCode.update({
    where: { id: codeId },
    data: { status: 'REDEEMED', redeemedAt: new Date(), redeemedOrderId: orderId ?? undefined },
  })
  await recordCustomerActivity({
    customerId: row.customerId,
    eventType: 'BIRTHDAY_PROMOTION_REDEEMED',
    newValue: row.code,
    source: 'SYSTEM',
  })
}

// ─── Checkout integration ───────────────────────────────────────────────
// Mirrors lib/promotions/redemption.ts's resolvePromotionCode/
// applyPromotionCodeToOrderTx/finalizeRedemption exactly (same two-phase
// soft-hold/finalize discipline, same reason this codebase never permanently
// burns a one-time code on an abandoned checkout) -- a SEPARATE set of
// functions rather than shoehorning this into resolvePromotionCode itself,
// because a birthday code's discount is computed against the already-
// Price-Match-resolved cart subtotal (section 17's locked order of
// operations), never the raw pre-match subtotal a generic promo code
// discounts against -- genuinely different math, not just a different table.

// Every code this codebase generates for a customer to type in is
// UPPERCASE (generateCode() above), so a leading "BDAY-" after
// normalizing case is an unambiguous, cheap way for the checkout code
// field to route to this resolver instead of the generic PromotionCode
// one without querying both tables for every keystroke.
export function isBirthdayCodeFormat(rawCode: string): boolean {
  return rawCode.trim().toUpperCase().startsWith('BDAY-')
}

export interface BirthdayCheckoutResolution {
  valid: boolean
  reason?: BirthdayCodeInvalidReason
  message?: string
  codeId?: string
  discountAmount?: number
  label?: string
}

export type BirthdayCodeInvalidReason = 'INVALID_CODE' | 'WRONG_CUSTOMER' | 'ALREADY_USED' | 'REVOKED' | 'EXPIRED' | 'PROFESSIONAL_INELIGIBLE'

export const BIRTHDAY_CODE_INVALID_MESSAGE: Record<BirthdayCodeInvalidReason, string> = {
  INVALID_CODE: "This promotion code isn't valid.",
  WRONG_CUSTOMER: "This code isn't valid for your account.",
  ALREADY_USED: 'This birthday promotion has already been redeemed.',
  REVOKED: 'This promotion code isn’t valid.',
  EXPIRED: 'This promotion has expired.',
  PROFESSIONAL_INELIGIBLE: 'Birthday promotions are not available with Professional pricing.',
}

// eligibleMerchandiseSubtotal MUST already reflect any resolved Price Match
// unit prices for this cart (i.e. the real subtotal checkout is about to
// charge before this code) -- see resolveBirthdayDiscountAmount's own
// header for why the birthday percentage is never computed from a
// standard, pre-match subtotal.
export async function resolveBirthdayCodeForCheckout(
  rawCode: string,
  customerId: string,
  eligibleMerchandiseSubtotal: number
): Promise<BirthdayCheckoutResolution> {
  const code = rawCode.trim().toUpperCase()
  const row = await prisma.birthdayPromotionCode.findUnique({ where: { code } })
  if (!row) return { valid: false, reason: 'INVALID_CODE', message: BIRTHDAY_CODE_INVALID_MESSAGE.INVALID_CODE }
  if (row.customerId !== customerId) return { valid: false, reason: 'WRONG_CUSTOMER', message: BIRTHDAY_CODE_INVALID_MESSAGE.WRONG_CUSTOMER }
  if (row.status === 'REDEEMED') return { valid: false, reason: 'ALREADY_USED', message: BIRTHDAY_CODE_INVALID_MESSAGE.ALREADY_USED }
  if (row.status === 'REVOKED' || row.revokedAt) return { valid: false, reason: 'REVOKED', message: BIRTHDAY_CODE_INVALID_MESSAGE.REVOKED }
  if (row.status === 'EXPIRED' || row.expiresAt < new Date()) return { valid: false, reason: 'EXPIRED', message: BIRTHDAY_CODE_INVALID_MESSAGE.EXPIRED }

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { proEligible: true } })
  if (customer.proEligible) {
    return { valid: false, reason: 'PROFESSIONAL_INELIGIBLE', message: BIRTHDAY_CODE_INVALID_MESSAGE.PROFESSIONAL_INELIGIBLE }
  }

  return {
    valid: true,
    codeId: row.id,
    discountAmount: resolveBirthdayDiscountAmount(eligibleMerchandiseSubtotal),
    label: `Birthday ${row.discountPercent}%`,
  }
}

// Soft-hold, inside the same transaction as Order creation -- never touches
// PromotionCodeStatus yet.
export async function applyBirthdayCodeToOrderTx(tx: Prisma.TransactionClient, orderId: string, birthdayCodeId: string): Promise<void> {
  await tx.order.update({ where: { id: orderId }, data: { appliedBirthdayCodeId: birthdayCodeId } })
}

// The only place a BirthdayPromotionCode ever becomes REDEEMED through
// checkout -- called from markOrderPaid() on real payment success.
// Idempotent by conditional update (WHERE status = 'ACTIVE'), same
// double-webhook/duplicate-tab protection as finalizeRedemption.
export async function finalizeBirthdayRedemption(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { appliedBirthdayCodeId: true } })
  if (!order?.appliedBirthdayCodeId) return

  const updated = await prisma.birthdayPromotionCode.updateMany({
    where: { id: order.appliedBirthdayCodeId, status: 'ACTIVE' },
    data: { status: 'REDEEMED', redeemedAt: new Date(), redeemedOrderId: orderId },
  })
  if (updated.count > 0) {
    const row = await prisma.birthdayPromotionCode.findUnique({ where: { id: order.appliedBirthdayCodeId }, select: { customerId: true, code: true } })
    if (row) {
      await recordCustomerActivity({ customerId: row.customerId, eventType: 'BIRTHDAY_PROMOTION_REDEEMED', newValue: row.code, source: 'SYSTEM' })
    }
  }
}
