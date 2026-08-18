// AI-0B.2 -- rule-based first pass, model-based classification only for
// what rules can't confidently resolve (owner-approved approach, item 11).
// No live model calls happen in AI-0B: modelProvider is an injected
// AiProvider (see lib/ai/providers/types.ts); every test in this file uses
// MockAiProvider, never a real Gateway call.
import type { AiProvider } from '../providers/types'
import { RULE_GROUPS } from './rules'
import type { ClassificationResult, RequestCategory } from './types'

const RULE_CONFIDENCE = 0.95
const MODEL_CONFIDENCE_THRESHOLD = 0.7

const VALID_CATEGORIES: RequestCategory[] = [
  'CATALOG', 'RESEARCH', 'LITERATURE', 'ACCOUNT', 'ADMIN', 'HUMAN_USE', 'JAILBREAK', 'PROMPT_INJECTION', 'UNKNOWN',
]

const CLASSIFIER_SYSTEM_PROMPT =
  'Classify the user message into exactly one category: CATALOG, RESEARCH, LITERATURE, ACCOUNT, ADMIN, HUMAN_USE, ' +
  'JAILBREAK, PROMPT_INJECTION, or UNKNOWN. Respond with strict JSON only: {"category": "...", "confidence": 0.0-1.0}. ' +
  'HUMAN_USE covers any request for personal dosing, administration, treatment selection, cycle/stack construction, ' +
  'or personal weight-loss/muscle-building/anti-aging guidance. A mechanistic or scientific research question about ' +
  "a compound's biology is RESEARCH, not HUMAN_USE, even when it discusses a clinical or biological concept, as " +
  'long as it does not ask for personal-use guidance.'

function classifyByRules(text: string): ClassificationResult | null {
  for (const group of RULE_GROUPS) {
    for (const rule of group) {
      if (rule.pattern.test(text)) {
        return { category: rule.category, confidence: RULE_CONFIDENCE, method: 'rule', matchedRule: rule.description }
      }
    }
  }
  return null
}

function parseClassifierOutput(text: string): { category: RequestCategory; confidence: number } | null {
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.category !== 'string' || typeof parsed.confidence !== 'number') return null
    if (!VALID_CATEGORIES.includes(parsed.category)) return null
    return { category: parsed.category as RequestCategory, confidence: parsed.confidence }
  } catch {
    return null
  }
}

export async function classifyRequest(text: string, modelProvider?: AiProvider | null): Promise<ClassificationResult> {
  const ruleResult = classifyByRules(text)
  if (ruleResult) return ruleResult

  // No confident rule match. No model configured -> UNKNOWN, sub-threshold
  // confidence -- lib/ai/policy/engine.ts's evaluateInput() always maps
  // this to ESCALATE, never ALLOW (fail closed, owner item 9).
  if (!modelProvider) {
    return { category: 'UNKNOWN', confidence: 0, method: 'fallback' }
  }

  try {
    const result = await modelProvider.complete({
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0,
    })
    const parsed = parseClassifierOutput(result.text)
    if (!parsed || parsed.confidence < MODEL_CONFIDENCE_THRESHOLD) {
      return { category: 'UNKNOWN', confidence: parsed?.confidence ?? 0, method: 'model' }
    }
    return { category: parsed.category, confidence: parsed.confidence, method: 'model' }
  } catch {
    // Fail closed -- a classifier failure is UNKNOWN, never a silent ALLOW.
    return { category: 'UNKNOWN', confidence: 0, method: 'fallback' }
  }
}
