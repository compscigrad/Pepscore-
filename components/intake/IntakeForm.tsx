'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useIntakeZipLookup } from './useIntakeZipLookup'

interface AddressState {
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
}

const EMPTY_ADDRESS: AddressState = { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' }

const CONTACT_METHODS = [
  { value: '', label: 'No preference' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'Text message' },
  { value: 'PHONE', label: 'Phone call' },
]

const PAYMENT_METHODS = [
  { value: '', label: 'No preference' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'CASH_APP', label: 'Cash App' },
  { value: 'VENMO', label: 'Venmo' },
  { value: 'APPLE_PAY', label: 'Apple Pay' },
  { value: 'ACH', label: 'Bank transfer (ACH)' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'DEBIT_CARD', label: 'Debit card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
]

const label = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5'
const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30'
const card = 'bg-white/[0.03] border border-gold/10 rounded-[18px]'

interface Props {
  token: string
  alreadySubmittedAt: string | null
}

export function IntakeForm({ token, alreadySubmittedAt }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [preferredContactMethod, setPreferredContactMethod] = useState('')
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this

  const [billing, setBilling] = useState<AddressState>(EMPTY_ADDRESS)
  const [shipping, setShipping] = useState<AddressState>(EMPTY_ADDRESS)
  const [sameAsBilling, setSameAsBilling] = useState(true)

  const billingZip = useIntakeZipLookup(token, ({ city, state }) => {
    setBilling((b) => ({ ...b, city, state }))
    if (sameAsBilling) setShipping((s) => ({ ...s, city, state }))
  })
  const shippingZip = useIntakeZipLookup(token, ({ city, state }) => setShipping((s) => ({ ...s, city, state })))

  function updateBilling(patch: Partial<AddressState>) {
    setBilling((b) => {
      const next = { ...b, ...patch }
      if (sameAsBilling) setShipping(next)
      return next
    })
  }

  function toggleSameAsBilling(checked: boolean) {
    setSameAsBilling(checked)
    if (checked) setShipping(billing)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter your first and last name')
      return
    }
    if (!email.trim() && !phone.trim()) {
      toast.error('Please provide an email or phone number')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          company: company || undefined,
          email: email || undefined,
          phone: phone || undefined,
          billingAddress: billing.street1 ? billing : undefined,
          shippingAddress: shipping.street1 ? shipping : undefined,
          preferredContactMethod: preferredContactMethod || undefined,
          preferredPaymentMethod: preferredPaymentMethod || undefined,
          notes: notes || undefined,
          website,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong — please try again.')
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className={`${card} max-w-md w-full p-8 text-center`}>
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-lg font-bold text-white mb-2">Thank you!</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Your information has been received. We&apos;ll be in touch shortly to finalize your order.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-dark px-4 py-10">
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
        <div className="text-center mb-2">
          <h1 className="font-heading text-2xl font-bold text-gold tracking-[0.1em]">PEPSCORE</h1>
          <p className="text-white/50 text-xs uppercase tracking-[0.2em] mt-1">Customer Information</p>
        </div>

        {alreadySubmittedAt ? (
          <div className={`${card} px-4 py-3 text-sm text-white/60`}>
            You already submitted this form on {new Date(alreadySubmittedAt).toLocaleDateString()}. Submitting again
            will update the information we have on file.
          </div>
        ) : null}

        <div className={`${card} p-6 space-y-4`}>
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Your Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>First Name *</label>
              <input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className={label}>Last Name *</label>
              <input className={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={label}>Company (optional)</label>
            <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Email</label>
              <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <p className="text-white/40 text-xs">Provide at least an email or phone number so we can reach you.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Preferred Contact Method</label>
              <select
                className={input}
                value={preferredContactMethod}
                onChange={(e) => setPreferredContactMethod(e.target.value)}
              >
                {CONTACT_METHODS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Preferred Payment Method</label>
              <select
                className={input}
                value={preferredPaymentMethod}
                onChange={(e) => setPreferredPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={`${card} p-6 space-y-4`}>
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Billing Address</h2>
          <div>
            <label className={label}>Street Address</label>
            <input
              className={input}
              value={billing.street1}
              onChange={(e) => updateBilling({ street1: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Address Line 2</label>
            <input
              className={input}
              value={billing.street2}
              onChange={(e) => updateBilling({ street2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>ZIP</label>
              <input
                className={input}
                value={billing.zip}
                onChange={(e) => {
                  updateBilling({ zip: e.target.value })
                  billingZip.handleZipChange(e.target.value)
                }}
              />
              {billingZip.status === 'loading' ? <p className="text-white/40 text-xs mt-1">Looking up...</p> : null}
              {billingZip.status === 'error' && billingZip.message ? (
                <p className="text-amber-400/80 text-xs mt-1">{billingZip.message}</p>
              ) : null}
            </div>
            <div>
              <label className={label}>City</label>
              <input className={input} value={billing.city} onChange={(e) => updateBilling({ city: e.target.value })} />
            </div>
            <div>
              <label className={label}>State</label>
              <input
                className={input}
                value={billing.state}
                onChange={(e) => updateBilling({ state: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className={`${card} p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Shipping Address</h2>
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => toggleSameAsBilling(e.target.checked)}
                className="accent-gold"
              />
              Same as billing
            </label>
          </div>
          <div>
            <label className={label}>Street Address</label>
            <input
              className={`${input} ${sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={shipping.street1}
              disabled={sameAsBilling}
              onChange={(e) => setShipping((s) => ({ ...s, street1: e.target.value }))}
            />
          </div>
          <div>
            <label className={label}>Address Line 2</label>
            <input
              className={`${input} ${sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={shipping.street2}
              disabled={sameAsBilling}
              onChange={(e) => setShipping((s) => ({ ...s, street2: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>ZIP</label>
              <input
                className={`${input} ${sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={shipping.zip}
                disabled={sameAsBilling}
                onChange={(e) => {
                  setShipping((s) => ({ ...s, zip: e.target.value }))
                  shippingZip.handleZipChange(e.target.value)
                }}
              />
              {!sameAsBilling && shippingZip.status === 'loading' ? (
                <p className="text-white/40 text-xs mt-1">Looking up...</p>
              ) : null}
              {!sameAsBilling && shippingZip.status === 'error' && shippingZip.message ? (
                <p className="text-amber-400/80 text-xs mt-1">{shippingZip.message}</p>
              ) : null}
            </div>
            <div>
              <label className={label}>City</label>
              <input
                className={`${input} ${sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={shipping.city}
                disabled={sameAsBilling}
                onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
              />
            </div>
            <div>
              <label className={label}>State</label>
              <input
                className={`${input} ${sameAsBilling ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={shipping.state}
                disabled={sameAsBilling}
                onChange={(e) => setShipping((s) => ({ ...s, state: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className={`${card} p-6`}>
          <label className={label}>Notes (optional)</label>
          <textarea
            className={`${input} min-h-[80px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else you'd like us to know"
          />
        </div>

        {/* Honeypot — invisible to real visitors, a filled-in bot gets a
            silent fake-success from the server instead of real processing. */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-gold text-white text-sm font-bold py-3 hover:bg-gold-dark transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </main>
  )
}
