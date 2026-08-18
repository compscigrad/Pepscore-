// One-off launch-cleanup migration (2026-08-18): the last remaining
// public-facing risky Product.category value. Snap-8's raw category was
// "Cosmetic Peptide" (FDA/FTC risk language, separate from the
// merchandisingTaxonomy.ts presentation label already fixed earlier this
// sprint). Replaces it with "Neuromuscular Peptide", matching this
// taxonomy group's existing "[Mechanism] Peptide" naming convention
// (GHK-Cu -> "Copper Peptide", MT-2 -> "Melanocortin Peptide") and
// Snap-8's own live product description ("neuromuscular signaling").
//
// Dry-run by default; pass --apply to write. Does not touch name, slug,
// pricing, visibility, pricingStatus, description, or image mapping.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

const OLD_CATEGORY = 'Cosmetic Peptide'
const NEW_CATEGORY = 'Neuromuscular Peptide'

async function main() {
  const rows = await prisma.product.findMany({
    where: { name: 'Snap-8', category: OLD_CATEGORY },
    select: { id: true, name: true, size: true, slug: true, category: true },
  })

  console.log(`Found ${rows.length} Snap-8 row(s) with category="${OLD_CATEGORY}":`)
  for (const row of rows) {
    console.log(`  ${row.name} ${row.size} (${row.slug}): "${row.category}" -> "${NEW_CATEGORY}"`)
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }

  for (const row of rows) {
    await prisma.product.update({ where: { id: row.id }, data: { category: NEW_CATEGORY } })
    console.log(`  Applied: ${row.id}`)
  }
  console.log('\nDone.')
}

main().finally(() => prisma.$disconnect())
