// Admin management for reusable discount presets (Promotion catalog rows) —
// create/edit/deactivate/reactivate/permanently-delete. Distinct from
// DiscountsSection.tsx's inline "+ New Preset" (which only ever creates);
// this is the one place to edit or retire an existing preset. Editing here
// never rewrites a historical invoice — every applied discount holds its
// own label/type/amount snapshot (InvoiceDiscount), independent of this row.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney } from '@/lib/invoice/format'
import { card, input, pillOutline, pillPrimary, sectionHeading, selectOption, mutedText } from './theme'
import type { Promotion } from './types'

interface Props {
  initialPromotions: Promotion[]
}

interface EditState {
  name: string
  description: string
  type: 'FIXED' | 'PERCENTAGE'
  amount: string
}

function toEditState(p: Promotion): EditState {
  return { name: p.name, description: p.description ?? '', type: p.type, amount: String(p.amount) }
}

export function DiscountPresetsManager({ initialPromotions }: Props) {
  const [promotions, setPromotions] = useState(initialPromotions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [createState, setCreateState] = useState<EditState>({ name: '', description: '', type: 'FIXED', amount: '' })
  const [savingCreate, setSavingCreate] = useState(false)

  function startEdit(p: Promotion) {
    setEditingId(p.id)
    setEditState(toEditState(p))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function saveEdit(id: string) {
    if (!editState) return
    const amount = Number(editState.amount)
    if (!editState.name.trim()) {
      toast.error('Enter a name')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editState.name.trim(), description: editState.description || null, type: editState.type, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save preset')
      setPromotions((prev) => prev.map((p) => (p.id === id ? data : p)))
      toast.success('Preset updated')
      cancelEdit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(p: Promotion) {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/admin/promotions/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update preset')
      setPromotions((prev) => prev.map((x) => (x.id === p.id ? data : x)))
      toast.success(data.active ? 'Preset reactivated' : 'Preset deactivated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update preset')
    } finally {
      setBusyId(null)
    }
  }

  async function deletePreset(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id)
      setTimeout(() => setConfirmingDeleteId((current) => (current === id ? null : current)), 4000)
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete preset')
      setPromotions((prev) => prev.filter((p) => p.id !== id))
      toast.success('Preset permanently deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete preset')
    } finally {
      setBusyId(null)
      setConfirmingDeleteId(null)
    }
  }

  async function createPreset(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(createState.amount)
    if (!createState.name.trim()) {
      toast.error('Enter a name')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }
    setSavingCreate(true)
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createState.name.trim(), description: createState.description || undefined, type: createState.type, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create preset')
      setPromotions((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`Created "${data.name}"`)
      setCreateState({ name: '', description: '', type: 'FIXED', amount: '' })
      setCreating(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create preset')
    } finally {
      setSavingCreate(false)
    }
  }

  return (
    <div className={`${card} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className={sectionHeading}>Discount Presets</h3>
        <button type="button" onClick={() => setCreating((v) => !v)} className={`${pillOutline} px-4 py-1.5`}>
          {creating ? 'Cancel' : '+ New Preset'}
        </button>
      </div>

      {creating ? (
        <form onSubmit={createPreset} className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Name</label>
            <input className={input} value={createState.name} onChange={(e) => setCreateState((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Type</label>
            <select
              className={`${input} w-32`}
              value={createState.type}
              onChange={(e) => setCreateState((s) => ({ ...s, type: e.target.value as 'FIXED' | 'PERCENTAGE' }))}
            >
              <option value="FIXED" className={selectOption}>$ Fixed</option>
              <option value="PERCENTAGE" className={selectOption}>% Percent</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Amount</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${input} w-24`}
              value={createState.amount}
              onChange={(e) => setCreateState((s) => ({ ...s, amount: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={savingCreate} className={`${pillPrimary} px-4 py-2`}>
            {savingCreate ? 'Saving...' : 'Save'}
          </button>
        </form>
      ) : null}

      {promotions.length === 0 ? (
        <p className={`text-sm ${mutedText}`}>No discount presets yet.</p>
      ) : (
        <div className="space-y-2">
          {promotions.map((p) => (
            <div key={p.id} className={`rounded-lg border border-white/10 p-3 ${p.active ? '' : 'opacity-50'}`}>
              {editingId === p.id && editState ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Name</label>
                    <input className={input} value={editState.name} onChange={(e) => setEditState((s) => s && { ...s, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Type</label>
                    <select
                      className={`${input} w-32`}
                      value={editState.type}
                      onChange={(e) => setEditState((s) => s && { ...s, type: e.target.value as 'FIXED' | 'PERCENTAGE' })}
                    >
                      <option value="FIXED" className={selectOption}>$ Fixed</option>
                      <option value="PERCENTAGE" className={selectOption}>% Percent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1">Amount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${input} w-24`}
                      value={editState.amount}
                      onChange={(e) => setEditState((s) => s && { ...s, amount: e.target.value })}
                    />
                  </div>
                  <button type="button" onClick={() => saveEdit(p.id)} disabled={busyId === p.id} className={`${pillPrimary} px-4 py-2`}>
                    Save
                  </button>
                  <button type="button" onClick={cancelEdit} className="text-sm text-white/50 px-2 py-2 hover:text-white/70 transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-white font-medium">
                      {p.name}{' '}
                      <span className={`${mutedText} font-normal`}>
                        ({p.type === 'PERCENTAGE' ? `${p.amount}%` : formatMoney(p.amount)})
                      </span>
                      {!p.active ? <span className="ml-2 text-[10px] uppercase tracking-wide text-white/40">Inactive</span> : null}
                    </p>
                    {p.description ? <p className={`text-xs ${mutedText}`}>{p.description}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(p)} disabled={busyId === p.id} className={`${pillOutline} px-3 py-1.5 text-xs`}>
                      Edit
                    </button>
                    <button type="button" onClick={() => toggleActive(p)} disabled={busyId === p.id} className={`${pillOutline} px-3 py-1.5 text-xs`}>
                      {p.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(p.id)}
                      disabled={busyId === p.id}
                      className={`${pillOutline} px-3 py-1.5 text-xs ${confirmingDeleteId === p.id ? 'border-red-400/40 text-red-300' : ''}`}
                    >
                      {confirmingDeleteId === p.id ? 'Confirm Delete' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
