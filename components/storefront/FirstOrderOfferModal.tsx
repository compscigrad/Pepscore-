'use client'

// FIRST10 claim modal -- deliberately its own component rather than a
// LeadCaptureTrigger variant, since its validation shape differs (email
// AND phone both required, not "at least one") and its copy/consent
// language is specific to a discount offer, not a general contact request.
// Same self-contained trigger+modal pattern as LeadCaptureTrigger.tsx
// (renders its own button rather than accepting a render-prop) so it can
// be dropped into a Server Component (Footer.tsx) as one client island.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { getAttribution } from '@/lib/storefront/attribution'

export interface FirstOrderOfferModalProps {
  percentage: number
  triggerLabel: string
  triggerClassName: string
}

const inputCls =
  'w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'

export function FirstOrderOfferModal({ percentage, triggerLabel, triggerClassName }: FirstOrderOfferModalProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      toast.error('Please confirm you agree to be contacted to claim this offer.')
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
          consent,
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
      toast.success(
        responseData?.alreadyClaimed
          ? "You've already claimed this offer — check your email for details."
          : "You're in! We'll follow up with your discount code shortly."
      )
    } catch {
      toast.error('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    if (submitting) return
    setOpen(false)
    setClaimed(false)
    setName('')
    setEmail('')
    setPhone('')
    setConsent(false)
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

            {claimed ? (
              <div className="py-4">
                <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">You&apos;re all set</h2>
                <p className="text-[13px] text-white/60 leading-relaxed">
                  We&apos;ll follow up by email with your {percentage}% first-order code and how to use it.
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-heading text-[19px] font-bold text-white mb-1.5">Get {percentage}% Off Your First Order</h2>
                <p className="text-[13px] text-white/55 leading-relaxed mb-5">
                  Leave your email and phone number and we&apos;ll send you a code for {percentage}% off your first order. One offer per customer.
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
                  <label className="flex items-start gap-2.5 text-[12px] text-white/55 leading-relaxed pt-1">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 accent-[#D4AF37]"
                    />
                    I agree to receive marketing emails and texts from Pepscore Lab about this offer. Message and data rates may apply.
                  </label>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting…' : `Claim ${percentage}% Off`}
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
