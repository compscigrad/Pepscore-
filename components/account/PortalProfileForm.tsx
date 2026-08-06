'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

const label = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5'
const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30'

interface Address {
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
}

function emptyAddress(): Address {
  return { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' }
}

function toAddress(value: unknown): Address {
  if (!value || typeof value !== 'object') return emptyAddress()
  const a = value as Record<string, string | undefined>
  return {
    street1: a.street1 ?? '',
    street2: a.street2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    zip: a.zip ?? '',
    country: a.country ?? 'US',
  }
}

export interface PortalProfileFormProps {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  billingAddress: unknown
  shippingAddress: unknown
  preferredContactMethod: string | null
}

export function PortalProfileForm(props: PortalProfileFormProps) {
  const [firstName, setFirstName] = useState(props.firstName)
  const [lastName, setLastName] = useState(props.lastName)
  const [phone, setPhone] = useState(props.phone ?? '')
  const [billing, setBilling] = useState<Address>(toAddress(props.billingAddress))
  const [shipping, setShipping] = useState<Address>(toAddress(props.shippingAddress))
  const [contactMethod, setContactMethod] = useState(props.preferredContactMethod ?? '')
  const [requestedEmail, setRequestedEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || null,
          billingAddress: billing,
          shippingAddress: shipping,
          preferredContactMethod: contactMethod || null,
          requestedEmail: requestedEmail || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update profile')
      toast.success(data.emailChangeRequested ? 'Profile updated — email change request sent for review' : 'Profile updated')
      setRequestedEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="firstName">First Name</label>
            <input id="firstName" className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="lastName">Last Name</label>
            <input id="lastName" className={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="phone">Phone</label>
            <input id="phone" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="contactMethod">Preferred Contact Method</label>
            <select id="contactMethod" className={input} value={contactMethod} onChange={(e) => setContactMethod(e.target.value)}>
              <option value="">No preference</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">Text message</option>
              <option value="PHONE">Phone call</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10">
          <label className={label} htmlFor="currentEmail">Current Email</label>
          <input id="currentEmail" className={`${input} opacity-60`} value={props.email ?? '—'} disabled />
          <label className={`${label} mt-3`} htmlFor="requestedEmail">Request a New Email</label>
          <input
            id="requestedEmail"
            type="email"
            className={input}
            value={requestedEmail}
            onChange={(e) => setRequestedEmail(e.target.value)}
            placeholder="Leave blank to keep your current email"
          />
          <p className="text-white/40 text-xs mt-1.5">
            Email changes are reviewed by our team before taking effect — this keeps your account secure.
          </p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Billing Address</h2>
        <AddressFields value={billing} onChange={setBilling} prefix="billing" />
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Shipping Address</h2>
        <AddressFields value={shipping} onChange={setShipping} prefix="shipping" />
      </div>

      <button type="submit" disabled={saving} className="w-full sm:w-auto rounded-full bg-gold text-dark font-bold text-sm px-8 py-2.5 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

function AddressFields({ value, onChange, prefix }: { value: Address; onChange: (a: Address) => void; prefix: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={label} htmlFor={`${prefix}-street1`}>Street Address</label>
        <input id={`${prefix}-street1`} className={input} value={value.street1} onChange={(e) => onChange({ ...value, street1: e.target.value })} />
      </div>
      <div>
        <label className={label} htmlFor={`${prefix}-city`}>City</label>
        <input id={`${prefix}-city`} className={input} value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor={`${prefix}-state`}>State</label>
          <input id={`${prefix}-state`} className={input} value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor={`${prefix}-zip`}>ZIP</label>
          <input id={`${prefix}-zip`} className={input} value={value.zip} onChange={(e) => onChange({ ...value, zip: e.target.value })} />
        </div>
      </div>
    </div>
  )
}
