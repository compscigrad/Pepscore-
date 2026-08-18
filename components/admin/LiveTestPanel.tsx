'use client'

// AI-1.12 -- the admin-facing trigger for /api/admin/ai/live-test. Lets an
// owner/admin actually run the fixed synthetic-prompt verification set
// from the browser, without needing raw API calls. Only ever sends one of
// the fixed promptKey values -- no free-text input exists here, matching
// the route's own no-arbitrary-text posture.
import { useState } from 'react'
import { SYNTHETIC_TEST_PROMPTS } from '@/lib/ai/testing/syntheticPrompts'

interface LiveTestOutcome {
  status: string
  reason?: string
  text?: string
  provider?: string
  model?: string
  usedFallback?: boolean
  citations?: { sourceId: string; citationLabel: string; tier: number }[]
}

interface LiveTestResponse {
  status?: string
  reason?: string
  promptKey?: string
  promptCategory?: string
  outcome?: LiveTestOutcome
  error?: string
}

export function LiveTestPanel() {
  const [promptKey, setPromptKey] = useState(SYNTHETIC_TEST_PROMPTS[0]?.key ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LiveTestResponse | null>(null)

  async function runTest() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/ai/live-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptKey }),
      })
      setResult(await res.json())
    } catch {
      setResult({ error: 'Request failed.' })
    } finally {
      setRunning(false)
    }
  }

  const outcomeStatus = result?.outcome?.status ?? result?.status
  const badgeOk = outcomeStatus === 'COMPLETED'

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={promptKey}
          onChange={(e) => setPromptKey(e.target.value)}
          className="border border-white/15 bg-white/[0.04] rounded px-3 py-2 text-[13px] text-white"
        >
          {SYNTHETIC_TEST_PROMPTS.map((p) => (
            <option key={p.key} value={p.key}>
              [{p.category === 'ALLOWED_EXAMPLE' ? 'allowed' : 'prohibited'}] {p.text}
            </option>
          ))}
        </select>
        <button
          onClick={runTest}
          disabled={running}
          className="bg-gold text-black font-heading text-[12px] font-bold uppercase tracking-wide px-4 py-2 rounded-full disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run Test'}
        </button>
      </div>

      {result && (
        <div className="border border-white/10 rounded p-4 text-sm">
          <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2">
            Status: <span className={badgeOk ? 'text-gold' : 'text-white/70'}>{outcomeStatus ?? 'ERROR'}</span>
          </p>
          {(result.reason ?? result.outcome?.reason) && <p className="text-white/70 mb-2">{result.reason ?? result.outcome?.reason}</p>}
          {result.error && <p className="text-red-400 mb-2">{result.error}</p>}
          {result.outcome?.text && <p className="text-white/80 mb-2 whitespace-pre-wrap">{result.outcome.text}</p>}
          {result.outcome?.provider && (
            <p className="text-white/40 text-[12px]">
              {result.outcome.provider} / {result.outcome.model} {result.outcome.usedFallback ? '(fallback used)' : ''}
            </p>
          )}
          {result.outcome?.citations && result.outcome.citations.length > 0 && (
            <p className="text-white/40 text-[12px] mt-1">
              Citations: {result.outcome.citations.map((c) => c.citationLabel).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
