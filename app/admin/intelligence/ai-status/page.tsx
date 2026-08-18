// Admin AI Control Panel (AI-1.4, review action added AI-1.9) -- the
// operational-readiness surface for Pepscore Intelligence: feature-flag
// state, provider/model configuration presence (booleans only, never
// secret values), usage/cost, safety/compliance activity, and the Tier 2/3
// corpus size. Everything except the Safety Review Queue's "Mark
// Reviewed" action is read-only plain aggregation, matching the sibling
// search/product intelligence pages' convention -- no AI-generated
// summary here either.
//
// This is deliberately separate from @vercel/analytics-backed marketing
// analytics (owner instruction: keep AI compliance data separate from
// advertising analytics) -- everything on this page is sourced from
// AiUsageEvent / AiComplianceEvent / env config / in-code fixtures only.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  buildConfigStatus,
  getUsageSummary,
  getComplianceSummary,
  getReviewQueue,
} from '@/lib/ai/observability/adminSummary'
import { MarkReviewedButton } from '@/components/admin/MarkReviewedButton'

const WINDOW_DAYS = 30

function StatusPill({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${
        ok ? 'bg-gold/15 text-gold' : 'bg-white/10 text-white/50'
      }`}
    >
      {ok ? onLabel : offLabel}
    </span>
  )
}

export default async function AiStatusPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const [config, usage, compliance, reviewQueue] = await Promise.all([
    Promise.resolve(buildConfigStatus()),
    getUsageSummary(WINDOW_DAYS),
    getComplianceSummary(WINDOW_DAYS),
    getReviewQueue(),
  ])

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Pepscore Intelligence -- AI Control Panel</h1>
            <p className="text-white/50 text-sm mt-1">Foundation status, spend, and safety activity, last {WINDOW_DAYS} days · Pepscore Lab</p>
          </div>
          <Link
            href="/admin"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Admin Dashboard
          </Link>
        </div>

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Activation Status</h2>
          <p className="text-white/50 text-sm mb-4">Public activation is owner-gated regardless of what is engineered below -- this section shows what would need to be true first.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Feature Flag</p>
              <StatusPill ok={config.featureEnabled} onLabel="Enabled" offLabel="Disabled (dark)" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Gateway Credential</p>
              <StatusPill ok={config.gatewayConfigured} onLabel="Configured" offLabel="Not Configured" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Primary Model</p>
              <StatusPill ok={config.primaryModelConfigured} onLabel="Configured" offLabel="Not Configured" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Fallback Model</p>
              <StatusPill ok={config.fallbackModelConfigured} onLabel="Configured" offLabel="Not Configured" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Approved Model Routes</p>
              <p className="text-white text-xl font-bold tabular-nums">{config.approvedModelRouteCount} / {config.totalModelRouteCount}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Rate Limits</p>
              <p className="text-white text-sm tabular-nums">{config.rateLimitPerMinute}/min · {config.rateLimitPerDay}/day</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Daily Cost Limit</p>
              <p className="text-white text-sm tabular-nums">${(config.dailyCostLimitCents / 100).toFixed(2)}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Tier 2 Corpus</p>
              <p className="text-white text-sm tabular-nums">{config.tier2SourceCount} sources</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Tier 3 Corpus</p>
              <p className="text-white text-sm tabular-nums">{config.tier3SourceCount} sources</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Usage &amp; Cost</h2>
          <p className="text-white/50 text-sm mb-4">Every AiUsageEvent recorded in the window. Zero calls is expected while no model route is approved.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Total Calls</p>
              <p className="text-white text-xl font-bold tabular-nums">{usage.totalCalls}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Success / Failure</p>
              <p className="text-white text-xl font-bold tabular-nums">{usage.successCount} / {usage.failureCount}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Fallback Used</p>
              <p className="text-white text-xl font-bold tabular-nums">{usage.fallbackCount}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Total Spend</p>
              <p className="text-white text-xl font-bold tabular-nums">${(usage.totalCostCents / 100).toFixed(2)}</p>
            </div>
          </div>
          {usage.byModel.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Calls</th>
                  <th className="py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.byModel.map((row) => (
                  <tr key={`${row.provider}:${row.model}`} className="border-b border-white/5 text-white/80">
                    <td className="py-2 pr-4">{row.provider}</td>
                    <td className="py-2 pr-4">{row.model}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.calls}</td>
                    <td className="py-2 tabular-nums">${(row.costCents / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Policy &amp; Safety Activity</h2>
          <p className="text-white/50 text-sm mb-4">Every AiComplianceEvent recorded in the window, by classification category and policy action.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Total Events</p>
              <p className="text-white text-xl font-bold tabular-nums">{compliance.totalEvents}</p>
            </div>
            <div className="border border-gold/30 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Unreviewed Escalations</p>
              <p className="text-gold text-xl font-bold tabular-nums">{compliance.unreviewedEscalations}</p>
            </div>
          </div>
          {compliance.totalEvents === 0 ? (
            <p className="text-white/40 text-sm">No policy events recorded in this window.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-wide mb-2">By Category</h3>
                <table className="w-full text-left text-sm">
                  <tbody>
                    {compliance.byCategory.map((row) => (
                      <tr key={row.category} className="border-b border-white/5 text-white/80">
                        <td className="py-1.5 pr-4">{row.category}</td>
                        <td className="py-1.5 tabular-nums">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-wide mb-2">By Action</h3>
                <table className="w-full text-left text-sm">
                  <tbody>
                    {compliance.byAction.map((row) => (
                      <tr key={row.action} className="border-b border-white/5 text-white/80">
                        <td className="py-1.5 pr-4">{row.action}</td>
                        <td className="py-1.5 tabular-nums">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-white mb-1">Safety Review Queue</h2>
          <p className="text-white/50 text-sm mb-4">Unreviewed ESCALATE events, all time, most recent first. No raw prompt text is ever stored -- classification metadata only.</p>
          {reviewQueue.length === 0 ? (
            <p className="text-white/40 text-sm">No unreviewed escalations.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Feature</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Repeats</th>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 text-white/80">
                    <td className="py-2 pr-4">{row.policyCategory}</td>
                    <td className="py-2 pr-4">{row.feature}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.classifierConfidence?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-4">{row.classifierMethod ?? '—'}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.repeatCount}</td>
                    <td className="py-2 pr-4">{row.createdAt.toLocaleString()}</td>
                    <td className="py-2">
                      <MarkReviewedButton eventId={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}
