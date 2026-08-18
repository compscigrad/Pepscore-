// AI-0B.4/9 -- retrieved content is DATA, never instructions (owner
// instruction, item 15: it must not be allowed to override system policy,
// modify permissions, request tool execution, expose secrets, change
// role, or disable safety checks). This scans retrieved source content
// BEFORE it's allowed into a generation context -- reusing the same
// JAILBREAK/PROMPT_INJECTION rule patterns lib/ai/policy/rules.ts already
// applies to user input, applied here to retrieved documents instead
// (retrieval poisoning / injection-in-retrieved-text defense).
import { RULE_GROUPS } from '../policy/rules'

export interface SanitizationResult {
  safe: boolean
  flaggedPatterns: string[]
  sanitizedContent: string
}

export function sanitizeRetrievedContent(content: string): SanitizationResult {
  const flagged: string[] = []
  for (const group of RULE_GROUPS) {
    for (const rule of group) {
      if ((rule.category === 'JAILBREAK' || rule.category === 'PROMPT_INJECTION') && rule.pattern.test(content)) {
        flagged.push(rule.description)
      }
    }
  }

  return {
    safe: flagged.length === 0,
    flaggedPatterns: flagged,
    // Explicit delimiters mark this as untrusted reference data for any
    // downstream prompt-construction step -- the wrapping itself doesn't
    // neutralize an injection attempt; `safe` is what decides whether this
    // content is used at all.
    sanitizedContent: `[RETRIEVED_DATA_START]\n${content}\n[RETRIEVED_DATA_END]`,
  }
}
