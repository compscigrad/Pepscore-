// Seed script: populates the Product table with Pepscore's catalog
// Run: npm run db:seed

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const products = [
  {
    slug: 'semaglutide-30mg',
    name: 'Semaglutide',
    category: 'GLP-1 Agonist',
    size: '30mg',
    price: 125,
    bulkPrice5: 575,
    bulkPrice10: 1150,
    description: 'GLP-1 receptor agonist studied for metabolic regulation, glucose homeostasis, and appetite suppression research.',
    imageUrl: '/images/Semaglutide.png',
    badge: 'Popular',
    costOfGoods: 45,
  },
  {
    slug: 'tirzepatide-60mg',
    name: 'Tirzepatide',
    category: 'Dual GIP/GLP-1',
    size: '60mg',
    price: 190,
    bulkPrice5: 900,
    bulkPrice10: 1800,
    description: 'Dual GIP/GLP-1 receptor agonist studied for superior metabolic outcomes and cardiometabolic research applications.',
    imageUrl: '/images/Tirzepatide.png',
    badge: 'Best Seller',
    costOfGoods: 70,
  },
  {
    slug: 'retatrutide-60mg',
    name: 'Retatrutide',
    category: 'Triple Agonist',
    size: '60mg',
    price: 200,
    bulkPrice5: 950,
    bulkPrice10: 1900,
    description: 'Triple receptor agonist (GIP/GLP-1/Glucagon) — the next generation of metabolic research compounds.',
    imageUrl: '/images/Retatrutide.png',
    badge: 'New',
    costOfGoods: 80,
  },
  {
    slug: 'nad-plus-500mg',
    name: 'NAD+',
    category: 'Coenzyme',
    size: '500mg',
    price: 56,
    bulkPrice5: 230,
    bulkPrice10: 460,
    description: 'Essential coenzyme precursor critical for cellular energy metabolism, DNA repair, and longevity pathway research.',
    imageUrl: '/images/nad.png',
    badge: null,
    costOfGoods: 18,
  },
  {
    slug: 'epithalon-50mg',
    name: 'Epithalon',
    category: 'Longevity Peptide',
    size: '50mg',
    price: 35,
    bulkPrice5: 150,
    bulkPrice10: 280,
    description: 'Tetrapeptide studied for telomerase activation, circadian regulation, and anti-aging biological processes.',
    imageUrl: '/images/epithalon.png',
    badge: null,
    costOfGoods: 12,
  },
  {
    slug: 'cjc1295-ipamorelin-10mg',
    name: 'CJC-1295 / Ipamorelin',
    category: 'GH Secretagogue',
    size: '10mg',
    price: 50,
    bulkPrice5: 225,
    bulkPrice10: 425,
    description: 'Synergistic GHRH analog and selective ghrelin mimetic combination for growth hormone secretion research.',
    imageUrl: '/images/cjc1295.png',
    badge: null,
    costOfGoods: 16,
  },
  {
    slug: 'kisspeptin-10-10mg',
    name: 'Kisspeptin-10',
    category: 'Reproductive Peptide',
    size: '10mg',
    price: 35,
    bulkPrice5: 150,
    bulkPrice10: 280,
    description: 'Hypothalamic neuropeptide studied for reproductive endocrinology, LH/FSH regulation, and fertility research.',
    imageUrl: '/images/kisspeptin.png',
    badge: null,
    costOfGoods: 12,
  },
  {
    slug: 'ghk-cu-100mg',
    name: 'GHK-Cu',
    category: 'Copper Peptide',
    size: '100mg',
    price: 35,
    bulkPrice5: 150,
    bulkPrice10: 280,
    description: 'Copper-binding tripeptide widely researched for tissue remodeling, wound healing, and dermal regeneration.',
    imageUrl: '/images/ghk-cu.png',
    badge: null,
    costOfGoods: 10,
  },
  {
    slug: 'pt-141-10mg',
    name: 'PT-141',
    category: 'Melanocortin Peptide',
    size: '10mg',
    price: 24,
    bulkPrice5: 100,
    bulkPrice10: 170,
    description: 'Melanocortin receptor agonist studied for central nervous system signaling and neuromodulation research.',
    imageUrl: '/images/ghk-cu.png',
    badge: null,
    costOfGoods: 8,
  },
]

async function main() {
  console.log('Seeding products...')
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    })
    console.log(`  ✓ ${p.name}`)
  }
  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
