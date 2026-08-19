'use client'

// FIRST10-style claim modal (2026-08-19 lead-capture/conversion engine
// rewrite). Still the one component behind both entry points:
//   1. A manual click trigger (renders its own button) -- unchanged from
//      the original implementation, used by the homepage banner/footer.
//   2. An OPTIONAL auto-trigger mode (the `autoTrigger` prop) -- delay/
//      scroll/exit-intent driven, frequency-suppressed via localStorage
//      (lib/storefront/acquisitionPopup.ts's pure eligibility functions),
//      dual-logs impression/dismissed funnel events both to
//      lib/analytics (Vercel Analytics) and to the first-party
//      CampaignFunnelEvent table the Admin conversion dashboard reads.
// Validation shape (email AND phone both required, split email/SMS
// consent) is specific to this discount-offer flow, not a
// LeadCaptureTrigger variant -- see that component's own header comment
// for why the two stay separate.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { getAttribution } from '@/lib/storefront/attribution'
import { formatDiscountLabel } from '@/lib/promotions/format'
import {
  isPopupSuppressed,
  recordCapture,
  recordDismiss,
  shouldTriggerPopup,
  type AcquisitionPopupState,
} from '@/lib/storefront/acquisitionPopup'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'
import type { PromotionType } from '@prisma/client'

const STORAGE_KEY = 'ps_acquisition_popup_v1'

function readState(): AcquisitionPopupState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AcquisitionPopupState) : {}
  } catch {
    return {}
  }
}

function writeState(state: AcquisitionPopupState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private browsing, quota) -- suppression simply
    // won't persist across visits; never blocks the popup itself.
  }
}

function logFunnelEvent(campaignId: string, eventType: 'POPUP_IMPRESSION' | 'POPUP_DISMISSED'): void {
  fetch('/api/promotions/first-order-offer/funnel-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, eventType, sourcePage: window.location.pathname }),
    keepalive: true,
  }).catch(() => {
    // Best-effort -- a missed funnel-event log never blocks the popup.
  })
}

export interface AcquisitionPopupTriggerSettings {
  delayMs: number
  scrollThresholdPercent: number | null
  exitIntentEnabled: boolean
  capturedSuppressDays: number
  dismissedSuppressDays: number
}

export interface FirstOrderOfferModalProps {
  campaignId: string
  publicTitle: string
  publicDescription?: string | null
  discountType: PromotionType
  discountValue: number
  triggerLabel: string
  triggerClassName: string
  // When omitted, this behaves exactly as the original click-only modal
  // (no auto-open, no suppression tracking, no funnel-event logging) --
  // safe to keep using anywhere a manual "Claim Offer" link is wanted
  // without opting into first-visit popup behavior.
  autoTrigger?: AcquisitionPopupTriggerSettings
}

const inputCls =
  'w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'

