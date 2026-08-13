// Customer-facing merchandising taxonomy (owner-directed, 2026-08-12
// homepage revision pass #2, section 26). This is a PRESENTATION layer
// only -- it never touches Product.category (the free-text field the
// admin/pricing/inventory systems key off) or the underlying Product
// rows. A product can legitimately appear under more than one
// merchandising category here without being duplicated in the database
// (section 27).
//
// Membership lists are matched against Product.name exactly, then live-
// filtered to pricingStatus != INACTIVE the same way every other
// storefront query already does -- so listing a currently-inactive
// product's name here (e.g. "Botulinum Toxin", "KLOW") is safe and
// forward-compatible: it simply won't render until the product is
// reactivated, never a broken link or a fabricated entry.
//
// Descriptions are deliberately neutral/RUO-compatible research-context
// language, not the historical shorthand ("fat loss", "libido") the
// owner's own reference taxonomy used -- see section 9's compliance rule.
// These are short category-level descriptors only; they never override or
// contradict the authoritative per-product description shown on a
// product's own detail page.
import type { LucideIcon } from 'lucide-react'
import { Scale, Flame, Dumbbell, Bandage, Hourglass, Brain, ShieldCheck, HeartHandshake, Sparkles, FlaskConical, Layers } from 'lucide-react'

export interface MerchandisingCategory {
  slug: string
  label: string
  description: string
  icon: LucideIcon
  productNames: string[]
}

export const MERCHANDISING_TAXONOMY: MerchandisingCategory[] = [
  {
    slug: 'glp-1-weight-management',
    label: 'GLP-1 / Weight Management Research',
    description: 'Incretin-pathway and amylin-analog compounds studied for metabolic regulation and body-composition research.',
    icon: Scale,
    productNames: ['Semaglutide', 'Tirzepatide', 'Retatrutide', 'Cagrilintide', 'Cagrilintide 2.5mg + Semaglutide 2.5mg', 'Cagrilintide 5mg + Semaglutide 5mg', 'Mazdutide'],
  },
  {
    slug: 'fat-loss-body-recomposition',
    label: 'Fat Loss / Body Recomposition Research',
    description: 'Compounds studied for lipid metabolism and body-composition research applications.',
    icon: Flame,
    productNames: ['Tesamorelin', 'AOD 9604', 'SLU-PP-332'],
  },
  {
    slug: 'growth-hormone-performance',
    label: 'Growth Hormone / Performance Research',
    description: 'Growth-hormone secretagogues and related compounds studied for endocrine and performance research.',
    icon: Dumbbell,
    // Order matters (2026-08-12 merchandising fix): Ipamorelin leads, the
    // CJC-Ipamorelin-without-DAC blend immediately follows it, then the
    // remaining CJC-1295 variants -- see productNamesOrdered in
    // app/categories/[slug]/page.tsx, which sorts the category page by
    // this exact array order rather than database creation date.
    productNames: ['Ipamorelin', 'CJC-1295 without DAC 5mg + Ipamorelin 5mg', 'CJC-1295 No DAC', 'CJC-1295 With DAC', 'Sermorelin Acetate', 'HGH', 'IGF-ILR3', 'IGF-DES', 'GHRP-6 Acetate'],
  },
  {
    slug: 'recovery-injury-research',
    label: 'Recovery / Injury Research',
    description: 'Compounds studied for tissue-repair and recovery-pathway research.',
    icon: Bandage,
    productNames: ['BPC 157', 'TB500', 'BPC10 + TB10', 'BPC5 + TB5', 'GHK-Cu', 'GLOW70', 'KLOW', 'KPV (Lysine-Proline-Valine)', 'LL37', 'MOTS-c', 'Epithalon'],
  },
  {
    slug: 'anti-aging-longevity',
    label: 'Anti-Aging / Longevity Research',
    description: 'Compounds studied for cellular-aging and longevity-pathway research.',
    icon: Hourglass,
    productNames: ['Epithalon', 'Thymalin', 'SS-31', 'Humanin', 'Pinealon', 'NAD+'],
  },
  {
    slug: 'brain-mood-cognitive',
    label: 'Brain / Mood / Cognitive Research',
    description: 'Neuropeptides studied for cognitive and central-nervous-system research.',
    icon: Brain,
    productNames: ['Semax', 'Selank', 'DSIP', 'Pinealon', 'Cerebrolysin (6 vials)'],
  },
  {
    slug: 'immune-cellular-defense',
    label: 'Immune / Cellular Defense Research',
    description: 'Compounds studied for immune-function and cellular-defense research.',
    icon: ShieldCheck,
    productNames: ['Thymosin Alpha-1', 'Thymalin', 'LL37', 'NAD+'],
  },
  {
    slug: 'sexual-health-hormonal',
    label: 'Sexual Health / Hormonal Research',
    description: 'Compounds studied for reproductive-endocrinology and hormonal-signaling research.',
    icon: HeartHandshake,
    productNames: ['PT-141', 'KissPeptin-10', 'HCG', 'HMG', 'Oxytocin'],
  },
  {
    slug: 'skin-hair-cosmetic',
    label: 'Skin / Hair / Cosmetic Research',
    description: 'Compounds studied for dermal and tissue-remodeling research.',
    icon: Sparkles,
    productNames: ['GHK-Cu', 'Snap-8', 'MT-2'],
  },
  {
    slug: 'advanced-specialty-compounds',
    label: 'Advanced / Specialty Compounds',
    description: 'Niche and clinical-research-use compounds for specialized research applications.',
    icon: FlaskConical,
    productNames: ['VIP5', 'VIP10', '5-Amino-1MQ', 'Botulinum Toxin Type A', 'Survodutide', 'EPO 3000IU', 'Ara-290', 'MOTS-c', 'PNC 27'],
  },
  {
    slug: 'blends-stacks',
    label: 'Blends / Stacks',
    description: 'Pre-formulated multi-compound combinations for research convenience.',
    icon: Layers,
    productNames: ['GLOW70', 'GLOW50', 'KLOW', 'BPC 10mg + GHK-Cu 50mg + TB500 10mg', 'Cagrilintide 2.5mg + Semaglutide 2.5mg', 'Cagrilintide 5mg + Semaglutide 5mg'],
  },
]

export function getMerchandisingCategory(slug: string): MerchandisingCategory | undefined {
  return MERCHANDISING_TAXONOMY.find((c) => c.slug === slug)
}

/** Every merchandising category name a given product name belongs to. */
export function categoriesForProductName(name: string): MerchandisingCategory[] {
  return MERCHANDISING_TAXONOMY.filter((c) => c.productNames.includes(name))
}
