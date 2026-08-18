// Read-only launch-readiness check: does every ACTIVE catalog product
// belong to at least one merchandisingTaxonomy.ts category? A product with
// zero membership is still findable via search but invisible when
// browsing by category -- exactly the bug found and fixed 2026-08-18
// (Glutathione, Dermorphin, B12 1mg/ml, G610). Run this after adding new
// products or reactivating discontinued ones; not part of the automated
// test suite since it depends on live DB state, not source alone.
//
// Run: npx tsx scripts/audit-taxonomy-coverage.ts
import { PrismaClient } from '@prisma/client'
import { MERCHANDISING_TAXONOMY } from '../lib/storefront/merchandisingTaxonomy'

const prisma = new PrismaClient()

async function main() {
  const activeProducts = await prisma.product.findMany({
    where: { pricingStatus: 'ACTIVE' },
    select: { name: true },
    distinct: ['name'],
  })

  const allTaxonomyNames = new Set(MERCHANDISING_TAXONOMY.flatMap((c) => c.productNames))
  const uncategorized = activeProducts.filter((p) => !allTaxonomyNames.has(p.name))

  console.log(`Active distinct product names: ${activeProducts.length}`)
  console.log(`Uncategorized (in no taxonomy group): ${uncategorized.length}`)
  if (uncategorized.length > 0) {
    console.log(uncategorized.map((p) => `  - ${p.name}`).join('\n'))
    process.exitCode = 1
  } else {
    console.log('All active products belong to at least one merchandising category.')
  }
}

main().finally(() => prisma.$disconnect())
