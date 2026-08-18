// AI-1.3 -- structured compound comparison, one of the owner-approved
// "Pepscore Intelligence" capabilities ("Compare the research
// classifications of MOTS-c and NAD+"). Deliberately built as pure
// retrieval + policy enforcement, NOT free-text LLM generation -- no
// approved model route exists yet (lib/ai/providers/modelRoutes.ts is
// empty), so this is the part of the customer experience that's
// genuinely real, safe, and deployable today, not blocked on a live
// model.
//
// Free-text natural-language question answering (parsing "what should I
// compare" out of an arbitrary sentence) requires a real LLM and stays
// BLOCKED -- OWNER CREDENTIAL REQUIRED. This module expects explicit,
// structured input (product names), matching how a UI would call it via
// distinct controls, not a single text box pretending to understand
// intent nothing here can actually parse yet.
import { prisma } from '@/lib/prisma'
import { categoriesForProductName } from '@/lib/storefront/merchandisingTaxonomy'
import { runInputPolicyGate } from '../policy/engine'
import type { AiRole } from '../permissions/roles'
import type { AiProvider } from '../providers/types'
import { toCitation, type Citation } from '../citations/citation'

export interface CompoundComparisonEntry {
  productName: string
  found: boolean
  rawCategory: string | null
  researchCategories: { slug: string; label: string }[]
  description: string | null
  citation: Citation | null
}

export interface CompoundComparisonResult {
  status: 'ALLOWED' | 'REFUSED' | 'ESCALATED'
  reason?: string
  entries: CompoundComparisonEntry[]
}

interface ProductRow {
  id: string
  name: string
  category: string
  description: string
}

// Pure -- builds comparison entries from already-fetched product rows.
// Split out from the DB fetch so this is directly unit-testable without a
// database (matches lib/analytics/productEngagementInsights.ts's
// established split pattern in this repo).
export function buildComparisonEntries(productNames: string[], products: ProductRow[]): CompoundComparisonEntry[] {
  const byName = new Map(products.map((p) => [p.name, p]))

  return productNames.map((name) => {
    const product = byName.get(name)
    if (!product) {
      return { productName: name, found: false, rawCategory: null, researchCategories: [], description: null, citation: null }
    }
    const researchCategories = categoriesForProductName(name).map((c) => ({ slug: c.slug, label: c.label }))
    const citation = toCitation({
      sourceId: product.id,
      title: product.name,
      sourceType: 'catalog_product',
      tier: 1,
      retrievalScore: 1,
      citationLabel: `Pepscore Catalog: ${product.name}`,
      content: product.description,
    })
    return { productName: name, found: true, rawCategory: product.category, researchCategories, description: product.description, citation }
  })
}

// Reconstructs a representative request string so the existing
// HUMAN_USE/JAILBREAK rule set still applies to a structured comparison
// call, not just free text -- a caller passing a personalIntentNote (a UI
// element capturing e.g. "...and tell me which is better for me") must
// still be refused, not silently allowed because the product names alone
// look like an innocuous RESEARCH request.
export function buildPolicyCheckText(productNames: string[], personalIntentNote?: string): string {
  const base = `Compare the research classifications of ${productNames.join(' and ')}.`
  return personalIntentNote ? `${base} ${personalIntentNote}` : base
}

export interface CompareCompoundsOptions {
  personalIntentNote?: string
  classifierProvider?: AiProvider | null
}

export async function compareCompounds(
  productNames: string[],
  role: AiRole,
  options: CompareCompoundsOptions = {}
): Promise<CompoundComparisonResult> {
  if (productNames.length < 2) {
    return { status: 'REFUSED', reason: 'At least two product names are required for a comparison.', entries: [] }
  }

  const policyText = buildPolicyCheckText(productNames, options.personalIntentNote)
  const { decision } = await runInputPolicyGate(policyText, role, options.classifierProvider)
  if (decision.action !== 'ALLOW') {
    return { status: decision.action === 'REFUSE' ? 'REFUSED' : 'ESCALATED', reason: decision.reason, entries: [] }
  }

  const products = await prisma.product.findMany({
    where: { name: { in: productNames }, pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, category: true, description: true },
    distinct: ['name'],
  })

  return { status: 'ALLOWED', entries: buildComparisonEntries(productNames, products) }
}
