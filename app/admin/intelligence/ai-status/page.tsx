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
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import {
  buildConfigStatus,
  getUsageSummary,
  getComplianceSummary,
  getReviewQueue,
} from '@/lib/ai/observability/adminSummary'
import { MarkReviewedButton } from '@/components/admin/MarkReviewedButton'
import { LiveTestPanel } from '@/components/admin/LiveTestPanel'

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
        <AdminPageHeader
          title="AI Control Panel"
          subtitle={`Foundation status, spend, and safety activity, last ${WINDOW_DAYS} days · Pepscore Lab`}
          actions={
            <Link
              href="/admin"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Admin Dashboard
            </Link>
          }
        />

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Activation Status</h2>
          <p className="text-white/50 text-sm mb-4">
            Two independent kill switches, not one. <strong className="text-white/70">Public Customer AI</strong> gates the
            storefront-facing route (<code className="text-white/60">/research</code>, <code className="text-white/60">/api/ai/intelligence</code>) --
            it can stay off indefinitely; that decision is separately owner-gated.
            <strong className="text-white/70"> Live Model Calls</strong> is the actual switch for whether any real, paid
            provider request can happen at all (admin verification included) -- turn it off to stop spending immediately
            without touching public activation or removing any code.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="border border-gold/30 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Live Model Calls</p>
              <StatusPill ok={config.liveModelEnabled} onLabel="Enabled" offLabel="Disabled (kill switch on)" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Public Customer AI</p>
              <StatusPill ok={config.publicAiEnabled} onLabel="Enabled" offLabel="Disabled (dark)" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Gateway Credential</p>
              <StatusPill ok={config.gatewayConfigured} onLabel="Configured" offLabel="Not Configured" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Primary Model</p>
              <p className="text-white text-sm">{config.primaryModel ?? '—'}</p>
              <StatusPill ok={config.primaryModelApproved} onLabel="Approved Route" offLabel="Not Approved" />
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Fallback Model</p>
              <p className="text-white text-sm">{config.fallbackModel ?? '—'}</p>
              <StatusPill ok={config.fallbackModelApproved} onLabel="Approved Route" offLabel="Not Approved" />
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
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">App Daily Cost Limit</p>
              <p className="text-white text-sm tabular-nums">${(config.dailyCostLimitCents / 100).toFixed(2)}</p>
            </div>
            <div className="border border-white/10 rounded p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">Tier 2 / Tier 3 Corpus</p>
              <p className="text-white text-sm tabular-nums">{config.tier2SourceCount} / {config.tier3SourceCount} sources</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white mb-1">Live Model Verification</h2>
          <p className="text-white/50 text-sm mb-4">
            Runs a fixed, non-PII prompt through the real pipeline (policy gate → retrieval → live provider → output
            gate). Returns NOT_CONFIGURED with no network call if Live Model Calls is off, the credential is missing,
            or the configured model has no approved route above. Never customer-facing -- gated separately from
            Public Customer AI. The Vercel AI Gateway key itself carries its own $20 spend cap, set at creation and
            not changed by this app.
          </p>
          <LiveTestPanel />
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Provider</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Model</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Calls</th>
                    <th className="py-2 whitespace-nowrap">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.byModel.map((row) => (
                    <tr key={`${row.provider}:${row.model}`} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4 whitespace-nowrap">{row.provider}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.model}</td>
                      <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{row.calls}</td>
                      <td className="py-2 tabular-nums whitespace-nowrap">${(row.costCents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {compliance.byCategory.map((row) => (
                        <tr key={row.category} className="border-b border-white/5 text-white/80">
                          <td className="py-1.5 pr-4 whitespace-nowrap">{row.category}</td>
                          <td className="py-1.5 tabular-nums whitespace-nowrap">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-wide mb-2">By Action</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {compliance.byAction.map((row) => (
                        <tr key={row.action} className="border-b border-white/5 text-white/80">
                          <td className="py-1.5 pr-4 whitespace-nowrap">{row.action}</td>
                          <td className="py-1.5 tabular-nums whitespace-nowrap">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[11px] tracking-wide">
                    <th className="py-2 pr-4 whitespace-nowrap">Category</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Feature</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Confidence</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Method</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Repeats</th>
                    <th className="py-2 pr-4 whitespace-nowrap">When</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewQueue.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 text-white/80">
                      <td className="py-2 pr-4 whitespace-nowrap">{row.policyCategory}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.feature}</td>
                      <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{row.classifierConfidence?.toFixed(2) ?? '—'}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.classifierMethod ?? '—'}</td>
                      <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{row.repeatCount}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{row.createdAt.toLocaleString()}</td>
                      <td className="py-2 whitespace-nowrap">
                        <MarkReviewedButton eventId={row.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
