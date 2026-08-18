import { describe, it, expect } from 'vitest'
import { frequencyIntervalDays, addDaysUTC, generateInstallmentSchedule, computePaymentStatus } from './paymentArrangement'

describe('frequencyIntervalDays', () => {
  it('WEEKLY is 7 days', () => {
    expect(frequencyIntervalDays('WEEKLY')).toBe(7)
  })

  it('BIWEEKLY is 14 days', () => {
    expect(frequencyIntervalDays('BIWEEKLY')).toBe(14)
  })
})

describe('addDaysUTC', () => {
  it('adds days using UTC arithmetic', () => {
    const result = addDaysUTC(new Date('2026-01-01T00:00:00.000Z'), 7)
    expect(result.toISOString()).toBe('2026-01-08T00:00:00.000Z')
  })

  it('correctly crosses a month boundary', () => {
    const result = addDaysUTC(new Date('2026-01-28T00:00:00.000Z'), 7)
    expect(result.toISOString()).toBe('2026-02-04T00:00:00.000Z')
  })

  it('correctly crosses a year boundary', () => {
    const result = addDaysUTC(new Date('2026-12-28T00:00:00.000Z'), 7)
    expect(result.toISOString()).toBe('2027-01-04T00:00:00.000Z')
  })

  it('does not mutate the input date', () => {
    const original = new Date('2026-01-01T00:00:00.000Z')
    addDaysUTC(original, 7)
    expect(original.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('adding 0 days returns an equal but distinct date', () => {
    const original = new Date('2026-01-01T00:00:00.000Z')
    const result = addDaysUTC(original, 0)
    expect(result.getTime()).toBe(original.getTime())
    expect(result).not.toBe(original)
  })
})

describe('generateInstallmentSchedule', () => {
  const firstDueDate = new Date('2026-01-01T00:00:00.000Z')

  it('splits evenly when totalAmount divides cleanly', () => {
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount: 300, numberOfPayments: 3, frequency: 'WEEKLY' })
    expect(schedule.map((s) => s.amount)).toEqual([100, 100, 100])
  })

  it('absorbs the rounding remainder into the LAST installment, never the first', () => {
    // 100 / 3 = 33.333... -> base 33.33, 33.33, then remainder makes the last 33.34
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount: 100, numberOfPayments: 3, frequency: 'WEEKLY' })
    expect(schedule[0].amount).toBe(33.33)
    expect(schedule[1].amount).toBe(33.33)
    expect(schedule[2].amount).toBe(33.34)
  })

  it('the schedule always sums to exactly totalAmount -- the core invariant this rounding design exists for', () => {
    const totalAmount = 1000.01
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount, numberOfPayments: 7, frequency: 'WEEKLY' })
    const sum = schedule.reduce((s, i) => s + i.amount, 0)
    expect(Math.round(sum * 100) / 100).toBe(totalAmount)
  })

  it('returns an empty array for zero or negative numberOfPayments', () => {
    expect(generateInstallmentSchedule({ firstDueDate, totalAmount: 100, numberOfPayments: 0, frequency: 'WEEKLY' })).toEqual([])
    expect(generateInstallmentSchedule({ firstDueDate, totalAmount: 100, numberOfPayments: -1, frequency: 'WEEKLY' })).toEqual([])
  })

  it('a single payment is the entire amount due on firstDueDate', () => {
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount: 250, numberOfPayments: 1, frequency: 'WEEKLY' })
    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({ installmentNumber: 1, amount: 250 })
    expect(schedule[0].dueDate.toISOString()).toBe(firstDueDate.toISOString())
  })

  it('spaces due dates by the frequency interval', () => {
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount: 300, numberOfPayments: 3, frequency: 'BIWEEKLY' })
    expect(schedule[0].dueDate.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(schedule[1].dueDate.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(schedule[2].dueDate.toISOString()).toBe('2026-01-29T00:00:00.000Z')
  })

  it('respects a non-default startInstallmentNumber (the "payment already made is #1" case)', () => {
    const schedule = generateInstallmentSchedule({ firstDueDate, totalAmount: 200, numberOfPayments: 2, frequency: 'WEEKLY', startInstallmentNumber: 2 })
    expect(schedule.map((s) => s.installmentNumber)).toEqual([2, 3])
  })
})

describe('computePaymentStatus', () => {
  it('PENDING when nothing has been paid', () => {
    expect(computePaymentStatus(0, 100)).toBe('PENDING')
  })

  it('PENDING for a negative amountPaid (defensive, should not normally occur)', () => {
    expect(computePaymentStatus(-5, 100)).toBe('PENDING')
  })

  it('PARTIAL when some but not all has been paid', () => {
    expect(computePaymentStatus(50, 100)).toBe('PARTIAL')
  })

  it('PAID when amountPaid equals total exactly', () => {
    expect(computePaymentStatus(100, 100)).toBe('PAID')
  })

  it('PAID when amountPaid exceeds total (overpayment)', () => {
    expect(computePaymentStatus(150, 100)).toBe('PAID')
  })
})
