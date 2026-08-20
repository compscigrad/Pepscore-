// The Professional Access application form (2026-08-19 Professional Access
// sprint, section 10) -- a dedicated page rather than a small popup, since
// a real business-verification application needs more room than
// LeadCaptureTrigger's modal was ever meant to hold. Posts to
// /api/professional-access/apply, which extends the existing lead-capture
// architecture (see lib/professionalAccess/applications.ts) rather than
// replacing it. Deliberately never asks the applicant to claim or certify
// intended human use -- purposeDescription only ever captures a business/
// research purpose in the applicant's own words.
'use client'

import { useState } from 'react'
import { ScientificBackground } from './ScientificBackground'
import { getAttribution } from '@/lib/storefront/attribution'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]/50 transition-colors'
const labelClass = 'block text-[11px] font-heading font-bold uppercase tracking-[0.06em] text-white/50 mb-1.5'

export function ProfessionalAccessApplicationForm() {
  const [contactName, setContactName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [registrationInfo, setRegistrationInfo] = useState('')
  const [expectedVolume, setExpectedVolume] = useState('')
  const [purposeDescription, setPurposeDescription] = useState('')
  const [consent, setConsent] = useState(false)
  // Honeypot -- visually hidden, never seen by a real visitor.
  const [website2, setWebsite2] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const attribution = getAttribution()
      const res = await fetch('/api/professional-access/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName,
          businessName,
          businessEmail,
          phone: phone || undefined,
          website: website || undefined,
          businessType: businessType || undefined,
          jurisdiction: jurisdiction || undefined,
          registrationInfo: registrationInfo || undefined,
          expectedVolume: expectedVolume || undefined,
          purposeDescription: purposeDescription || undefined,
          consent,
          sourcePage: '/professional-access/apply',
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
          <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Professional Access</span>
          <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-3">Apply for Professional Access</h1>
          <p className="text-[16px] font-light text-white/55 max-w-[480px] mx-auto leading-[1.7]">
            Preferred case pricing for verified businesses and qualified research organizations. Tell us about your
            organization and our team will follow up.
          </p>
          <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mx-auto mt-3.5 rounded-full" />
        </div>

        {status === 'success' ? (
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-8 text-center">
            <p className="font-heading text-[16px] font-bold text-white mb-1.5">Application received</p>
            <p className="text-[14px] text-white/60">
              Thanks for applying — we review every application by hand and will follow up by email shortly.
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
                <label className={labelClass} htmlFor="contactName">Contact Name *</label>
                <input id="contactName" required value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="businessEmail">Business Email *</label>
                <input id="businessEmail" type="email" required value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="businessName">Business / Organization Name *</label>
                <input id="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="phone">Phone</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="website">Business Website</label>
                <input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="https://" />
              </div>
              <div>
                <label className={labelClass} htmlFor="businessType">Business Type</label>
                <input id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} placeholder="e.g. Research lab, distributor" />
              </div>
              <div>
                <label className={labelClass} htmlFor="jurisdiction">State / Jurisdiction</label>
                <input id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="expectedVolume">Expected Purchasing Volume</label>
                <input id="expectedVolume" value={expectedVolume} onChange={(e) => setExpectedVolume(e.target.value)} className={inputClass} placeholder="e.g. 5-10 cases/month" />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="registrationInfo">Business Registration (optional)</label>
              <input id="registrationInfo" value={registrationInfo} onChange={(e) => setRegistrationInfo(e.target.value)} className={inputClass} placeholder="EIN, state registration number, etc." />
            </div>

            <div>
              <label className={labelClass} htmlFor="purposeDescription">Tell Us About Your Research or Business Use</label>
              <textarea
                id="purposeDescription"
                rows={4}
                value={purposeDescription}
                onChange={(e) => setPurposeDescription(e.target.value)}
                className={inputClass}
                placeholder="Describe your organization's research or business purpose."
              />
            </div>

            <label className="flex items-start gap-2.5 text-[12px] text-white/60 leading-relaxed">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>
                I confirm the information above is accurate and understand Professional Access changes case pricing and purchasing terms only —
                it does not change the Research Use Only status or labeling of any product. I agree to be contacted about this application.
              </span>
            </label>

            {status === 'error' && errorMessage ? <p className="text-[13px] text-red-400">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(212,175,55,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
