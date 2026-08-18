// AI-0B.1 -- per-model data-retention verification, required by the owner
// (2026-08-18 AI-0B architecture approval, item 2): "AI Gateway" is not a
// blanket zero-data-retention guarantee across every provider/model route
// it can reach. Each model this app is actually allowed to send Pepscore
// data to must be individually verified and recorded here BEFORE
// lib/ai/providers/gateway.ts is allowed to route real requests to it --
// see isRouteApproved(), enforced in code, not just documented.
//
// Deliberately empty during AI-0B foundation: no production model route has
// been verified yet, and no live model calls are being made (owner
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

export const MODEL_ROUTES: ModelRoute[] = []

export function isRouteApproved(model: string): boolean {
  const route = MODEL_ROUTES.find((r) => r.model === model)
  return !!route && route.zdrEligible && route.dataPolicyVerified && route.dateVerified !== null
}
