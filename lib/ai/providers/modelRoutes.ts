// AI-0B.1 -- per-model data-retention verification, required by the owner
// (2026-08-18 AI-0B architecture approval, item 2): "AI Gateway" is not a
// blanket zero-data-retention guarantee across every provider/model route
// it can reach. Each model this app is actually allowed to send Pepscore
// data to must be individually verified and recorded here BEFORE
// lib/ai/providers/gateway.ts is allowed to route real requests to it --
// see isRouteApproved(), enforced in code, not just documented.
//
// Was empty during AI-0B/AI-1 foundation: no production model route had
// been verified yet, and no live model calls were being made (owner
// instruction, item 22). Adding a row here is a real compliance action,
// not a config convenience -- it must reflect an actual verification, with
// a real dateVerified, not a placeholder.
export interface ModelRoute {
  model: string
  providerRoute: string
  zdrEligible: boolean
  dataPolicyVerified: boolean
  dateVerified: string | null
  notes: string
}

// AI-1.12 -- the first two real entries, added once a live-model-
// integration phase was authorized. Verified against
// https://vercel.com/docs/ai-gateway/security-and-compliance/zdr (accessed
// 2026-08-18): "AI Gateway has agreements in place to offer ZDR with
// specific providers" including Anthropic and Google, with one explicit,
// named exception (anthropic/claude-fable-5, excluded for cumulative-abuse
// detection reasons) -- neither model below is that exception.
//
// This static table is defense-in-depth, not the sole enforcement: every
// live request additionally sets providerOptions.gateway.
// zeroDataRetention=true (lib/ai/providers/gateway.ts), which Vercel
// enforces server-side per-request regardless of what this table claims --
// a request only routes to a currently-confirmed-ZDR provider or fails
// closed with a 400, never silently falls back to an unverified one.
//
// Primary and fallback are deliberately different underlying providers
// (Anthropic vs Google), not just different model IDs from the same
// vendor, so a single provider's outage can't take down both.
export const MODEL_ROUTES: ModelRoute[] = [
  {
    model: 'anthropic/claude-haiku-4.5',
    providerRoute: 'anthropic',
    zdrEligible: true,
    dataPolicyVerified: true,
    dateVerified: '2026-08-18',
    notes:
      'Primary. Strong instruction-following/classification at low cost ($1/$5 per M input/output tokens per the ' +
      'AI Gateway /v1/models catalog, accessed 2026-08-18). Not the claude-fable-5 ZDR exception.',
  },
  {
    model: 'google/gemini-3.1-flash-lite',
    providerRoute: 'google',
    zdrEligible: true,
    dataPolicyVerified: true,
    dateVerified: '2026-08-18',
    notes:
      'Fallback. Genuinely distinct provider from primary (Google, not Anthropic). Very low cost ($0.25/$1.5 per M ' +
      'input/output tokens per the AI Gateway /v1/models catalog, accessed 2026-08-18), 1M-token context.',
  },
]

export function isRouteApproved(model: string): boolean {
  const route = MODEL_ROUTES.find((r) => r.model === model)
  return !!route && route.zdrEligible && route.dataPolicyVerified && route.dateVerified !== null
}
