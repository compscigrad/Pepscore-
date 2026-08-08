// Admin-editable internal notes -- Customer.notes already existed and was
// displayed read-only on the profile page with no way to actually edit it
// (Phase 2B item 8 gap). Same toggle-edit pattern as CustomerContactEditor.tsx,
// through the same existing PATCH endpoint.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { input as inputClass, pillPrimary, pillOutline } from '@/components/invoices/theme'

export function CustomerNotesEditor({ customerId, notes }: { customerId: string; notes: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button type="button" className={`${pillOutline} px-3 py-1.5 text-xs`} onClick={() => setEditing(true)}>
        {notes ? 'Edit Notes' : 'Add Notes'}
      </button>
    )
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save notes')
      toast.success('Notes saved')
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        className={inputClass}
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Internal notes -- never shown to the customer"
      />
      <div className="flex gap-2">
        <button type="button" className={`${pillPrimary} px-4 py-1.5 text-xs`} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={`${pillOutline} px-4 py-1.5 text-xs`} onClick={() => { setValue(notes ?? ''); setEditing(false) }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
