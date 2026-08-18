// AI-1.6 -- single-compound research-area explainer, the third owner-
// approved structured "Pepscore Intelligence" capability ("explain the
// research areas associated with this compound"). Reuses
// compoundComparison.ts's buildComparisonEntries (already produces
// researchCategories/description/citation per product) for a single
// name -- deliberately not duplicated logic, just a different entry
// point and policy-check text.
//
// Same posture as compoundComparison.ts / categoryDiscovery.ts: pure
// retrieval + policy enforcement, no LLM generation, because no approved
// model route exists yet (lib/ai/providers/modelRoutes.ts is empty).
// Free-text natural-language explanation ("tell me about this peptide")
// stays BLOCKED -- OWNER CREDENTIAL REQUIRED.
import { prisma } from '@/lib/prisma'
import { runInputPolicyGate } from '../policy/engine'
import type { AiRole } from '../permissions/roles'
import type { AiProvider } from '../providers/types'
import { buildComparisonEntries, type CompoundComparisonEntry } from './compoundComparison'

export interface CompoundExplainerResult {
  status: 'ALLOWED' | 'REFUSED' | 'ESCALATED'
  reason?: string
  entry: CompoundComparisonEntry | null
}

// Reconstructs a representative request string so the existing
// HUMAN_USE/JAILBREAK rule set still applies -- a caller passing a
// personalIntentNote must still be refused, not silently allowed because
// the product name alone looks like an innocuous CATALOG request. Mirrors
// compoundComparison.ts's buildPolicyCheckText exactly.
export function buildPolicyCheckText(productName: string, personalIntentNote?: string): string {
  const base = `Explain the research areas associated with ${productName}.`
  return personalIntentNote ? `${base} ${personalIntentNote}` : base
}

export interface ExplainCompoundOptions {
  personalIntentNote?: string
  classifierProvider?: AiProvider | null
}

export async function explainCompound(
  productName: string,
  role: AiRole,
  options: ExplainCompoundOptions = {}
): Promise<CompoundExplainerResult> {
  if (!productName.trim()) {
    return { status: 'REFUSED', reason: 'A product name is required.', entry: null }
  }

  const policyText = buildPolicyCheckText(productName, options.personalIntentNote)
  const { decision } = await runInputPolicyGate(policyText, role, options.classifierProvider)
  if (decision.action !== 'ALLOW') {
    return { status: decision.action === 'REFUSE' ? 'REFUSED' : 'ESCALATED', reason: decision.reason, entry: null }
  }

  const products = await prisma.product.findMany({
    where: { name: productName, pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, category: true, description: true },
    distinct: ['name'],
  })

  const [entry] = buildComparisonEntries([productName], products)
  return { status: 'ALLOWED', entry }
}
