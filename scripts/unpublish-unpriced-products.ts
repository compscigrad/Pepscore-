// One-off pricing-policy correction (2026-08-07): the 16 active products
// that never matched a row in the RUO price-table import (see
// lib/pricing/catalogImport.ts) have no supplierCaseCost and therefore no
// factual basis for a price -- scripts/promote-formula-pricing.ts
// correctly left them alone rather than guessing.
//
// Per the pricing-policy correction, a genuinely-blocked row must not
// show "Pricing available on request" on the storefront -- it must be
// temporarily unpublished instead. pricingStatus: INACTIVE is the
// existing mechanism the storefront already fully honors (excluded from
// homepage/categories/search/product-detail/sitemap -- see
// app/products/[slug]/page.tsx, app/page.tsx, app/categories/**,
// lib/storefront/search.ts, app/sitemap.ts, all filtering
// `pricingStatus: { not: 'INACTIVE' } }`). This is the same mechanism
// used for GLOW50 (scripts/seed-approved-pricing.ts), except that case
// is a permanent discontinuation and this one is temporary pending owner
// input on supplier cost -- pricingNotes on each row records that
// distinction so an admin doesn't mistake this for a discontinued
// product.
import { prisma } from '../lib/prisma'

const REASON = 'Pricing-policy correction (2026-08-07): no supplierCaseCost exists for this product -- never matched during the RUO price-table import. Temporarily unpublished (not shown on storefront) rather than displaying "Pricing available on request" or a placeholder price, per explicit instruction not to guess pricing for a genuinely blocked row. Re-activate once real supplier cost is supplied and pricing is set.'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const blocked = await prisma.product.findMany({
    where: { pricingStatus: 'ACTIVE', activeStandardCasePrice: null, supplierCaseCost: null },
    select: { id: true, name: true, size: true },
    orderBy: [{ name: 'asc' }, { size: 'asc' }],
  })

  const results: Array<Record<string, unknown>> = []
  for (const p of blocked) {
    if (!dryRun) {
      await prisma.product.update({
        where: { id: p.id },
        data: { pricingStatus: 'INACTIVE', pricingNotes: REASON },
      })
      await prisma.adminAuditLog.create({
        data: {
          action: 'PRODUCT_TEMPORARILY_UNPUBLISHED_PENDING_PRICING',
          entity: 'Product',
          entityId: p.id,
          adminId: 'system-pricing-completion',
          details: { reason: REASON, productName: p.name, size: p.size },
        },
      })
    }
    results.push({ product: p.name, size: p.size, applied: !dryRun })
  }

  console.log(JSON.stringify({ mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED', count: results.length, results }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
