'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, input, label as labelClass, pillOutline, sectionHeading, mutedText } from './theme'

interface PackagePreset {
  id: string
  name: string
  weightOz: number
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
}

interface Props {
  initialPresets: PackagePreset[]
}

export function PackagePresetsForm({ initialPresets }: Props) {
  const [presets, setPresets] = useState(initialPresets)
  const [name, setName] = useState('')
  const [weightOz, setWeightOz] = useState(0)
  const [lengthIn, setLengthIn] = useState(0)
  const [widthIn, setWidthIn] = useState(0)
  const [heightIn, setHeightIn] = useState(0)
  const [saving, setSaving] = useState(false)

  async function addPreset(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || weightOz <= 0) {
      toast.error('Enter a name and weight')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/package-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          weightOz,
          lengthIn: lengthIn || undefined,
          widthIn: widthIn || undefined,
          heightIn: heightIn || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create preset')
      setPresets((prev) => [...prev, data])
      setName('')
      setWeightOz(0)
      setLengthIn(0)
      setWidthIn(0)
      setHeightIn(0)
      toast.success('Preset added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create preset')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    try {
      const res = await fetch(`/api/admin/package-presets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      if (!res.ok) throw new Error('Failed to deactivate preset')
      setPresets((prev) => prev.filter((p) => p.id !== id))
      toast.success('Preset removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate preset')
    }
  }

  return (
    <div className={`${card} p-6 max-w-2xl`}>
      <h2 className={`${sectionHeading} mb-1`}>Package presets</h2>
      <p className="text-white/50 text-sm mb-4">
        Reusable named package templates (e.g. &quot;Small Box&quot;) that pre-fill weight and
        dimensions on the Create Shipping Label panel.
      </p>

      {presets.length > 0 ? (
        <div className="space-y-2 mb-4">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
              <span>
                {p.name} <span className={mutedText}>— {p.weightOz}oz{p.lengthIn ? `, ${p.lengthIn}×${p.widthIn}×${p.heightIn}in` : ''}</span>
              </span>
              <button type="button" className="text-xs text-red-300 hover:underline" onClick={() => deactivate(p.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${mutedText} mb-4`}>No presets yet.</p>
      )}

      <form onSubmit={addPreset} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className={labelClass} htmlFor="presetName">Name</label>
          <input id="presetName" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Small Box" />
        </div>
        <div>
          <label className={labelClass} htmlFor="presetWeight">Weight (oz)</label>
          <input id="presetWeight" type="number" min="0" step="0.1" className={`${input} w-24`} value={weightOz} onChange={(e) => setWeightOz(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="presetLength">L (in)</label>
          <input id="presetLength" type="number" min="0" step="0.5" className={`${input} w-20`} value={lengthIn} onChange={(e) => setLengthIn(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="presetWidth">W (in)</label>
          <input id="presetWidth" type="number" min="0" step="0.5" className={`${input} w-20`} value={widthIn} onChange={(e) => setWidthIn(Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="presetHeight">H (in)</label>
          <input id="presetHeight" type="number" min="0" step="0.5" className={`${input} w-20`} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
        </div>
        <button type="submit" className={`${pillOutline} px-4 py-2`} disabled={saving}>
          Add Preset
        </button>
      </form>
    </div>
  )
}
