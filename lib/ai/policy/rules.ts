// AI-0B.2 -- deterministic first-pass classification rules. Checked before
// any model call (owner instruction, item 11: "Do not call a paid
// classifier for obviously prohibited requests that can be deterministically
// identified"). Order matters: safety-critical categories are checked
// first, so a jailbreak phrased as an innocuous-looking catalog question is
// still caught by the earlier group.
import type { RequestCategory } from './types'

export interface Rule {
  category: RequestCategory
  pattern: RegExp
  description: string
}

const JAILBREAK_RULES: Rule[] = [
  { category: 'JAILBREAK', pattern: /ignore (all|any|your|the) (previous|prior|above) instructions?/i, description: 'instruction override attempt' },
  { category: 'JAILBREAK', pattern: /\b(DAN|do anything now)\b/i, description: 'named jailbreak persona' },
  { category: 'JAILBREAK', pattern: /pretend (you|that you) (are|have) no (restrictions|rules|limits)/i, description: 'restriction-removal roleplay' },
  { category: 'JAILBREAK', pattern: /act as (an? )?(ai|assistant) (with no|without any) (restrictions|filters|rules)/i, description: 'unrestricted-persona roleplay' },
  { category: 'JAILBREAK', pattern: /you are not (bound|restricted|limited) by/i, description: 'restriction-denial framing' },
  { category: 'JAILBREAK', pattern: /pretend (i am|i'm) a (researcher|doctor|physician|veterinarian)/i, description: 'credential-roleplay bypass attempt' },
]

const PROMPT_INJECTION_RULES: Rule[] = [
  { category: 'PROMPT_INJECTION', pattern: /reveal (your|the) system prompt/i, description: 'system prompt extraction' },
  { category: 'PROMPT_INJECTION', pattern: /print (your|the) (instructions|rules|prompt)/i, description: 'instruction extraction' },
  { category: 'PROMPT_INJECTION', pattern: /disregard (the )?(above|prior|previous) (context|text|instructions)/i, description: 'context override' },
  { category: 'PROMPT_INJECTION', pattern: /what (are|were) you (told|instructed) (to do|not to do)/i, description: 'instruction probing' },
]

// Personal-pronoun + dosing/administration/treatment-selection phrasing --
// deliberately narrow so a mechanistic research question ("how does X
// affect insulin sensitivity in rodent models") does not false-positive
// into HUMAN_USE merely for discussing a biological/clinical concept.
const HUMAN_USE_RULES: Rule[] = [
  { category: 'HUMAN_USE', pattern: /\b(what|how much|how many (mg|milligrams|units)?)\b.{0,30}\bshould\s+i\s+(take|inject|use|dose)/i, description: 'personal dosing question' },
  { category: 'HUMAN_USE', pattern: /\bmy (dose|dosage|cycle|stack)\b/i, description: 'personal dose/cycle reference' },
  // 2026-08-18 live-verification fix: the original pattern required "a"
  // directly followed by "cycle"/"stack" ("build me a cycle") and missed
  // the far more common real-world phrasing with a qualifier in between
  // ("build me a peptide cycle") -- confirmed by tracing the exact live
  // test failure, not guessed. `(\w+\s+){0,2}` allows up to two qualifier
  // words ("a peptide cycle", "a custom research stack") while still
  // requiring the "verb + a + ... + cycle/stack/protocol/regimen"
  // structure, so it doesn't fire on a bare mention of "cycle" in an
  // unrelated scientific sentence (e.g. "the cell cycle").
  { category: 'HUMAN_USE', pattern: /\b(build|make|create|design)\s+(me\s+)?a\s+(\w+\s+){0,2}(cycle|stack|protocol|regimen)\b/i, description: 'personal cycle/stack/protocol construction' },
  { category: 'HUMAN_USE', pattern: /\b(cycle|stack|protocol|regimen)\s+for\s+me\b/i, description: 'personal cycle/stack/protocol/regimen request' },
  { category: 'HUMAN_USE', pattern: /\bhelp me (lose weight|build muscle|get lean|slow aging|look younger)\b/i, description: 'personal outcome request' },
  { category: 'HUMAN_USE', pattern: /\bshould i (take|inject|use)\b/i, description: 'personal use recommendation request' },
  { category: 'HUMAN_USE', pattern: /\bwhat should i take\b/i, description: 'disguised dosing request' },
  { category: 'HUMAN_USE', pattern: /\b(i am|i'm|i weigh)\s+\d+\s*(lb|lbs|pounds|kg)\b.{0,40}\b(dose|take|inject)/i, description: 'weight-based personal dosing' },
]

const ADMIN_RULES: Rule[] = [
  { category: 'ADMIN', pattern: /\b(inventory (count|levels)|all customers|customer list|database (query|dump)|admin dashboard)\b/i, description: 'admin/business-data request' },
]

const ACCOUNT_RULES: Rule[] = [
  { category: 'ACCOUNT', pattern: /\bmy (order|account|invoice|shipment|tracking)\b/i, description: 'own-account reference' },
]

const CATALOG_RULES: Rule[] = [
  { category: 'CATALOG', pattern: /\b(do you sell|price of|in stock|catalog|available sizes?)\b/i, description: 'catalog/product query' },
  // AI-1.3 structured-intelligence request shapes (lib/ai/intelligence/) --
  // these are system-generated from explicit, structured input (product
  // names / a category slug), not arbitrary free text, but still run
  // through the same policy gate as everything else rather than being
  // special-cased around it. Matches exactly the text
  // compoundComparison.ts/categoryDiscovery.ts construct.
  { category: 'CATALOG', pattern: /\bcompare the research classifications? of\b/i, description: 'structured compound comparison request' },
  { category: 'CATALOG', pattern: /\bwhat products are categorized under\b/i, description: 'structured category discovery request' },
  { category: 'CATALOG', pattern: /\bexplain the research areas associated with\b/i, description: 'structured compound research-area explainer request' },
  // 2026-08-18 live-verification fix: "Explain the research classification
  // of Semaglutide." (the exact synthetic ALLOWED test prompt) matched
  // none of the three rules above -- each covers a different fixed
  // phrase, and none of them is "research classification(s) of X". Rather
  // than special-case that one sentence, generalized to the actual
  // pattern family the owner asked for: any free-text question asking for
  // a compound's research classification/category, not just this app's
  // own system-generated request shapes.
  { category: 'CATALOG', pattern: /\bresearch classifications? (of|for)\b/i, description: 'free-text research-classification question' },
  { category: 'CATALOG', pattern: /\bresearch categor(y|ies) (of|for)\b/i, description: 'free-text research-category question' },
  { category: 'CATALOG', pattern: /\bwhat research categor(y|ies) is\b/i, description: 'free-text "what research category is X" question' },
]

const LITERATURE_RULES: Rule[] = [
  { category: 'LITERATURE', pattern: /\b(study|clinical trial|publication|journal article|peer.reviewed)\b/i, description: 'literature reference' },
]

export const RULE_GROUPS: Rule[][] = [
  JAILBREAK_RULES,
  PROMPT_INJECTION_RULES,
  HUMAN_USE_RULES,
  ADMIN_RULES,
  ACCOUNT_RULES,
  CATALOG_RULES,
  LITERATURE_RULES,
]
