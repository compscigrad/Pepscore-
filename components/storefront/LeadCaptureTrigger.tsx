'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { getAttribution } from '@/lib/storefront/attribution'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

export type LeadInterestType =
  | 'GENERAL_UPDATES'
  | 'LAUNCH_NOTIFICATION'
  | 'PRODUCT_INTEREST'
  | 'NOTIFY_WHEN_AVAILABLE'
  | 'OUT_OF_STOCK_INTEREST'
  | 'PRICING_REVIEW_INTEREST'
  | 'SPA_WHOLESALE_INQUIRY'
  | 'SINGLE_VIAL_SPECIAL_REQUEST'

export interface LeadCaptureTriggerProps {
  interestType: LeadInterestType
  productSlug?: string
  productName?: string
  productSize?: string
  modalTitle: string
  modalDescription?: string
  showMessageField?: boolean
  // The trigger button's own label/className — rendered inside this
  // component rather than accepted as a render-prop function, since a
  // function can't be passed as a prop from a Server Component parent
  // (Footer.tsx, app/page.tsx) across the client-component boundary.
  triggerLabel: string
  triggerClassName: string
  // Optional (2026-08-15 fulfillment/availability sprint) -- fired when the
  // trigger opens the modal, before any submission. A plain callback (not a
  // render-prop) is safe to pass here since it's a simple void function,
  // unlike triggerLabel/triggerClassName's cross-boundary restriction
  // above. Used for click-intent analytics (e.g. Single Vial Special
  // Request) distinct from LEAD_CAPTURE_SUBMIT, which only fires on a
  // completed submission.
  onOpen?: () => void
}

const inputCls =
  'w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'

// Self-contained trigger + modal so it can be dropped into a server
// component (e.g. app/page.tsx's Bulk section, Footer.tsx) as a single
// 'use client' island, or reused inside an already-client component
// (ProductDetail.tsx) the same way.
export function LeadCaptureTrigger({
  interestType,
  productSlug,
  productName,
  productSize,
  modalTitle,
  modalDescription,
  showMessageField,
  triggerLabel,
  triggerClassName,
  onOpen,
}: LeadCaptureTriggerProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot

  function reset() {
    setName('')
    setEmail('')
    setPhone('')
    setMessage('')
    setConsent(false)
    setWebsite('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      toast.error('Please confirm you agree to be contacted.')
      return
    }
    setSubmitting(true)
    try {
      const attribution = getAttribution()
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          interestType,
          productSlug,
          productName,
          productSize,
          message: message || undefined,
          sourcePage: window.location.pathname,
          consent,
          website,
          ...attribution,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Something went wrong — please try again.')
        return
      }
      trackEvent(AnalyticsEvent.LEAD_CAPTURE_SUBMIT, { interestType, productSlug: productSlug ?? null })
      toast.success("Thanks — we'll be in touch shortly.")
      reset()
      setOpen(false)
    } catch {
      toast.error('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          onOpen?.()
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => !submitting && setOpen(false)} />
          <div className="relative bg-black border border-[#D4AF37]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-w-md w-full p-7">
            <button
              onClick={() => !submitting && setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">{modalTitle}</h2>
            {modalDescription && <p className="text-[13px] text-white/55 leading-relaxed mb-5">{modalDescription}</p>}

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
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
              {showMessageField && (
                <textarea
                  placeholder="Anything else we should know? (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className={inputCls}
                />
              )}
              {/* Honeypot — hidden from real visitors via CSS, never via type="hidden" (some bots skip those) */}
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="absolute left-[-9999px] w-px h-px opacity-0"
                aria-hidden="true"
              />
              <label className="flex items-start gap-2.5 text-[12px] text-white/55 leading-relaxed pt-1">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-[#D4AF37]"
                />
                I agree to be contacted by Pepscore Lab about this request.
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
