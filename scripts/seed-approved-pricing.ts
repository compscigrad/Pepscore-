// One-off seed for the two products with fully owner-approved active
// pricing (2026-08-06 pricing discussion): Tesamorelin 10mg's manual
// competitive-market override, and GLOW70's locked override (which also
// requires creating the Product row -- GLOW70 does not exist in the
// catalog today, confirmed by the pricing-catalog audit run ahead of this
// sprint).
//
// Every other product in the RUO price table is deliberately left alone --
// see scripts/import-pricing-catalog.ts for the read-only mapping/
// suggested-pricing pass across the full 119-row catalog. This script only
// ever touches these two specific rows, and never sets inventoryTrackingEnabled
// or a physical stock count (opening quantities are never invented; that's
// a separate, explicit admin action once real counts are available).
import { prisma } from '../lib/prisma'
import { seedProductPricing } from '../lib/pricing/service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const results: Array<Record<string, unknown>> = []

  // ─── Tesamorelin 10mg — manual competitive-market override ──────────────
  const tesamorelin = await prisma.product.findUnique({ where: { slug: 'tesamorelin-10mg' } })
  if (!tesamorelin) {
    results.push({ product: 'Tesamorelin 10mg', skipped: 'no product with slug tesamorelin-10mg found' })
  } else {
    if (!dryRun) {
      await seedProductPricing(tesamorelin.id, {
        supplierCaseCost: 177, // RUO price table formula baseline
        unitsPerCase: 10,
        activeStandardCasePrice: 775,
        activeSpaCasePrice: 700,
        activeBulkPrice: null, // pending owner direction, per instruction
        activeIndividualVialPrice: 80,
        individualSalesEnabled: false,
        manualPricingOverride: true,
        pricingOverrideReason: 'Manual competitive-market override (2026-08-06) — supersedes the formula-suggested case price ($1,425/$1,004). Individual vial price stored for database completeness only; sales disabled until admin explicitly enables.',
        pricingNotes: 'Not currently sold by individual vial — only Standard and SPA case.',
        sku: null,
      })
    }
    results.push({ product: 'Tesamorelin 10mg', productId: tesamorelin.id, applied: !dryRun })
  }

  // ─── GLOW70 — locked pricing, product row does not exist yet ────────────
  let glow70 = await prisma.product.findUnique({ where: { slug: 'glow70-70mg' } })
  if (!glow70 && !dryRun) {
    glow70 = await prisma.product.create({
      data: {
        slug: 'glow70-70mg',
        name: 'GLOW70',
        category: 'Combination',
        size: '70mg',
        // Legacy flat-price field (storefront / invoice-item datalist) —
        // set to the approved individual-vial price since individual sales
        // are enabled for this product, matching how every other
        // individual-sale-eligible product's legacy `price` field is used.
        price: 89,
        description: 'Pre-formulated recovery and wellness blend. [Placeholder description carried over from the sibling GLOW50 product pattern — flag for owner review/replacement with GLOW70-specific copy.]',
        imageUrl: '/images/ALL.png', // same fallback GLOW50 uses; no GLOW70-specific asset exists yet
        costOfGoods: 0, // legacy field superseded by supplierCaseCost below for this product
      },
    })
  }

  if (!glow70) {
    results.push({ product: 'GLOW70', skipped: dryRun ? 'DRY RUN — product would be created' : 'creation failed' })
  } else {
    if (!dryRun) {
      await seedProductPricing(glow70.id, {
        supplierCaseCost: 186,
        unitsPerCase: 10,
        activeStandardCasePrice: 725,
        activeSpaCasePrice: 565,
        activeBulkPrice: null,
        activeIndividualVialPrice: 89,
        individualSalesEnabled: true,
        manualPricingOverride: true,
        pricingOverrideReason: 'Locked GLOW70 pricing (2026-08-06 pricing discussion) — do not replace with formula-generated pricing.',
        sku: null,
      })
    }
    results.push({ product: 'GLOW70', productId: glow70.id, created: true, applied: !dryRun })
  }

  console.log(JSON.stringify({ mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED', results }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
