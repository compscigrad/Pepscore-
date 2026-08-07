// Keeps LowStockAlert in sync with a product's current available quantity.
// Called after every inventory/reservation write that can move available
// stock across the threshold. Never more than one OPEN alert per product;
// a breach while one is already OPEN is a no-op, a recovery resolves it.
//
// Accepts an optional Prisma client/transaction (db) so callers already
// inside a larger transaction (invoice save, admin correction) can pass
// their `tx` and get a consistent read of the just-written state, instead
// of this function querying through a separate connection that can't see
// uncommitted writes yet.
import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeAvailableUnits } from './status'

type Db = PrismaClient | Prisma.TransactionClient

export async function refreshLowStockAlert(productId: string, actor: string, db: Db = prisma): Promise<void> {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } })
  const available = computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits)

  const isBelowThreshold =
    product.inventoryTrackingEnabled &&
    available !== null &&
    product.lowStockThreshold !== null &&
    available <= product.lowStockThreshold

  const openAlert = await db.lowStockAlert.findFirst({ where: { productId, status: 'OPEN' } })

  if (isBelowThreshold && !openAlert) {
    await db.lowStockAlert.create({
      data: { productId, threshold: product.lowStockThreshold!, availableAtAlert: available! },
    })
  } else if (!isBelowThreshold && openAlert) {
    await db.lowStockAlert.update({
      where: { id: openAlert.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: actor },
    })
  }
}
