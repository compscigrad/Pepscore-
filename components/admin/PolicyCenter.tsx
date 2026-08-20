// Admin Policies & Operations Center (2026-08-20) -- the owner-facing
// operating-rules reference. Receives its data as plain serializable props
// from the server page component (never imports lib/policies/data.ts
// directly here) -- that module transitively imports Prisma via
// lib/finance/reports.ts, and importing even one value from it into a
// 'use client' file would leak Prisma into the browser bundle, the exact
// class of build-breaking mistake documented in Decision #80.
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { card, mutedText, pillPrimary, pillOutline, input } from '@/components/invoices/theme'
import type { Policy, PolicyCategory } from '@/lib/policies/data'

const STATUS_BADGE: Record<Policy['status'], string> = {
  ACTIVE: 'bg-green-500/15 text-green-400',
  DRAFT: 'bg-blue-500/15 text-blue-300',
  DEPRECATED: 'bg-white/10 text-white/40',
  OWNER_REVIEW_REQUIRED: 'bg-amber-400/15 text-amber-300',
  EXTERNAL_DEPENDENCY: 'bg-purple-500/15 text-purple-300',
}

const OVERRIDE_LABEL: Record<Policy['ownerOverride'], string> = { YES: 'Yes', NO: 'No', LIMITED: 'Limited' }

interface PolicyCenterProps {
  policies: Policy[]
  categoryLabels: Record<PolicyCategory, string>
}

export function PolicyCenter({ policies, categoryLabels }: PolicyCenterProps) {
  const [view, setView] = useState<'QUICK' | 'ALL'>('QUICK')
  const [category, setCategory] = useState<PolicyCategory | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Policy['status'] | 'ALL'>('ALL')
  const [overrideFilter, setOverrideFilter] = useState<Policy['ownerOverride'] | 'ALL'>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = useMemo(() => Array.from(new Set(policies.map((p) => p.category))).sort(), [policies])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return policies.filter((p) => {
      if (view === 'QUICK' && !p.quickReference) return false
      if (category !== 'ALL' && p.category !== category) return false
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (overrideFilter !== 'ALL' && p.ownerOverride !== overrideFilter) return false
      if (q) {
        const haystack = [p.name, p.currentRule, p.businessRationale, p.appliesTo, categoryLabels[p.category]].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [policies, view, category, statusFilter, overrideFilter, query, categoryLabels])

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setView('QUICK')} className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${view === 'QUICK' ? pillPrimary : pillOutline}`}>
            Quick Reference
          </button>
          <button onClick={() => setView('ALL')} className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${view === 'ALL' ? pillPrimary : pillOutline}`}>
            All Policies
          </button>
        </div>

        <input
          className={input}
          placeholder="Search policies (e.g. sample, price match, shipping, refund)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {view === 'ALL' && (
          <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1">
            <button onClick={() => setCategory('ALL')} className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase whitespace-nowrap transition-all ${category === 'ALL' ? pillPrimary : pillOutline}`}>
              All Categories
            </button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase whitespace-nowrap transition-all ${category === c ? pillPrimary : pillOutline}`}>
                {categoryLabels[c]}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select className={`${input} text-[12px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="ALL">Any Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="OWNER_REVIEW_REQUIRED">Owner Review Required</option>
            <option value="EXTERNAL_DEPENDENCY">External Dependency</option>
          </select>
          <select className={`${input} text-[12px]`} value={overrideFilter} onChange={(e) => setOverrideFilter(e.target.value as typeof overrideFilter)}>
            <option value="ALL">Any Override</option>
            <option value="YES">Override: Yes</option>
            <option value="LIMITED">Override: Limited</option>
            <option value="NO">Override: No</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={`${mutedText} text-center py-8`}>No policies match this search/filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const expanded = expandedId === p.id
            return (
              <div key={p.id} className={`${card} p-4`}>
                <button className="w-full text-left" onClick={() => setExpandedId(expanded ? null : p.id)}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.06em] text-white/40 mb-0.5">{categoryLabels[p.category]}</p>
                      <p className="font-heading font-bold text-white">{p.name}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap items-start">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${p.enforcement === 'SYSTEM_ENFORCED' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/10 text-white/60'}`}>
                        {p.enforcement === 'SYSTEM_ENFORCED' ? 'System Enforced' : 'Operational Guidance'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${STATUS_BADGE[p.status]}`}>{p.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <p className={`${mutedText} text-[13px] mt-2`}>{p.currentRule}</p>
                </button>

                {expanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-[13px]">
                    {p.businessRationale && (
                      <p><span className="text-white/40 font-bold uppercase text-[10px] tracking-[0.06em] block mb-0.5">Why This Exists</span>{p.businessRationale}</p>
                    )}
                    <p><span className="text-white/40 font-bold uppercase text-[10px] tracking-[0.06em] block mb-0.5">Applies To</span>{p.appliesTo}</p>
                    <p>
                      <span className="text-white/40 font-bold uppercase text-[10px] tracking-[0.06em] block mb-0.5">Owner Override</span>
                      {OVERRIDE_LABEL[p.ownerOverride]}{p.overrideNotes ? ` — ${p.overrideNotes}` : ''}
                    </p>
                    {p.doNot && p.doNot.length > 0 && (
                      <div>
                        <span className="text-white/40 font-bold uppercase text-[10px] tracking-[0.06em] block mb-0.5">Do Not</span>
                        <ul className="list-disc list-inside text-white/70 space-y-0.5">
                          {p.doNot.map((d) => <li key={d}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.relatedWorkflow && (
                      <Link href={p.relatedWorkflow.href} className="inline-block text-[#D4AF37] hover:underline">
                        {p.relatedWorkflow.label} →
                      </Link>
                    )}
                    <p className={`${mutedText} text-[11px] pt-1`}>
                      Source: {p.sourceRef} · Last updated {p.lastUpdated}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
