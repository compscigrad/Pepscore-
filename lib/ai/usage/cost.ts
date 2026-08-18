// AI-0B.5 -- a placeholder, deliberately conservative per-token cost
// estimate, only precise enough for the budget-check mechanism (Section
// 11/19) to be meaningfully exercisable in tests. NOT real production
// pricing -- once a real approved model route exists (lib/ai/providers/
// modelRoutes.ts), this must be replaced with that model's actual
// published rate. Owner instruction: "Do not define public-production
// budgets yet."
const PLACEHOLDER_CENTS_PER_1K_TOKENS = 1

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const totalTokens = inputTokens + outputTokens
  return Math.ceil((totalTokens / 1000) * PLACEHOLDER_CENTS_PER_1K_TOKENS)
}
