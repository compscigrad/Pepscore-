// Keeps LowStockAlert in sync with a product's current available quantity.
// Called after every inventory/reservation write that can move available
// stock across the threshold. Never more than one OPEN alert per product;
// a breach while one is already OPEN is a no-op, a recovery resolves it.
import { prisma } from '@/lib/prisma'
import { computeAvailableUnits } from './status'

export async function refreshLowStockAlert(productId: string, actor: string): Promise<void> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
  const available = computeAvailableUnits(product.physicalStockOnHand, product.reservedUnits)

  const isBelowThreshold =
    product.inventoryTrackingEnabled &&
    available !== null &&
    product.lowStockThreshold !== null &&
    available <= product.lowStockThreshold

  const openAlert = await prisma.lowStockAlert.findFirst({ where: { productId, status: 'OPEN' } })

  if (isBelowThreshold && !openAlert) {
    await prisma.lowStockAlert.create({
      data: { productId, threshold: product.lowStockThreshold!, availableAtAlert: available! },
    })
  } else if (!isBelowThreshold && openAlert) {
    await prisma.lowStockAlert.update({
      where: { id: openAlert.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: actor },
    })
  }
}
