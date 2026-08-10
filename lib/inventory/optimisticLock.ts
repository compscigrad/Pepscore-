// Shared optimistic-concurrency guard for every write to Product's
// reservedUnits/physicalStockOnHand columns (lib/inventory/reservations.ts,
// lib/inventory/orderReservations.ts). Phase 4A production-readiness audit
// found every one of these write sites followed the same unsafe pattern:
// read the product, compute new values in application code, then
// `product.update({ where: { id } })` unconditionally -- under Postgres's
// default READ COMMITTED isolation, two concurrent transactions computing
// from the same stale snapshot can both "succeed," with the second write
// silently clobbering the first's committed change rather than compounding
// on top of it (e.g. two simultaneous checkouts for the last unit of a
// product can both create a real ACTIVE reservation, while
// Product.reservedUnits only ever reflects one of them).
//
// This guards the write with a WHERE clause re-asserting both columns
// haven't changed since the read that computed the new values -- if
// `updateMany`'s affected-row count is 0, someone else won the race, and
// the caller retries with a fresh read (which, under READ COMMITTED, will
// correctly observe the other transaction's already-committed change).
import type { Prisma, PrismaClient, Product } from '@prisma/client'

export type Db = PrismaClient | Prisma.TransactionClient

const MAX_ATTEMPTS = 5

export interface ProductLockOutcome<T> {
  // null means "no write needed" (e.g. tracking disabled, nothing available)
  // -- compute() itself decides this, so callers never write a no-op update.
  data: Prisma.ProductUpdateInput | null
  result: T
}

export async function withOptimisticProductLock<T>(
  tx: Db,
  productId: string,
  compute: (product: Product) => ProductLockOutcome<T>
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })
    const { data, result } = compute(product)
    if (data === null) return result

    const { count } = await tx.product.updateMany({
      where: { id: productId, reservedUnits: product.reservedUnits, physicalStockOnHand: product.physicalStockOnHand },
      data,
    })
    if (count === 1) return result
    // Someone else changed reservedUnits/physicalStockOnHand concurrently between our read and write -- retry with a fresh read.
  }
  throw new Error(`Inventory update for product ${productId} failed after ${MAX_ATTEMPTS} attempts due to concurrent modification -- please retry`)
}