export function FirstOrderOfferModal({
  campaignId,
  publicTitle,
  publicDescription,
  discountType,
  discountValue,
  triggerLabel,
  triggerClassName,
  autoTrigger,
}: FirstOrderOfferModalProps) {
  const discountLabel = formatDiscountLabel(discountType, discountValue)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailConsent, setEmailConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  // 2026-08-19 lead-capture/conversion engine (section 1/3/4/7): distinct
  // from `claimed` -- this customer already has real purchase history on
  // another channel, so no code was issued. "Welcome back" messaging,
  // never a discount promise they can't redeem.
  const [existingCustomerNotEligible, setExistingCustomerNotEligible] = useState(false)
  const autoOpenedRef = useRef(false) // guards against logging more than one impression per mount

  // Auto-trigger: delay/scroll/exit-intent, gated by same-browser
  // suppression state (section 3/33). Runs once per mount; a null
  // autoTrigger prop means this entire effect is a no-op, so the manual-
  // trigger-only usage (e.g. a footer link) is completely unaffected.
  useEffect(() => {
    if (!autoTrigger || autoOpenedRef.current) return

    const state = readState()
    if (isPopupSuppressed(state, autoTrigger, Date.now())) return

    const startedAt = Date.now()
    let exitIntentDetected = false
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    function evaluate() {
      if (autoOpenedRef.current) return
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = scrollableHeight > 0 ? Math.min(100, (window.scrollY / scrollableHeight) * 100) : 0
      const fire = shouldTriggerPopup(
        { delayMs: autoTrigger!.delayMs, scrollThresholdPercent: autoTrigger!.scrollThresholdPercent, exitIntentEnabled: autoTrigger!.exitIntentEnabled },
        { elapsedMs: Date.now() - startedAt, scrollPercent, exitIntentDetected, isDesktop }
      )
      if (fire) {
        autoOpenedRef.current = true
        setOpen(true)
        logFunnelEvent(campaignId, 'POPUP_IMPRESSION')
        trackEvent(AnalyticsEvent.LEAD_POPUP_IMPRESSION, { discountType })
        cleanup()
      }
    }

    function onScroll() {
      evaluate()
    }
    function onMouseLeave(e: MouseEvent) {
      // Exit-intent heuristic: cursor leaves through the top of the
      // viewport, the same signal every mainstream exit-intent
      // implementation uses -- desktop-only (isDesktop above), never
      // relied on for mobile per section 3's own "where reliable" caveat.
      if (e.clientY <= 0) {
        exitIntentDetected = true
        evaluate()
      }
    }

    const delayTimer = window.setTimeout(evaluate, autoTrigger.delayMs)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)

    function cleanup() {
      window.clearTimeout(delayTimer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoTrigger is a stable server-provided prop; re-running on every render would restart the delay timer
  }, [])

  // Manual-trigger-only impression (unchanged behavior): every render of
  // the button itself counts as the offer being shown, matching the
  // pre-2026-08-19 OFFER_VIEWED semantics exactly. Auto-trigger impressions
  // are logged separately, only on actual auto-open, above.
  useEffect(() => {
    if (!autoTrigger) trackEvent(AnalyticsEvent.OFFER_VIEWED, { discountType })
  }, [discountType, autoTrigger])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emailConsent) {
      toast.error('Please confirm you agree to receive your offer by email.')
      return
    }
    setSubmitting(true)
    try {
      const attribution = getAttribution()
      const res = await fetch('/api/promotions/first-order-offer/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          emailConsent,
          smsConsent,
          sourcePage: window.location.pathname,
          website,
          ...attribution,
        }),
      })
      const responseData = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(responseData?.error ?? 'Something went wrong — please try again.')
        return
      }
      setClaimed(true)
      if (autoTrigger) writeState(recordCapture(Date.now()))
      const alreadyClaimed = Boolean(responseData?.alreadyClaimed)
      const notEligible = Boolean(responseData?.existingCustomerNotEligible)
      setExistingCustomerNotEligible(notEligible)
      if (notEligible) {
        toast.success('Welcome back to Pepscore.')
      } else {
        trackEvent(AnalyticsEvent.PROMOTION_CLAIM, { discountType, alreadyClaimed })
        if (alreadyClaimed) trackEvent(AnalyticsEvent.OFFER_RECOVERY_SHOWN, { discountType })
        toast.success(
          alreadyClaimed
            ? "You've already claimed this offer — check your email for details."
            : "You're in! We'll follow up with your discount code shortly."
        )
      }
    } catch {
      toast.error('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    if (submitting) return
    // Only a genuine dismiss (closed without ever completing the claim)
    // counts for suppression/funnel purposes -- closing the "You're all
    // set" confirmation view is not a dismissal.
    if (autoTrigger && !claimed) {
      writeState(recordDismiss(readState(), Date.now()))
      logFunnelEvent(campaignId, 'POPUP_DISMISSED')
      trackEvent(AnalyticsEvent.LEAD_POPUP_DISMISSED, { discountType })
    }
    setOpen(false)
    setClaimed(false)
    setExistingCustomerNotEligible(false)
    setName('')
    setEmail('')
    setPhone('')
    setEmailConsent(false)
    setSmsConsent(false)
    setWebsite('')
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={close} />
          <div className="relative bg-black border border-[#D4AF37]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-w-md w-full p-7">
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>

            {claimed && existingCustomerNotEligible ? (
              <div className="py-4">
                <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">Welcome back to Pepscore</h2>
                <p className="text-[13px] text-white/60 leading-relaxed mb-4">
                  Looks like you already have a Pepscore account with us — this offer is for new customers, so we
                  won&apos;t be sending a first-order code. Here&apos;s where you can go instead:
                </p>
                <div className="space-y-2">
                  <Link href="/sign-in" className="block text-[13px] text-gold-light hover:text-gold underline underline-offset-2">
                    Sign in to your account →
                  </Link>
                  <Link href="/categories" className="block text-[13px] text-gold-light hover:text-gold underline underline-offset-2">
                    Browse the catalog →
                  </Link>
                  <Link href="/contact" className="block text-[13px] text-gold-light hover:text-gold underline underline-offset-2">
                    Contact support →
                  </Link>
                </div>
              </div>
            ) : claimed ? (
              <div className="py-4">
                <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">You&apos;re all set</h2>
                <p className="text-[13px] text-white/60 leading-relaxed">
                  We&apos;ll follow up by email with your {discountLabel} first-order code and how to use it.
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">{publicTitle}</h2>
                <p className="text-[13px] text-white/55 leading-relaxed mb-5">
                  {publicDescription ?? `Leave your email and phone number and we'll send you a code for ${discountLabel} your first order. One offer per customer.`}
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                  />
                  {/* Honeypot — hidden from real visitors via CSS */}
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="absolute left-[-9999px] w-px h-px opacity-0"
                    aria-hidden="true"
                  />
                  {/* Email and SMS marketing consent are tracked
                      independently (2026-08-19, section 6) -- never one
                      bundled checkbox. SMS starts unchecked and is
                      genuinely optional; phone number possession alone is
                      never treated as SMS consent, and no automated
                      marketing SMS is sent regardless of this value while
                      SMS marketing activation remains owner-gated (see
                      docs/PendingOwnerActions.md). */}
                  <label className="flex items-start gap-2.5 text-[12px] text-white/55 leading-relaxed pt-1">
                    <input
                      type="checkbox"
                      required
                      checked={emailConsent}
                      onChange={(e) => setEmailConsent(e.target.checked)}
                      className="mt-0.5 accent-[#D4AF37]"
                    />
                    I agree to receive marketing emails from Pepscore Lab about this offer.
                  </label>
                  <label className="flex items-start gap-2.5 text-[12px] text-white/55 leading-relaxed">
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={(e) => setSmsConsent(e.target.checked)}
                      className="mt-0.5 accent-[#D4AF37]"
                    />
                    Also text me about this offer (optional). Message and data rates may apply.
                  </label>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting…' : `Claim ${discountLabel}`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
