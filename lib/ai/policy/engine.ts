// AI-0B.2 -- the centralized policy boundary. runInputPolicyGate/
// runOutputPolicyGate are the entry points a future caller (an AI-0B.4+
// retrieval consumer, eventually an AI-1 route) should actually use --
// evaluateInput/evaluateOutput are the pure decision functions underneath,
// exported for direct testing.
import type { AiProvider } from '../providers/types'
import type { AiRole } from '../permissions/roles'
import { categoryRequiresRole, roleMeetsMinimum } from '../permissions/roles'
import { classifyRequest } from './classify'
import { OUTPUT_VALIDATION_RULES } from './outputRules'
import type { ClassificationResult, PolicyDecision, OutputValidationResult, RequestCategory } from './types'

// Below this, a model-classified result is treated the same as UNKNOWN.
// Owner instruction, item 9: "LOW-CONFIDENCE / UNKNOWN input classification
// must not default to ALLOW... Use: UNKNOWN / insufficient confidence ->
// ESCALATE."
const ESCALATE_CONFIDENCE_THRESHOLD = 0.7

// Categories that are always refused regardless of role or confidence --
// no role can unlock a HUMAN_USE/JAILBREAK/PROMPT_INJECTION request. A
// disclaimer after generating an answer is never an acceptable substitute
// for refusing before generation (owner instruction, prior scope review
// section 3).
const ALWAYS_REFUSE: RequestCategory[] = ['HUMAN_USE', 'JAILBREAK', 'PROMPT_INJECTION']

export function evaluateInput(classification: ClassificationResult, role: AiRole): PolicyDecision {
  if (classification.category === 'UNKNOWN' || classification.confidence < ESCALATE_CONFIDENCE_THRESHOLD) {
    return { action: 'ESCALATE', category: classification.category, reason: 'Low-confidence or unresolved classification' }
  }

  if (ALWAYS_REFUSE.includes(classification.category)) {
    return { action: 'REFUSE', category: classification.category, reason: `${classification.category} is an always-refused category` }
  }

  const requiredRole = categoryRequiresRole(classification.category)
  if (requiredRole && !roleMeetsMinimum(role, requiredRole)) {
    return { action: 'REFUSE', category: classification.category, reason: `Role "${role}" does not meet the required "${requiredRole}" for ${classification.category}` }
  }

  return { action: 'ALLOW', category: classification.category, reason: 'Category permitted for role' }
}

export function evaluateOutput(text: string): OutputValidationResult {
  for (const rule of OUTPUT_VALIDATION_RULES) {
    if (rule.pattern.test(text)) {
      return { action: rule.action, reason: rule.description, flaggedTerms: [rule.description] }
    }
  }
  return { action: 'PASS', reason: 'No prohibited output patterns detected' }
}

export interface InputGateResult {
  classification: ClassificationResult
  decision: PolicyDecision
}

// Fail-closed entry point (owner instruction, item 8): ANY unexpected
// failure anywhere in classification or evaluation becomes ESCALATE, never
// a silent ALLOW. classifyRequest() and evaluateInput() are already
// designed not to throw for valid input, but this wrapper is the single,
// auditable guarantee callers actually depend on -- defense in depth, not
// a redundant no-op.
export async function runInputPolicyGate(text: string, role: AiRole, modelProvider?: AiProvider | null): Promise<InputGateResult> {
  try {
    const classification = await classifyRequest(text, modelProvider)
    const decision = evaluateInput(classification, role)
    return { classification, decision }
  } catch (err) {
    return {
      classification: { category: 'UNKNOWN', confidence: 0, method: 'fallback' },
      decision: { action: 'ESCALATE', category: 'UNKNOWN', reason: `Policy gate failure: ${err instanceof Error ? err.message : 'unknown error'}` },
    }
  }
}

export function runOutputPolicyGate(text: string): OutputValidationResult {
  try {
    return evaluateOutput(text)
  } catch (err) {
    return { action: 'ESCALATE', reason: `Output validation gate failure: ${err instanceof Error ? err.message : 'unknown error'}` }
  }
}
