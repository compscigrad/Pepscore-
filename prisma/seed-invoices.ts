// Sample invoice data for local development. Run manually with:
//   npm run db:seed:invoices
// Deliberately NOT part of prisma/seed.ts (which runs on every fresh
// database setup) — this creates a fake customer/sale and shouldn't land in
// a real dashboard by default.
import { PrismaClient } from '@prisma/client'
import { calculateInvoiceTotals } from '../lib/invoice/calculations'
import { generateSequentialInvoiceNumber } from '../lib/invoice/numbering'

const prisma = new PrismaClient()

// Reusable discount templates from the spec's example list.
const promotions = [
  { name: 'FF', description: 'Friends & Family discount', type: 'FIXED' as const, amount: 50 },
  { name: 'Birthday', description: 'Birthday month discount', type: 'PERCENTAGE' as const, amount: 13 },
  { name: 'Holiday Sale', description: 'Seasonal promotion', type: 'PERCENTAGE' as const, amount: 10 },
  { name: 'Referral', description: 'Customer referral reward', type: 'FIXED' as const, amount: 25 },
  { name: 'Gift', description: 'Complimentary gift discount', type: 'FIXED' as const, amount: 89 },
  { name: 'Coupon', description: 'General coupon code redemption', type: 'FIXED' as const, amount: 20 },
  { name: 'Wholesale Discount', description: 'Bulk/wholesale customer pricing', type: 'PERCENTAGE' as const, amount: 20 },
]

async function main() {
  console.log('Seeding sample promotions...')
  const seededPromotions: Record<string, string> = {}
  for (const promo of promotions) {
    const existing = await prisma.promotion.findFirst({ where: { name: promo.name } })
    const record = existing ?? (await prisma.promotion.create({ data: promo }))
    seededPromotions[promo.name] = record.id
    console.log(`  ✓ ${promo.name}`)
  }

  console.log('Seeding Marvin Alexander sample invoice...')

  const items = [
    { name: 'Glow70', quantity: 1, unitPrice: 89, lineDiscount: 0 },
    { name: 'PT-141', quantity: 1, unitPrice: 89, lineDiscount: 0 },
    { name: 'Tesamorelin (Box of 10)', quantity: 1, unitPrice: 750, lineDiscount: 0 },
  ]
  const discounts = [
    { label: 'FF', type: 'FIXED' as const, amount: 50, promotionId: seededPromotions['FF'] },
    { label: 'Gift', type: 'FIXED' as const, amount: 89, promotionId: seededPromotions['Gift'] },
  ]
  const shippingCost = 25
  const amountPaid = 600

  const totals = calculateInvoiceTotals(items, discounts, shippingCost, amountPaid)
  const invoiceNumber = await generateSequentialInvoiceNumber()

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerName: 'Marvin Alexander',
      shippingAddress: {
        street1: '650 S Spring Street Apt 702',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90014',
        country: 'US',
      },
      carrier: 'USPS',
      trackingNumber: '9500 1145 0917 6195 8813 92',
      shippingCost,
      deliveryStatus: 'DELIVERED',
      deliveredDate: new Date('2026-07-18'),
      status: 'PARTIALLY_PAID',
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      amountPaid,
      balanceDue: totals.balanceDue,
      items: {
        create: items.map((item, index) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount,
          total: item.quantity * item.unitPrice - item.lineDiscount,
          sortOrder: index,
        })),
      },
      discounts: {
        create: discounts.map((d) => ({
          promotionId: d.promotionId,
          label: d.label,
          type: d.type,
          amount: d.amount,
          appliedAmount: d.amount, // both sample discounts are FIXED
        })),
      },
      payments: {
        create: [
          {
            amount: amountPaid,
            method: 'CASH',
            paidAt: new Date('2026-07-15'),
            notes: 'Initial payment on order',
          },
        ],
      },
    },
  })

  console.log(`  ✓ ${invoice.invoiceNumber} — total $${invoice.total}, balance $${invoice.balanceDue}`)
  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
