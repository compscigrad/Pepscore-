// Pure control-flow tests for the retry loop itself -- the real race-
// condition behavior (two genuinely concurrent transactions) can only be
// meaningfully proven against real Postgres, which was done via a
// disposable rehearsal script during the Phase 4A audit fix (see
// docs/Decisions.md), not re-creatable here without a real DB. What *is*
// unit-testable in isolation is that the retry loop reads fresh each
// attempt, stops on the first successful conditional write, and gives up
// with a clear error after exhausting its attempts -- verified here with a
// fake `tx` whose `updateMany` return value is scripted per call.
import { describe, it, expect, vi } from 'vitest'
import { withOptimisticProductLock } from './optimisticLock'
import type { Product } from '@prisma/client'

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return { id: 'p1', reservedUnits: 0, physicalStockOnHand: 10, ...overrides } as Product
}

function fakeTx(findResults: Product[], updateCounts: number[]) {
  let findCall = 0
  let updateCall = 0
  const product = {
    findUniqueOrThrow: vi.fn(async () => findResults[findCall++]),
    updateMany: vi.fn(async () => ({ count: updateCounts[updateCall++] })),
  }
  return { tx: { product } as unknown as Parameters<typeof withOptimisticProductLock>[0], product }
}

describe('withOptimisticProductLock', () => {
  it('succeeds on the first attempt when nothing else changed the row concurrently', async () => {
    const { tx, product } = fakeTx([fakeProduct({ reservedUnits: 2 })], [1])
    const result = await withOptimisticProductLock(tx, 'p1', (p) => ({
      data: { reservedUnits: p.reservedUnits + 1 },
      result: p.reservedUnits + 1,
    }))
    expect(result).toBe(3)
    expect(product.updateMany).toHaveBeenCalledTimes(1)
  })

  it('retries with a fresh read when the conditional update affects 0 rows (lost the race), then succeeds', async () => {
    const { tx, product } = fakeTx(
      [fakeProduct({ reservedUnits: 2 }), fakeProduct({ reservedUnits: 3 })], // second read reflects the other transaction's committed change
      [0, 1] // first attempt loses the race, second succeeds
    )
    const result = await withOptimisticProductLock(tx, 'p1', (p) => ({
      data: { reservedUnits: p.reservedUnits + 1 },
      result: p.reservedUnits + 1,
    }))
    expect(result).toBe(4) // computed from the SECOND (fresher) read, not the stale first one
    expect(product.findUniqueOrThrow).toHaveBeenCalledTimes(2)
    expect(product.updateMany).toHaveBeenCalledTimes(2)
  })

  it('never writes at all when compute() returns data: null -- a legitimate no-op, not a failed attempt', async () => {
    const { tx, product } = fakeTx([fakeProduct()], [])
    const result = await withOptimisticProductLock(tx, 'p1', () => ({ data: null, result: 'skipped' }))
    expect(result).toBe('skipped')
    expect(product.updateMany).not.toHaveBeenCalled()
  })

  it('throws a clear error after exhausting all retry attempts under sustained contention', async () => {
    const reads = Array.from({ length: 6 }, () => fakeProduct())
    const updates = Array.from({ length: 6 }, () => 0) // every attempt loses the race
    const { tx } = fakeTx(reads, updates)
    await expect(withOptimisticProductLock(tx, 'p1', (product) => ({ data: { reservedUnits: product.reservedUnits + 1 }, result: null }))).rejects.toThrow(
      /concurrent modification/i
    )
  })
})
