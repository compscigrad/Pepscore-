'use client'

// AI-1.8 -- the customer-facing UI for the structured Pepscore Intelligence
// capabilities built in AI-1.3/1.6 (lib/ai/intelligence/). Until this
// component existed, compare/discover/explain were a real, tested,
// deployed API with no way for a customer to actually reach it -- this is
// that missing entry point.
//
// Deliberately structured controls (two name fields, a category dropdown,
// one name field), not a single free-text box -- matches the backend's own
// posture (see compoundComparison.ts's header): nothing here can parse
// arbitrary natural-language intent, because no approved model route
// exists yet. The page this renders on (app/research/page.tsx) already
// 404s when AI_FEATURE_ENABLED is off, so this component only ever mounts
// when the feature is genuinely live -- it still handles a 503 gracefully
// in case the flag flips off between page load and a request completing.
//
// AI-1.13 added the "Ask a Question" tab -- the one genuinely free-text
// control here, backed by researchQa.ts's live-model pipeline. It renders
// UNAVAILABLE the same way as a policy refusal (both just show
// result.reason) since there's nothing actionable a customer can do about
// either besides trying a different question.
import { useState } from 'react'
import { MERCHANDISING_TAXONOMY } from '@/lib/storefront/merchandisingTaxonomy'
import { DarkListbox } from '@/components/ui/DarkListbox'

const CATEGORY_OPTIONS = MERCHANDISING_TAXONOMY.map((c) => ({ value: c.slug, label: c.label }))

interface Citation {
  sourceId: string
  citationLabel: string
  tier: number
  sourceType: string
  url?: string
}

interface CompoundEntry {
  productName: string
  found: boolean
  rawCategory: string | null
  researchCategories: { slug: string; label: string }[]
  description: string | null
  citation: Citation | null
}

interface CategoryEntry {
  productName: string
  citation: Citation
}

type Mode = 'compare' | 'discover' | 'explain' | 'ask'

interface FetchState<T> {
  loading: boolean
  error: string | null
  result: T | null
}

async function callIntelligence<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/ai/intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 503) throw new Error('Pepscore Intelligence is not currently enabled.')
  if (!res.ok) throw new Error('That request could not be completed.')
  return res.json()
}

const tabClass = (active: boolean) =>
  `font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-4 py-2.5 rounded-full transition-colors ${
    active ? 'bg-[#D4AF37] text-black' : 'text-white/60 hover:text-white border border-white/15'
  }`

const inputClass =
  'w-full border border-white/15 bg-white/[0.04] rounded-lg px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'

function CitationLine({ citation }: { citation: Citation | null }) {
  if (!citation) return null
  return <p className="text-white/35 text-[11px] mt-1">Source: {citation.citationLabel} (Tier {citation.tier})</p>
}

function CompoundCard({ entry }: { entry: CompoundEntry }) {
  if (!entry.found) {
    return (
      <div className="border border-white/10 rounded-lg p-4">
        <p className="text-white font-semibold">{entry.productName}</p>
        <p className="text-white/40 text-[13px] mt-1">Not found in the current catalog.</p>
      </div>
    )
  }
  return (
    <div className="border border-white/10 rounded-lg p-4">
      <p className="text-white font-semibold">{entry.productName}</p>
      {entry.researchCategories.length > 0 && (
        <p className="text-[#D4AF37] text-[12px] mt-1">
          {entry.researchCategories.map((c) => c.label).join(' · ')}
        </p>
      )}
      {entry.description && <p className="text-white/60 text-[13px] mt-2 leading-relaxed">{entry.description}</p>}
      <CitationLine citation={entry.citation} />
    </div>
  )
}

