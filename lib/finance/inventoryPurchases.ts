// COGS-feeding stock purchases (2026-08-12 Finance sprint) -- deliberately
// layered on top of the existing addStock() inventory action rather than
// writing physical-stock changes directly, so a purchase and the ledger
// entry it produces can never drift out of sync (one call, one
// transaction-adjacent pair of writes, see recordInventoryPurchase below).
import { prisma } from '@/lib/prisma'
import { addStock } from '@/lib/inventory/actions'
import type { InventoryPurchase } from '@prisma/client'

export interface RecordInventoryPurchaseInput {
  productId: string
  supplier?: string | null
  sku?: string | null
  quantity: number
  caseQuantity?: number | null
  unitCost: number
  receiptUrl?: string | null
  invoiceRef?: string | null
  receivedAt: Date
  notes?: string | null
  // When true (default), also records the physical stock receipt via the
  // same addStock() action every other "Add Stock" admin control uses.
  // False lets a purchase be logged for COGS purposes ahead of the
  // physical count actually being verified/received.
  recordPhysicalStock?: boolean
}

export async function recordInventoryPurchase(input: RecordInventoryPurchaseInput, actorId: string): Promise<InventoryPurchase> {
  const totalCost = input.quantity * input.unitCost

  let ledgerEntryId: string | null = null
  if (input.recordPhysicalStock !== false) {
    const entry = await addStock(input.productId, input.quantity, actorId, 'Inventory purchase received', input.notes ?? undefined)
    ledgerEntryId = entry.id
  }

  const purchase = await prisma.inventoryPurchase.create({
    data: {
      productId: input.productId,
      supplier: input.supplier,
      sku: input.sku,
      quantity: input.quantity,
      caseQuantity: input.caseQuantity,
      unitCost: input.unitCost,
      totalCost,
      receiptUrl: input.receiptUrl,
      invoiceRef: input.invoiceRef,
      receivedAt: input.receivedAt,
      notes: input.notes,
      ledgerEntryId,
      createdBy: actorId,
    },
  })

  await prisma.adminAuditLog.create({
    data: {
      action: 'INVENTORY_PURCHASE_RECORDED',
      entity: 'InventoryPurchase',
      entityId: purchase.id,
      adminId: actorId,
      details: { productId: input.productId, quantity: input.quantity, totalCost, ledgerEntryId },
    },
  })

  return purchase
}

export async function listInventoryPurchases(filters: { from?: Date; to?: Date; productId?: string } = {}): Promise<(InventoryPurchase & { product: { name: string; size: string } })[]> {
  return prisma.inventoryPurchase.findMany({
    where: {
      productId: filters.productId,
      receivedAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    },
    include: { product: { select: { name: true, size: true } } },
    orderBy: { receivedAt: 'desc' },
  })
}
