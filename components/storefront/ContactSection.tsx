// Real contact/wholesale-inquiry form — replaces the old `#contact` anchor
// that scrolled to a static, non-clickable email address in the footer with
// zero submission mechanism. Posts to app/api/contact/route.ts, which
// routes through the centralized email system (lib/notifications/log.ts)
// already used everywhere else in this app.
'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full rounded-md border border-g100 bg-white px-4 py-3 text-[14px] text-dark placeholder:text-g500/70 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40'

export function ContactSection() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot — never shown to a real visitor (visually hidden, not just
  // display:none, so it still receives focus/fill from unsophisticated bots
  // that skip CSS-hidden fields but not off-screen ones).
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || undefined, company: company || undefined, message, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setStatus('success')
      setName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <section id="contact" className="py-24 px-6 bg-white">
      <div className="max-w-[640px] mx-auto">
        <div className="text-center mb-11">
          <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3 block">Get In Touch</span>
          <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">Contact Us</h2>
          <p className="text-[16px] font-light text-g500 max-w-[480px] mx-auto leading-[1.7]">
            Questions, bulk pricing, or a custom research quote — send us a message and our team will follow up.
          </p>
          <div className="w-11 h-[3px] bg-gold mx-auto mt-3.5 rounded-full" />
        </div>

        {status === 'success' ? (
          <div className="bg-gold/10 border border-gold/30 rounded-2xl p-8 text-center">
            <p className="font-heading text-[16px] font-bold text-dark mb-1.5">Message sent</p>
            <p className="text-[14px] text-g700">Thanks for reaching out — we&apos;ll be in touch shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field — visually hidden via the standard clip-based
                sr-only technique (never pushes content off-canvas/creates
                horizontal overflow the way a large negative offset would),
                and shielded from real assistive-tech users via aria-hidden
                + tabIndex=-1 so only an unsophisticated bot ever fills it. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                required
                placeholder="Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                required
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Company (optional)"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
              />
            </div>
            <textarea
              required
              rows={5}
              placeholder="How can we help? Include product, quantity, or research application details for bulk quotes."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputClass}
            />

            {status === 'error' && errorMessage ? (
              <p className="text-[13px] text-red-600">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-md transition-all hover:-translate-y-0.5 hover:shadow-gold disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {status === 'submitting' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
