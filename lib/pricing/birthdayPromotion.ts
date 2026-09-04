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
import type { Customer } from '@prisma/client'

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
