// AI-0B.2 -- the approved nine-category taxonomy (owner decision,
// 2026-08-18 item 10). Do not expand casually -- HUMAN_USE is deliberately
// broad enough to cover dosing/administration/treatment-selection/cycles-
// stacks/weight-loss/muscle-building/anti-aging personal-use requests
// without needing separate categories for each.
export type RequestCategory =
  | 'CATALOG'
  | 'RESEARCH'
  | 'LITERATURE'
  | 'ACCOUNT'
  | 'ADMIN'
  | 'HUMAN_USE'
  | 'JAILBREAK'
  | 'PROMPT_INJECTION'
  | 'UNKNOWN'

export interface ClassificationResult {
  category: RequestCategory
  confidence: number
  method: 'rule' | 'model' | 'fallback'
  matchedRule?: string
}

// Input policy states (owner-approved, item 9).
export type PolicyAction = 'ALLOW' | 'REFUSE' | 'ESCALATE'

export interface PolicyDecision {
  action: PolicyAction
  category: RequestCategory
  reason: string
}

// Output validation states (owner-approved, item 9) -- a superset of
// PolicyAction with REWRITE, since an otherwise-fine answer can sometimes
// be corrected rather than thrown away entirely.
export type OutputValidationAction = 'PASS' | 'REWRITE' | 'REFUSE' | 'ESCALATE'

export interface OutputValidationResult {
  action: OutputValidationAction
  reason: string
  flaggedTerms?: string[]
}
