// AI-1.3 -- "Show compounds associated with mitochondrial research" /
// "What products are categorized under cellular aging research?" --
// structured, retrieval-only category discovery. See
// compoundComparison.ts's header for why this is pure retrieval, not
// free-text LLM generation.
import { prisma } from '@/lib/prisma'
import { getMerchandisingCategory } from '@/lib/storefront/merchandisingTaxonomy'
import { runInputPolicyGate } from '../policy/engine'
import type { AiRole } from '../permissions/roles'
import type { AiProvider } from '../providers/types'
import { toCitation, type Citation } from '../citations/citation'

export interface CategoryDiscoveryEntry {
  productName: string
  citation: Citation
}

export interface CategoryDiscoveryResult {
  status: 'ALLOWED' | 'REFUSED' | 'ESCALATED' | 'NOT_FOUND'
  reason?: string
  categoryLabel?: string
  categoryDescription?: string
  entries: CategoryDiscoveryEntry[]
}

interface ProductRow {
  id: string
  name: string
  description: string
}

// Pure -- builds discovery entries from already-fetched product rows.
export function buildDiscoveryEntries(products: ProductRow[]): CategoryDiscoveryEntry[] {
  return products.map((p) => ({
    productName: p.name,
    citation: toCitation({
      sourceId: p.id,
      title: p.name,
      sourceType: 'catalog_product',
      tier: 1,
      retrievalScore: 1,
      citationLabel: `Pepscore Catalog: ${p.name}`,
      content: p.description,
    }),
  }))
}

export async function discoverByCategory(
  categorySlug: string,
  role: AiRole,
  options: { classifierProvider?: AiProvider | null } = {}
): Promise<CategoryDiscoveryResult> {
  const category = getMerchandisingCategory(categorySlug)
  if (!category) {
    return { status: 'NOT_FOUND', reason: `No research category matches "${categorySlug}".`, entries: [] }
  }

  const policyText = `What products are categorized under ${category.label}?`
  const { decision } = await runInputPolicyGate(policyText, role, options.classifierProvider)
  if (decision.action !== 'ALLOW') {
    return { status: decision.action === 'REFUSE' ? 'REFUSED' : 'ESCALATED', reason: decision.reason, entries: [] }
  }

  const products = await prisma.product.findMany({
    where: { name: { in: category.productNames }, pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, description: true },
    distinct: ['name'],
  })

  return { status: 'ALLOWED', categoryLabel: category.label, categoryDescription: category.description, entries: buildDiscoveryEntries(products) }
}
