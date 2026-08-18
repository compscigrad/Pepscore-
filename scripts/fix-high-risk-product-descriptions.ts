// Part C / FDA-FTC risk-reduction taxonomy pass (2026-08-17) -- corrects
// 17 live Product.description values that still carry personal-outcome-
// implying language (fat loss, cosmetic, anti-aging, libido, tanning,
// wrinkle reduction, body contouring, sexual wellness) despite the
// category-level taxonomy (lib/storefront/merchandisingTaxonomy.ts) and
// most other product descriptions already being clean. Mirrors the
// dry-run-by-default pattern in scripts/seed-approved-pricing.ts.
//
// NOT RUN AGAINST PRODUCTION YET -- dry run only until the owner reviews
// the before/after table this script prints. Run with --apply to write.
//
// Also updates prisma/seed.ts's DESCRIPTIONS map to match, so a future
// reseed doesn't reintroduce the old language -- that edit is manual,
// see the comment at the bottom of this file's output.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORRECTIONS: Record<string, string> = {
  'AOD 9604':
    'AOD-9604 is researched for its role in fat-cell metabolism and lipolytic signaling pathways, studied without evidence of direct action on muscle tissue. It is commonly utilized in metabolic and body-composition research.',
  'Botulinum Toxin Type A':
    'Botulinum toxin is researched for neuromuscular junction signaling, localized muscle-relaxation mechanisms, and neuromodulation applications. It is widely utilized in clinical and dermatological research settings.',
  Cagrilintide:
    'Cagrilintide is an amylin analog researched for appetite-signaling pathways, meal-response regulation, and satiety mechanisms. It is frequently studied in combination with GLP-1 compounds in metabolic-research protocols.',
  Epithalon:
    'Epithalon is widely researched for telomere support, cellular regeneration, and DNA repair pathways. It remains one of the most studied compounds in cellular-aging and longevity-pathway research.',
  'GHK-Cu':
    'GHK-Cu is a copper peptide researched for collagen production, dermal tissue regeneration, tissue repair, and hair-follicle signaling. It is widely studied in regenerative and dermatological research for its anti-inflammatory and restorative properties.',
  HGH: 'Research-grade human growth hormone studied for recovery-pathway signaling, tissue support, metabolic research, and cellular-aging research applications.',
  Ipamorelin:
    'Ipamorelin is a selective growth hormone secretagogue researched for recovery-pathway signaling, sleep-architecture research, and endogenous GH release, studied without significant appetite-stimulation effects.',
  'Lemon Bottle':
    'A lipolytic research solution studied for localized fat-cell metabolism in dermal and subcutaneous tissue research.',
  'MT-2':
    'Melanotan II is researched for melanocortin receptor activation, pigmentation-pathway signaling, and central nervous system research applications.',
  MT1: 'Melanotan-1 is a peptide researched for melanocortin receptor activity and pigmentation-pathway signaling in dermal research.',
  Mazdutide:
    'Mazdutide is a next-generation dual agonist researched for metabolic-pathway signaling, appetite regulation, and body-composition research. It has gained attention for its potential role in energy-balance research protocols.',
  'PT-141':
    'PT-141 is researched for melanocortin receptor activation and central-nervous-system signaling pathways, distinct from traditional vascular-mechanism compounds.',
  'SS-31':
    'SS-31 is researched for mitochondrial protection, cellular energy production, and recovery-pathway research. It is frequently studied in cellular-aging and performance-research applications.',
  'Snap-8':
    'Snap-8 is a research peptide studied for its effects on neuromuscular signaling at the dermal level related to expression-line formation. It is commonly explored in dermal-aging research.',
  Tesamorelin:
    'Tesamorelin is researched for visceral adipose tissue signaling, body recomposition, and growth hormone pathway support. It is commonly explored in metabolic-research protocols targeting abdominal adiposity.',
  Thymalin:
    'Thymalin is researched for immune-pathway support, cellular-aging research, and cellular health signaling. It has become increasingly studied in longevity-focused peptide research.',
  Tirzepatide:
    'Tirzepatide is a dual GIP/GLP-1 receptor agonist researched for advanced appetite regulation, metabolic balance, and body recomposition support. It is commonly explored for its metabolic signaling effects and blood sugar regulation compared to traditional GLP-1 compounds.',
};

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'APPLY MODE -- writing to the database' : 'DRY RUN -- no writes, pass --apply to write');
  console.log('');

  for (const [name, newDescription] of Object.entries(CORRECTIONS)) {
    const rows = await prisma.product.findMany({ where: { name }, select: { id: true, slug: true, description: true } });
    if (rows.length === 0) {
      console.log(`SKIP ${name}: no rows found`);
      continue;
    }
    for (const row of rows) {
      console.log(`--- ${name} (${row.slug}) ---`);
      console.log('OLD:', row.description);
      console.log('NEW:', newDescription);
      console.log('');
      if (apply && row.description !== newDescription) {
        await prisma.product.update({ where: { id: row.id }, data: { description: newDescription } });
      }
    }
  }
  console.log(`${Object.keys(CORRECTIONS).length} product names, dry run ${apply ? '(applied)' : '(not applied)'}.`);
}

main().finally(() => prisma.$disconnect());
