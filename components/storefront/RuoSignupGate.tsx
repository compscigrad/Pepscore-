// Pre-signup RUO/21+ gate (2026-08-12) -- rendered by app/sign-up/[[...sign-up]]/
// page.tsx INSTEAD OF Clerk's <SignUp> whenever the visitor has no valid
// pending acceptance yet. Server-validated: accepting here only ever sets an
// HttpOnly cookie via POST /api/compliance/ruo/pending-accept (never a
// client-only flag) and the page itself re-checks that cookie server-side
// via router.refresh() before ever mounting <SignUp/>, so there is no way
// to reach Clerk's signup fields without a real, server-recorded acceptance.
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'
import { RuoAcceptanceFields } from './RuoAcceptanceFields'

export function RuoSignupGate() {
  const router = useRouter()
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [agreementConfirmed, setAgreementConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const canContinue = ageConfirmed && agreementConfirmed

  useEffect(() => {
    trackEvent(AnalyticsEvent.SIGNUP_GATE_SHOWN)
    headingRef.current?.focus()
  }, [])

  function abandon() {
    trackEvent(AnalyticsEvent.SIGNUP_GATE_ABANDONED)
    router.back()
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') abandon()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleContinue() {
    if (!canContinue || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/compliance/ruo/pending-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageConfirmed, agreementConfirmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not record acceptance. Please try again.')
      }
      // Re-renders app/sign-up's server component with the new cookie
      // present, which reveals <SignUp/> immediately -- no extra click, no
      // manual navigation, no re-asking the agreement (section 13).
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        role="region"
        aria-labelledby="ruo-signup-gate-heading"
        className="relative bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl max-w-[540px] w-full shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden"
      >
        <Image
          src="/images/brand/dna-molecular-bg.png"
          alt=""
          fill
          aria-hidden="true"
          className="object-cover object-right opacity-[0.04] pointer-events-none"
          sizes="540px"
        />

        <div className="relative bg-amber-400/10 border-b border-amber-400/25 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-400 flex-shrink-0" size={22} aria-hidden="true" />
          <div>
            <h2
              id="ruo-signup-gate-heading"
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-[15px] font-bold text-white flex items-center gap-2 focus:outline-none"
            >
              <Image src="/images/email-logo-mark.png" alt="" width={16} height={16} className="w-4 h-4" />
              Research Use Agreement
            </h2>
            <p className="text-[12px] text-white/50 mt-0.5">Confirmation required before creating an account</p>
          </div>
        </div>

        <div className="relative px-6 py-5">
          <RuoAcceptanceFields
            ageConfirmed={ageConfirmed}
            onAgeChange={setAgeConfirmed}
            agreementConfirmed={agreementConfirmed}
            onAgreementChange={setAgreementConfirmed}
            ageInputId="ruo-signup-gate-age"
            agreementInputId="ruo-signup-gate-agreement"
          />
          {error && (
            <p role="alert" className="text-[12px] text-red-400 mt-3">
              {error}
            </p>
          )}
        </div>

        <div className="relative px-6 pb-6 flex gap-3">
          <button
            onClick={abandon}
            className="flex-1 border border-white/20 text-white/70 font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!canContinue || busy}
            aria-disabled={!canContinue || busy}
            className="flex-1 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] disabled:opacity-40 disabled:cursor-not-allowed text-black font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full transition-all"
          >
            {busy ? 'Processing…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
