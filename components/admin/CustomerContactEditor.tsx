// Admin edit affordance for a customer's core contact fields AND their
// permanent billing/shipping address — the "Edit Contact" gap this used to
// have: it could edit name/email/phone but had no address fields at all,
// so there was no way to fix an address the admin noticed was wrong (or,
// as with the 2026-08-06 linkage-backfill oversight, was simply never
// copied over from the invoice snapshot that created the record). This
// only ever writes the Customer's own address fields -- editing an
// invoice's billing/shipping snapshot is a separate, already-existing
// affordance on the invoice itself (components/invoices/CustomerInfoSection.tsx
// and ShippingSection.tsx), and issued invoices are never touched from here.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { input as inputClass, pillPrimary, pillOutline } from '@/components/invoices/theme'
import { useZipLookup } from '@/components/invoices/useZipLookup'

interface AddressValue {
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
}

const EMPTY_ADDRESS: AddressValue = { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' }

function toAddressValue(value: unknown): AddressValue {
  if (!value || typeof value !== 'object') return { ...EMPTY_ADDRESS }
  const a = value as Record<string, unknown>
  return {
    street1: typeof a.street1 === 'string' ? a.street1 : '',
    street2: typeof a.street2 === 'string' ? a.street2 : '',
    city: typeof a.city === 'string' ? a.city : '',
    state: typeof a.state === 'string' ? a.state : '',
    zip: typeof a.zip === 'string' ? a.zip : '',
    country: typeof a.country === 'string' && a.country ? a.country : 'US',
  }
}

interface Props {
  customerId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  company: string | null
  billingAddress: unknown
  shippingAddress: unknown
}

export function CustomerContactEditor(props: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(props.firstName)
  const [lastName, setLastName] = useState(props.lastName)
  const [email, setEmail] = useState(props.email ?? '')
  const [phone, setPhone] = useState(props.phone ?? '')
  const [company, setCompany] = useState(props.company ?? '')
  const [billingAddress, setBillingAddress] = useState<AddressValue>(() => toAddressValue(props.billingAddress))
  const [shippingAddress, setShippingAddress] = useState<AddressValue>(() => toAddressValue(props.shippingAddress))
  const [sameAsBilling, setSameAsBilling] = useState(
    () => JSON.stringify(toAddressValue(props.billingAddress)) === JSON.stringify(toAddressValue(props.shippingAddress)) && toAddressValue(props.billingAddress).street1 !== ''
  )
  const [saving, setSaving] = useState(false)

  const { handleZipChange: handleBillingZip, status: billingZipStatus, message: billingZipMessage } = useZipLookup(({ city, state }) => {
    setBillingAddress((a) => ({ ...a, city, state }))
  })
  const { handleZipChange: handleShippingZip, status: shippingZipStatus, message: shippingZipMessage } = useZipLookup(({ city, state }) => {
    setShippingAddress((a) => ({ ...a, city, state }))
  })

  if (!editing) {
    return (
      <button type="button" className={`${pillOutline} px-3 py-1.5 text-xs`} onClick={() => setEditing(true)}>
        Edit Contact
      </button>
    )
  }

  function setBilling<K extends keyof AddressValue>(field: K, value: string) {
    setBillingAddress((a) => ({ ...a, [field]: value }))
  }
  function setShipping<K extends keyof AddressValue>(field: K, value: string) {
    setShippingAddress((a) => ({ ...a, [field]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        company: company || null,
      }
      // Same pattern as the invoice builder's save(): only send an address
      // when it actually has a street -- an incomplete/never-touched
      // address must never be sent as a partial overwrite, and this repo's
      // addressSchema requires street1/city/state to be non-empty anyway.
      if (billingAddress.street1.trim()) body.billingAddress = billingAddress
      if (sameAsBilling) {
        if (billingAddress.street1.trim()) body.shippingAddress = billingAddress
      } else if (shippingAddress.street1.trim()) {
        body.shippingAddress = shippingAddress
      }

      const res = await fetch(`/api/admin/customers/${props.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Contact info updated')
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const addressFieldClass = (disabled: boolean) => (disabled ? `${inputClass} opacity-50 cursor-not-allowed` : inputClass)

  return (
    <div className="space-y-4 pt-2 border-t border-white/10">
      <div className="grid grid-cols-2 gap-2">
        <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
        <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
      </div>
      <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />

      <div>
        <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5">Billing Address</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input className={`${inputClass} sm:col-span-2`} placeholder="Street address" value={billingAddress.street1} onChange={(e) => setBilling('street1', e.target.value)} />
          <input className={`${inputClass} sm:col-span-2`} placeholder="Apt, suite, unit (optional)" value={billingAddress.street2} onChange={(e) => setBilling('street2', e.target.value)} />
          <input className={inputClass} placeholder="City" value={billingAddress.city} onChange={(e) => setBilling('city', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="State" value={billingAddress.state} onChange={(e) => setBilling('state', e.target.value)} />
            <div>
              <input
                className={inputClass}
                placeholder="ZIP"
                value={billingAddress.zip}
                onChange={(e) => {
                  setBilling('zip', e.target.value)
                  handleBillingZip(e.target.value)
                }}
              />
              {billingZipStatus === 'loading' && <p className="text-[10px] text-white/40 mt-1">Looking up…</p>}
              {billingZipStatus === 'error' && billingZipMessage && <p className="text-[10px] text-red-400 mt-1">{billingZipMessage}</p>}
            </div>
          </div>
          <input className={inputClass} placeholder="Country" value={billingAddress.country} onChange={(e) => setBilling('country', e.target.value)} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Shipping Address</p>
          <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
            <input type="checkbox" className="rounded border-white/20 bg-white/5 text-gold focus:ring-gold/40" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} />
            Same as billing
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            className={`${addressFieldClass(sameAsBilling)} sm:col-span-2`}
            placeholder="Street address"
            value={sameAsBilling ? billingAddress.street1 : shippingAddress.street1}
            disabled={sameAsBilling}
            onChange={(e) => setShipping('street1', e.target.value)}
          />
          <input
            className={`${addressFieldClass(sameAsBilling)} sm:col-span-2`}
            placeholder="Apt, suite, unit (optional)"
            value={sameAsBilling ? billingAddress.street2 : shippingAddress.street2}
            disabled={sameAsBilling}
            onChange={(e) => setShipping('street2', e.target.value)}
          />
          <input
            className={addressFieldClass(sameAsBilling)}
            placeholder="City"
            value={sameAsBilling ? billingAddress.city : shippingAddress.city}
            disabled={sameAsBilling}
            onChange={(e) => setShipping('city', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={addressFieldClass(sameAsBilling)}
              placeholder="State"
              value={sameAsBilling ? billingAddress.state : shippingAddress.state}
              disabled={sameAsBilling}
              onChange={(e) => setShipping('state', e.target.value)}
            />
            <div>
              <input
                className={addressFieldClass(sameAsBilling)}
                placeholder="ZIP"
                value={sameAsBilling ? billingAddress.zip : shippingAddress.zip}
                disabled={sameAsBilling}
                onChange={(e) => {
                  setShipping('zip', e.target.value)
                  handleShippingZip(e.target.value)
                }}
              />
              {!sameAsBilling && shippingZipStatus === 'loading' && <p className="text-[10px] text-white/40 mt-1">Looking up…</p>}
              {!sameAsBilling && shippingZipStatus === 'error' && shippingZipMessage && <p className="text-[10px] text-red-400 mt-1">{shippingZipMessage}</p>}
            </div>
          </div>
          <input
            className={addressFieldClass(sameAsBilling)}
            placeholder="Country"
            value={sameAsBilling ? billingAddress.country : shippingAddress.country}
            disabled={sameAsBilling}
            onChange={(e) => setShipping('country', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" className={`${pillPrimary} px-4 py-1.5 text-xs`} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={`${pillOutline} px-4 py-1.5 text-xs`} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