export function PepscoreIntelligenceConcierge() {
  const [mode, setMode] = useState<Mode>('compare')

  const [compareNames, setCompareNames] = useState(['', ''])
  const [compareState, setCompareState] = useState<FetchState<{ status: string; reason?: string; entries: CompoundEntry[] }>>({
    loading: false,
    error: null,
    result: null,
  })

  const [categorySlug, setCategorySlug] = useState(MERCHANDISING_TAXONOMY[0]?.slug ?? '')
  const [discoverState, setDiscoverState] = useState<
    FetchState<{ status: string; reason?: string; categoryLabel?: string; categoryDescription?: string; entries: CategoryEntry[] }>
  >({ loading: false, error: null, result: null })

  const [explainName, setExplainName] = useState('')
  const [explainState, setExplainState] = useState<FetchState<{ status: string; reason?: string; entry: CompoundEntry | null }>>({
    loading: false,
    error: null,
    result: null,
  })

  const [question, setQuestion] = useState('')
  const [askState, setAskState] = useState<
    FetchState<{ status: string; reason?: string; answer?: string; citations?: Citation[] }>
  >({ loading: false, error: null, result: null })

  async function runCompare(e: React.FormEvent) {
    e.preventDefault()
    const productNames = compareNames.map((n) => n.trim()).filter(Boolean)
    if (productNames.length < 2) {
      setCompareState({ loading: false, error: 'Enter at least two compound names.', result: null })
      return
    }
    setCompareState({ loading: true, error: null, result: null })
    try {
      const result = await callIntelligence<{ status: string; reason?: string; entries: CompoundEntry[] }>({
        type: 'compare',
        productNames,
      })
      setCompareState({ loading: false, error: null, result })
    } catch (err) {
      setCompareState({ loading: false, error: err instanceof Error ? err.message : 'Something went wrong.', result: null })
    }
  }

  async function runDiscover(e: React.FormEvent) {
    e.preventDefault()
    setDiscoverState({ loading: true, error: null, result: null })
    try {
      const result = await callIntelligence<{
        status: string
        reason?: string
        categoryLabel?: string
        categoryDescription?: string
        entries: CategoryEntry[]
      }>({ type: 'discover', categorySlug })
      setDiscoverState({ loading: false, error: null, result })
    } catch (err) {
      setDiscoverState({ loading: false, error: err instanceof Error ? err.message : 'Something went wrong.', result: null })
    }
  }

  async function runExplain(e: React.FormEvent) {
    e.preventDefault()
    if (!explainName.trim()) {
      setExplainState({ loading: false, error: 'Enter a compound name.', result: null })
      return
    }
    setExplainState({ loading: true, error: null, result: null })
    try {
      const result = await callIntelligence<{ status: string; reason?: string; entry: CompoundEntry | null }>({
        type: 'explain',
        productName: explainName.trim(),
      })
      setExplainState({ loading: false, error: null, result })
    } catch (err) {
      setExplainState({ loading: false, error: err instanceof Error ? err.message : 'Something went wrong.', result: null })
    }
  }

  async function runAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) {
      setAskState({ loading: false, error: 'Enter a question.', result: null })
      return
    }
    setAskState({ loading: true, error: null, result: null })
    try {
      const result = await callIntelligence<{ status: string; reason?: string; answer?: string; citations?: Citation[] }>({
        type: 'ask',
        question: question.trim(),
      })
      setAskState({ loading: false, error: null, result })
    } catch (err) {
      setAskState({ loading: false, error: err instanceof Error ? err.message : 'Something went wrong.', result: null })
    }
  }

  return (
    <main className="bg-black min-h-screen">
      <div className="max-w-[820px] mx-auto px-6 py-14">
        <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-2">Pepscore Intelligence</h1>
        <p className="text-white/50 text-[14px] mb-2">
          Compare research classifications, browse compounds by research category, and explore the research areas
          associated with a compound in the Pepscore catalog.
        </p>
        <p className="text-white/35 text-[12px] mb-8">
          For research purposes only. Nothing here is intended as, or should be interpreted as, guidance for human or
          veterinary use, dosing, or treatment.
        </p>

        <div className="flex gap-2 mb-8">
          <button type="button" className={tabClass(mode === 'compare')} onClick={() => setMode('compare')}>
            Compare
          </button>
          <button type="button" className={tabClass(mode === 'discover')} onClick={() => setMode('discover')}>
            Browse by Category
          </button>
          <button type="button" className={tabClass(mode === 'explain')} onClick={() => setMode('explain')}>
            Explain a Compound
          </button>
          <button type="button" className={tabClass(mode === 'ask')} onClick={() => setMode('ask')}>
            Ask a Question
          </button>
        </div>

        {mode === 'compare' && (
          <section>
            <form onSubmit={runCompare} className="flex flex-col gap-3 mb-6">
              {compareNames.map((name, i) => (
                <input
                  key={i}
                  value={name}
                  onChange={(e) => setCompareNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))}
                  placeholder={`Compound ${i + 1} name (e.g. MOTS-c)`}
                  className={inputClass}
                />
              ))}
              <div className="flex gap-3">
                {compareNames.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setCompareNames((prev) => [...prev, ''])}
                    className="text-white/50 hover:text-[#D4AF37] text-[12px] font-heading font-bold uppercase tracking-wide"
                  >
                    + Add another
                  </button>
                )}
                <button
                  type="submit"
                  disabled={compareState.loading}
                  className="ml-auto bg-[#D4AF37] text-black font-heading text-[12px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full disabled:opacity-50"
                >
                  {compareState.loading ? 'Comparing…' : 'Compare'}
                </button>
              </div>
            </form>
            {compareState.error && <p className="text-red-400 text-[13px] mb-4">{compareState.error}</p>}
            {compareState.result && compareState.result.status !== 'ALLOWED' && (
              <p className="text-white/50 text-[13px] mb-4">{compareState.result.reason ?? 'This request could not be completed.'}</p>
            )}
            {compareState.result?.status === 'ALLOWED' && (
              <div className="grid gap-3">
                {compareState.result.entries.map((entry, i) => (
                  <CompoundCard key={`${entry.productName}-${i}`} entry={entry} />
                ))}
              </div>
            )}
          </section>
        )}

        {mode === 'discover' && (
          <section>
            <form onSubmit={runDiscover} className="flex gap-3 mb-6">
              <DarkListbox
                value={categorySlug}
                onChange={setCategorySlug}
                options={CATEGORY_OPTIONS}
                ariaLabel="Research category"
                className="flex-1"
              />
              <button
                type="submit"
                disabled={discoverState.loading}
                className="bg-[#D4AF37] text-black font-heading text-[12px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full disabled:opacity-50 flex-shrink-0"
              >
                {discoverState.loading ? 'Loading…' : 'Browse'}
              </button>
            </form>
            {discoverState.error && <p className="text-red-400 text-[13px] mb-4">{discoverState.error}</p>}
            {discoverState.result && discoverState.result.status !== 'ALLOWED' && (
              <p className="text-white/50 text-[13px] mb-4">
                {discoverState.result.reason ?? 'No research category matches that selection.'}
              </p>
            )}
            {discoverState.result?.status === 'ALLOWED' && (
              <div>
                {discoverState.result.categoryDescription && (
                  <p className="text-white/50 text-[13px] mb-4">{discoverState.result.categoryDescription}</p>
                )}
                {discoverState.result.entries.length === 0 ? (
                  <p className="text-white/40 text-[13px]">No products currently listed under this category.</p>
                ) : (
                  <div className="grid gap-3">
                    {discoverState.result.entries.map((entry) => (
                      <div key={entry.productName} className="border border-white/10 rounded-lg p-4">
                        <p className="text-white font-semibold">{entry.productName}</p>
                        <CitationLine citation={entry.citation} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {mode === 'explain' && (
          <section>
            <form onSubmit={runExplain} className="flex gap-3 mb-6">
              <input
                value={explainName}
                onChange={(e) => setExplainName(e.target.value)}
                placeholder="Compound name (e.g. NAD+)"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={explainState.loading}
                className="bg-[#D4AF37] text-black font-heading text-[12px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full disabled:opacity-50 flex-shrink-0"
              >
                {explainState.loading ? 'Loading…' : 'Explain'}
              </button>
            </form>
            {explainState.error && <p className="text-red-400 text-[13px] mb-4">{explainState.error}</p>}
            {explainState.result && explainState.result.status !== 'ALLOWED' && (
              <p className="text-white/50 text-[13px] mb-4">{explainState.result.reason ?? 'This request could not be completed.'}</p>
            )}
            {explainState.result?.status === 'ALLOWED' && explainState.result.entry && <CompoundCard entry={explainState.result.entry} />}
          </section>
        )}

        {mode === 'ask' && (
          <section>
            <form onSubmit={runAsk} className="flex flex-col gap-3 mb-6">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What research areas involve mitochondrial peptides?"
                maxLength={500}
                rows={3}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={askState.loading}
                className="self-end bg-[#D4AF37] text-black font-heading text-[12px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full disabled:opacity-50"
              >
                {askState.loading ? 'Thinking…' : 'Ask'}
              </button>
            </form>
            {askState.error && <p className="text-red-400 text-[13px] mb-4">{askState.error}</p>}
            {askState.result && askState.result.status !== 'ALLOWED' && (
              <p className="text-white/50 text-[13px] mb-4">{askState.result.reason ?? 'This request could not be completed.'}</p>
            )}
            {askState.result?.status === 'ALLOWED' && (
              <div className="border border-white/10 rounded-lg p-4">
                <p className="text-white/80 text-[14px] leading-relaxed whitespace-pre-wrap">{askState.result.answer}</p>
                {askState.result.citations && askState.result.citations.length > 0 && (
                  <p className="text-white/35 text-[11px] mt-3">
                    Sources: {askState.result.citations.map((c) => c.citationLabel).join(', ')}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
