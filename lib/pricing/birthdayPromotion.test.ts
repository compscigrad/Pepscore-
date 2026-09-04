import { describe, it, expect } from 'vitest'
import {
  isCustomerBirthdayEligible,
  resolveBirthdayDiscountAmount,
  applyBirthdayDiscount,
  validateBirthdayMonthDay,
  resolveBirthdayIssuanceDay,
  isBirthdayCodeFormat,
  BIRTHDAY_DISCOUNT_PERCENT,
} from './birthdayPromotion'

describe('isCustomerBirthdayEligible', () => {
  it('a Professional account is never eligible, even with a birthday on file', () => {
    expect(isCustomerBirthdayEligible({ proEligible: true, birthdayMonth: 6, birthdayDay: 15 })).toBe(false)
  })

  it('an ordinary customer with a birthday on file is eligible', () => {
    expect(isCustomerBirthdayEligible({ proEligible: false, birthdayMonth: 6, birthdayDay: 15 })).toBe(true)
  })

  it('a customer with no birthday on file is not eligible', () => {
    expect(isCustomerBirthdayEligible({ proEligible: false, birthdayMonth: null, birthdayDay: null })).toBe(false)
  })
})

describe('resolveBirthdayDiscountAmount / applyBirthdayDiscount -- locked order of operations (section 17)', () => {
  it('the exact spec example: $80 matched price x 5 qty = $400, then 15% off = $60 off, $340 final', () => {
    const priceMatchSubtotal = 80 * 5
    expect(priceMatchSubtotal).toBe(400)
    expect(resolveBirthdayDiscountAmount(priceMatchSubtotal)).toBe(60)
    expect(applyBirthdayDiscount(priceMatchSubtotal)).toBe(340)
  })

  it('never computed from a pre-Price-Match standard subtotal (the explicitly forbidden shortcut)', () => {
    const standardSubtotal = 100 * 5 // $500 -- NOT what should be discounted
    const priceMatchSubtotal = 80 * 5 // $400 -- what should be discounted
    expect(resolveBirthdayDiscountAmount(priceMatchSubtotal)).not.toBe(resolveBirthdayDiscountAmount(standardSubtotal))
    expect(resolveBirthdayDiscountAmount(priceMatchSubtotal)).toBe(60)
  })

  it('is always exactly 15%', () => {
    expect(BIRTHDAY_DISCOUNT_PERCENT).toBe(15)
  })

  it('a $0 subtotal produces a $0 discount, never negative', () => {
    expect(resolveBirthdayDiscountAmount(0)).toBe(0)
    expect(applyBirthdayDiscount(0)).toBe(0)
  })
})

describe('validateBirthdayMonthDay', () => {
  it('accepts a valid month/day', () => {
    expect(validateBirthdayMonthDay(6, 15)).toBeNull()
  })

  it('accepts Feb 29 (leap-day birthday)', () => {
    expect(validateBirthdayMonthDay(2, 29)).toBeNull()
  })

  it('rejects month 0 and month 13', () => {
    expect(validateBirthdayMonthDay(0, 1)).not.toBeNull()
    expect(validateBirthdayMonthDay(13, 1)).not.toBeNull()
  })

  it('rejects day 31 in a 30-day month', () => {
    expect(validateBirthdayMonthDay(4, 31)).not.toBeNull()
  })

  it('rejects Feb 30', () => {
    expect(validateBirthdayMonthDay(2, 30)).not.toBeNull()
  })
})

describe('isBirthdayCodeFormat', () => {
  it('recognizes a real generated code regardless of case', () => {
    expect(isBirthdayCodeFormat('BDAY-JS-4F9A2C')).toBe(true)
    expect(isBirthdayCodeFormat('bday-js-4f9a2c')).toBe(true)
  })

  it('tolerates surrounding whitespace (matches how the checkout form trims input)', () => {
    expect(isBirthdayCodeFormat('  BDAY-JS-4F9A2C  ')).toBe(true)
  })

  it('rejects a generic PromotionCode-style code', () => {
    expect(isBirthdayCodeFormat('WELCOME10')).toBe(false)
    expect(isBirthdayCodeFormat('FIRST10')).toBe(false)
  })

  it('rejects an empty or unrelated string', () => {
    expect(isBirthdayCodeFormat('')).toBe(false)
    expect(isBirthdayCodeFormat('HAPPYBDAY')).toBe(false)
  })
})

describe('resolveBirthdayIssuanceDay', () => {
  it('a Feb 29 birthday issues on Feb 28 in a non-leap year', () => {
    expect(resolveBirthdayIssuanceDay(2, 29, 2027)).toBe(28)
  })

  it('a Feb 29 birthday issues on Feb 29 in a leap year', () => {
    expect(resolveBirthdayIssuanceDay(2, 29, 2028)).toBe(29)
  })

  it('an ordinary birthday is unaffected', () => {
    expect(resolveBirthdayIssuanceDay(6, 15, 2027)).toBe(15)
  })
})
