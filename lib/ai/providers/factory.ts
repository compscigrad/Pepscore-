// AI-1.11 -- closes another gap found in this session's roadmap
// reconciliation: AiGatewayProvider (the real provider) and ProviderRouter
// (primary->fallback orchestration) were both built and independently
// tested, but nothing anywhere ever constructed a router from actual
// AiConfig. Nothing calls this today -- no route needs live generation yet
// -- but it's the real wiring for when one does, not a stub.
//
// Returns null whenever a real router genuinely can't be built -- live-
// model calls disabled, no gateway credential, or no approved/ZDR-verified
// route for the configured primary model -- so a caller can check "is
// there something to call" with one function instead of duplicating this
// four-way check. A caller must still treat null as "AI unavailable," not
// retry or degrade to an unsafe default.
//
// AI-1.15 -- gates on liveModelEnabled, NOT featureEnabled. This is the
// actual owner kill switch for real provider calls (admin live-test route
// included) -- independent of whether the public customer route is open.
// See config.ts's header for the full two-flag rationale.
import { AiGatewayProvider } from './gateway'
import { ProviderRouter } from './router'
import { isRouteApproved } from './modelRoutes'
import type { AiConfig } from './config'

export function buildProviderRouterFromConfig(config: AiConfig): ProviderRouter | null {
  if (!config.liveModelEnabled) return null
  if (!config.gatewayApiKey) return null
  if (!config.primaryModel || !isRouteApproved(config.primaryModel)) return null

  const primary = new AiGatewayProvider(config)
  const fallback =
    config.fallbackModel && isRouteApproved(config.fallbackModel)
      ? new AiGatewayProvider(config, fetch, config.fallbackModel)
      : null

  return new ProviderRouter(primary, fallback)
}
