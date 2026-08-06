// Minimal admin edit affordance for a customer's core contact fields — the
// one gap the admin customer page otherwise has no way to close: applying
// an approved email-change request from the portal (see lib/portal/
// profile.ts's requestEmailChange, which never writes Customer.email
// directly on its own).
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { input as inputClass, pillPrimary, pillOutline } from '@/components/invoices/theme'

interface Props {
  customerId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  company: string | null
}

export function CustomerContactEditor(props: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState(props.firstName)
  const [lastName, setLastName] = useState(props.lastName)
  const [email, setEmail] = useState(props.email ?? '')
  const [phone, setPhone] = useState(props.phone ?? '')
  const [company, setCompany] = useState(props.company ?? '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button type="button" className={`${pillOutline} px-3 py-1.5 text-xs`} onClick={() => setEditing(true)}>
        Edit Contact
      </button>
    )
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/customers/${props.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email: email || null, phone: phone || null, company: company || null }),
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

  return (
    <div className="space-y-2 pt-2 border-t border-white/10">
      <div className="grid grid-cols-2 gap-2">
        <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
        <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
      </div>
      <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
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
