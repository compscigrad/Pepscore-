// Tasteful, one-time guidance cue pointing at the header's "Client Sign
// In" CTA (2026-08-12 conversion sprint). Desktop only -- on mobile that
// CTA lives inside the hamburger menu instead (Header.tsx), where a
// pointer-style callout to an off-screen collapsed menu wouldn't make
// sense; mobile visitors already see the option the moment they open the
// menu, so no separate cue is needed there.
//
// Shown once per browser (localStorage-gated) to a signed-out visitor,
// after a short delay so it doesn't fight the hero for attention on
// first paint. Never shown again once dismissed or once the visitor is
// signed in.
'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth, SignInButton } from '@clerk/nextjs'
import { X } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

const DISMISSED_KEY = 'pepscore-coachmark-signin-dismissed'
const SHOW_DELAY_MS = 2500

export function ClientSignInCoachMark() {
  const { isLoaded, isSignedIn } = useAuth()
  const [visible, setVisible] = useState(false)
  // A ref, not state -- this only needs to prevent a duplicate track()
  // call, never to trigger a re-render itself.
  const impressionTracked = useRef(false)

  useEffect(() => {
    if (!isLoaded || isSignedIn) return
    if (typeof window === 'undefined' || localStorage.getItem(DISMISSED_KEY)) return
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (visible && !impressionTracked.current) {
      trackEvent(AnalyticsEvent.COACH_MARK_IMPRESSION)
      impressionTracked.current = true
    }
  }, [visible])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (!visible) return null

  return (
    <div
      role="tooltip"
      className="hidden md:block absolute top-full right-6 mt-2.5 z-[950] w-[260px] coach-mark-in"
    >
      {/* Pointer triangle */}
      <div className="absolute -top-[6px] right-8 w-3 h-3 bg-[#141414] border-t border-l border-[#D4AF37]/40 rotate-45" />
      <div className="relative bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-[#D4AF37]/40 rounded-xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors p-1"
        >
          <X size={13} />
        </button>
        <p className="text-[13px] text-white/85 leading-relaxed pr-4 mb-3">
          New here? Create your account or sign in.
        </p>
        <SignInButton mode="modal" fallbackRedirectUrl="/account?portal=customer">
          <button
            onClick={() => {
              trackEvent(AnalyticsEvent.COACH_MARK_CLICK)
              dismiss()
            }}
            className="font-heading text-[11px] font-bold tracking-[0.06em] uppercase text-[#D4AF37] hover:text-[#F0D365] transition-colors"
          >
            Client Sign In →
          </button>
        </SignInButton>
      </div>
    </div>
  )
}
