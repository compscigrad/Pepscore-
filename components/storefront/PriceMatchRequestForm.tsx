// The Price Match Guarantee request form (2026-08-20 Price Match sprint) --
// a dedicated page rather than the generic LeadCaptureTrigger modal a prior
// sprint wired the Footer's "Request a Price Match" link to (a bare
// message field, no product/competitor/price structure, no review queue --
// exactly the "generic contact form treated as complete" this sprint's
// spec explicitly warns against). Posts to /api/price-match, which creates
// a real PriceMatchRequest row (see lib/priceMatch/requests.ts) -- the
// database is the system of record, not this form or its confirmation
// email.
'use client'

import { useEffect, useState } from 'react'
import { ScientificBackground } from './ScientificBackground'
import { getAttribution } from '@/lib/storefront/attribution'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'
import { SELL_UNIT_DISPLAY_LABEL, type SellUnit } from '@/lib/pricing/sellUnits'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]/50 transition-colors'
const labelClass = 'block text-[11px] font-heading font-bold uppercase tracking-[0.06em] text-white/50 mb-1.5'
const SELL_UNITS: SellUnit[] = ['CASE_STANDARD', 'CASE_PRO', 'CASE_BULK', 'INDIVIDUAL_VIAL']

export interface PriceMatchProductOption {
  id: string
  name: string
  size: string
}

export interface PriceMatchRequestFormProps {
  products: PriceMatchProductOption[]
  initialProductId?: string
}

export function PriceMatchRequestForm({ products, initialProductId }: PriceMatchRequestFormProps) {
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? '')
  const [sellUnit, setSellUnit] = useState<SellUnit>('CASE_STANDARD')
  const [competitorName, setCompetitorName] = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [competitorPrice, setCompetitorPrice] = useState('')
  const [competitorShippingCost, setCompetitorShippingCost] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [consent, setConsent] = useState(false)
  // Honeypot -- visually hidden, never seen by a real visitor.
  const [website2, setWebsite2] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // View tracking only -- the authoritative "submitted" signal is fired
  // server-side (lib/priceMatch/requests.ts) once the request has actually
  // been persisted, not optimistically here on form submit.
  useEffect(() => {
    trackEvent(AnalyticsEvent.PRICE_MATCH_FORM_VIEWED)
  }, [])

  const price = parseFloat(competitorPrice)
  const shipping = competitorShippingCost ? parseFloat(competitorShippingCost) : 0
  const deliveredPrice = Number.isFinite(price) ? Math.round((price + (Number.isFinite(shipping) ? shipping : 0)) * 100) / 100 : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (deliveredPrice === null) {
      setStatus('error')
      setErrorMessage('Enter the competitor’s listed price.')
      return
    }
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const attribution = getAttribution()
      const res = await fetch('/api/price-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          productId,
          sellUnit,
          competitorName,
          competitorUrl: competitorUrl || undefined,
          competitorPrice: price,
          competitorShippingCost: competitorShippingCost ? shipping : undefined,
          competitorDeliveredPrice: deliveredPrice,
          proofUrl: proofUrl || undefined,
          customerNote: customerNote || undefined,
          consent,
          sourcePage: '/price-match',
          referrer: attribution?.referrer ?? null,
          landingUrl: attribution?.landingUrl ?? null,
          website2,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <section className="relative overflow-hidden bg-black min-h-screen py-20 px-6">
      <ScientificBackground intensity="medium" position="object-right-top" zoom={1.8} fadeLeft fadeBottom />
      <div className="max-w-[640px] mx-auto relative">
        <div className="text-center mb-11">
          <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Price Match Guarantee</span>
          <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-3">Request a Price Match</h1>
          <p className="text-[16px] font-light text-white/55 max-w-[480px] mx-auto leading-[1.7]">
            Found a lower delivered price elsewhere? Tell us where, and our team will review it against our current
            pricing.
          </p>
          <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mx-auto mt-3.5 rounded-full" />
        </div>

        {status === 'success' ? (
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-8 text-center">
            <p className="font-heading text-[16px] font-bold text-white mb-1.5">Request received</p>
            <p className="text-[14px] text-white/60">
              Thanks — we review every request by hand and will follow up by email shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website2">Website</label>
              <input id="website2" name="website2" type="text" tabIndex={-1} autoComplete="off" value={website2} onChange={(e) => setWebsite2(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="contactName">Name *</label>
                <input id="contactName" required value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="contactEmail">Email *</label>
                <input id="contactEmail" type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="contactPhone">Phone</label>
                <input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="sellUnit">Purchase Type *</label>
                <select id="sellUnit" required value={sellUnit} onChange={(e) => setSellUnit(e.target.value as SellUnit)} className={inputClass}>
                  {SELL_UNITS.map((u) => (
                    <option key={u} value={u}>{SELL_UNIT_DISPLAY_LABEL[u]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="productId">Pepscore Lab Product *</label>
              <select id="productId" required value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.size})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="competitorName">Where You Found It *</label>
                <input id="competitorName" required value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} className={inputClass} placeholder="Competitor / source name" />
              </div>
              <div>
                <label className={labelClass} htmlFor="competitorUrl">Link (optional)</label>
                <input id="competitorUrl" value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </div>
              <div>
                <label className={labelClass} htmlFor="competitorPrice">Their Listed Price *</label>
                <input id="competitorPrice" type="number" step="0.01" min="0" required value={competitorPrice} onChange={(e) => setCompetitorPrice(e.target.value)} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass} htmlFor="competitorShippingCost">Their Shipping Cost</label>
                <input id="competitorShippingCost" type="number" step="0.01" min="0" value={competitorShippingCost} onChange={(e) => setCompetitorShippingCost(e.target.value)} className={inputClass} placeholder="0.00" />
              </div>
            </div>

            {deliveredPrice !== null && (
              <p className="text-[12px] text-white/50">
                Total delivered price we&apos;ll review: <span className="text-[#D4AF37] font-bold">${deliveredPrice.toFixed(2)}</span>
              </p>
            )}

            <div>
              <label className={labelClass} htmlFor="proofUrl">Proof Link (screenshot, listing, etc.)</label>
              <input id="proofUrl" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} className={inputClass} placeholder="https://" />
            </div>

            <div>
              <label className={labelClass} htmlFor="customerNote">Anything else we should know?</label>
              <textarea id="customerNote" rows={3} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} className={inputClass} />
            </div>

            <label className="flex items-start gap-2.5 text-[12px] text-white/60 leading-relaxed">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>
                I confirm the information above is accurate and agree to be contacted about this request. Price
                matches are reviewed against the total delivered price from a verifiable source and are granted at
                Pepscore Lab&apos;s discretion.
              </span>
            </label>

            {status === 'error' && errorMessage ? <p className="text-[13px] text-red-400">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(212,175,55,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
