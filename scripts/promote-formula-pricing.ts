// One-off catalog-wide pricing completion (2026-08-07 pricing-policy
// correction): promotes the approved formula's suggested* pricing to
// active* pricing for every ACTIVE product that has a supplierCaseCost
// from the RUO price table import but was never individually reviewed
// (manualPricingOverride === false, activeStandardCasePrice still null).
//
// Never touches the 3 products with an approved manual override (GLOW70,
// Tesamorelin 10mg, Tesamorelin 5mg -- see scripts/seed-approved-pricing.ts)
// and never invents a supplierCaseCost for the products the RUO price
// table import never matched (see scripts/import-pricing-catalog.ts) --
// those stay unpriced/unpublished-price and are reported as blocked.
//
// individualSalesEnabled is deliberately left untouched (false, its
// existing default) -- storing an active individual-vial price does not
// by itself make a product individually purchasable; that visibility
// decision stays a separate, explicit admin action (same precedent as
// Tesamorelin's "stored for database completeness only" individual price).
import { prisma } from '../lib/prisma'
import { setActivePricing } from '../lib/pricing/service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const candidates = await prisma.product.findMany({
    where: {
      pricingStatus: 'ACTIVE',
      manualPricingOverride: false,
      activeStandardCasePrice: null,
      supplierCaseCost: { not: null },
    },
    select: {
      id: true, name: true, size: true,
      suggestedStandardCasePrice: true,
      suggestedProCasePrice: true,
      suggestedIndividualVialPrice: true,
    },
    orderBy: [{ name: 'asc' }, { size: 'asc' }],
  })

  const results: Array<Record<string, unknown>> = []

  for (const p of candidates) {
    if (p.suggestedStandardCasePrice == null) {
      // Should be impossible given the supplierCaseCost filter above (the
      // engine always computes all three together) -- guard rather than
      // silently write a partial/invalid row.
      results.push({ product: p.name, size: p.size, skipped: 'suggestedStandardCasePrice missing despite supplierCaseCost set' })
      continue
    }
    if (!dryRun) {
      await setActivePricing(
        p.id,
        {
          activeStandardCasePrice: p.suggestedStandardCasePrice,
          activeProCasePrice: p.suggestedProCasePrice,
          activeIndividualVialPrice: p.suggestedIndividualVialPrice,
        },
        { actorId: 'system-pricing-completion', source: 'CATALOG_SEED', reason: 'Pricing-policy correction (2026-08-07): promote formula-suggested pricing to active' }
      )
      await prisma.adminAuditLog.create({
        data: {
          action: 'PROMOTE_SUGGESTED_TO_ACTIVE_PRICING',
          entity: 'Product',
          entityId: p.id,
          adminId: 'system-pricing-completion',
          details: {
            reason: 'Pricing-policy correction (2026-08-07): no active product may show $0/null/pricing-on-request. Promoted formula-suggested pricing to active since no manual override or missing-cost block applies.',
            activeStandardCasePrice: p.suggestedStandardCasePrice,
            activeProCasePrice: p.suggestedProCasePrice,
            activeIndividualVialPrice: p.suggestedIndividualVialPrice,
          },
        },
      })
    }
    results.push({
      product: p.name, size: p.size, applied: !dryRun,
      activeStandardCasePrice: p.suggestedStandardCasePrice,
      activeProCasePrice: p.suggestedProCasePrice,
      activeIndividualVialPrice: p.suggestedIndividualVialPrice,
    })
  }

  const stillBlocked = await prisma.product.findMany({
    where: { pricingStatus: 'ACTIVE', activeStandardCasePrice: null },
    select: { name: true, size: true, supplierCaseCost: true },
    orderBy: [{ name: 'asc' }, { size: 'asc' }],
  })

  console.log(JSON.stringify({
    mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED',
    promotedCount: results.filter(r => r.applied || (dryRun && !r.skipped)).length,
    promoted: results,
    genuinelyBlocked: stillBlocked.map(b => ({ product: b.name, size: b.size, reason: b.supplierCaseCost == null ? 'no supplierCaseCost (never matched in RUO price-table import)' : 'unresolved despite supplierCaseCost present' })),
  }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
