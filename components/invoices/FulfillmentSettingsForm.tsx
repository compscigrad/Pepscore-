'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, input, label as labelClass, pillPrimary, sectionHeading } from './theme'
import type { AddressInput } from '@/lib/shippo'

interface Props {
  initialReturnAddress: AddressInput | null
  initialDefaultWeightOz: number | null
  initialDefaultLengthIn: number | null
  initialDefaultWidthIn: number | null
  initialDefaultHeightIn: number | null
}

const EMPTY_ADDRESS: AddressInput = { name: '', street1: '', city: '', state: '', zip: '', country: 'US' }

export function FulfillmentSettingsForm({
  initialReturnAddress,
  initialDefaultWeightOz,
  initialDefaultLengthIn,
  initialDefaultWidthIn,
  initialDefaultHeightIn,
}: Props) {
  const [address, setAddress] = useState<AddressInput>(initialReturnAddress ?? EMPTY_ADDRESS)
  const [weightOz, setWeightOz] = useState(initialDefaultWeightOz ?? 0)
  const [lengthIn, setLengthIn] = useState(initialDefaultLengthIn ?? 0)
  const [widthIn, setWidthIn] = useState(initialDefaultWidthIn ?? 0)
  const [heightIn, setHeightIn] = useState(initialDefaultHeightIn ?? 0)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/fulfillment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnAddress: address,
          defaultWeightOz: weightOz || null,
          defaultLengthIn: lengthIn || null,
          defaultWidthIn: widthIn || null,
          defaultHeightIn: heightIn || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      toast.success('Fulfillment settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-2xl`}>
      <h2 className={`${sectionHeading} mb-1`}>Return address &amp; package defaults</h2>
      <p className="text-white/50 text-sm mb-4">
        Used as the &quot;ship from&quot; address for every rate quote and label purchase, plus the
        defaults pre-filled on a new shipment (still editable per-shipment).
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2">
          <label className={labelClass} htmlFor="fsName">Sender Name</label>
          <input id="fsName" className={input} value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className={labelClass} htmlFor="fsStreet1">Street Address</label>
          <input id="fsStreet1" className={input} value={address.street1} onChange={(e) => setAddress({ ...address, street1: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsCity">City</label>
          <input id="fsCity" className={input} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsState">State</label>
          <input id="fsState" className={input} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsZip">ZIP</label>
          <input id="fsZip" className={input} value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsPhone">Phone</label>
          <input id="fsPhone" className={input} value={address.phone ?? ''} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
        </div>
      </div>

      <p className={`${labelClass} mb-2`}>Default Package Dimensions</p>
      <div className="flex flex-wrap gap-3 mb-2">
        <div>
          <label className={labelClass} htmlFor="fsWeight">Weight (oz)</label>
          <input id="fsWeight" type="number" min="0" step="0.1" className={`${input} w-24`} value={weightOz} onChange={(e) => setWeightOz(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsLength">Length (in)</label>
          <input id="fsLength" type="number" min="0" step="0.5" className={`${input} w-24`} value={lengthIn} onChange={(e) => setLengthIn(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsWidth">Width (in)</label>
          <input id="fsWidth" type="number" min="0" step="0.5" className={`${input} w-24`} value={widthIn} onChange={(e) => setWidthIn(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="fsHeight">Height (in)</label>
          <input id="fsHeight" type="number" min="0" step="0.5" className={`${input} w-24`} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
        </div>
      </div>

      <button type="button" onClick={save} disabled={saving} className={`${pillPrimary} px-6 py-2.5 mt-4`}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
