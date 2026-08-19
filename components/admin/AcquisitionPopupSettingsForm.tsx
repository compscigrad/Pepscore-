'use client'

// Settings > Acquisition Popup -- trigger/suppression/nurture-cadence
// mechanics (2026-08-19 lead-capture/conversion engine, section 23). Global
// switch + timing only -- per-campaign COPY (headline/body/terms/SMS text)
// is configured on the campaign itself at Admin -> Promotions, not here.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, input as inputCls, label as labelCls, pillPrimary, sectionHeading, mutedText } from '@/components/invoices/theme'

export interface AcquisitionPopupSettingsFormProps {
  initial: {
    enabled: boolean
    delayMs: number
    scrollThresholdPercent: number | null
    exitIntentEnabled: boolean
    capturedSuppressDays: number
    dismissedSuppressDays: number
    reminderIntervalsHours: number[]
  }
}

export function AcquisitionPopupSettingsForm({ initial }: AcquisitionPopupSettingsFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [delaySeconds, setDelaySeconds] = useState(String(initial.delayMs / 1000))
  const [scrollEnabled, setScrollEnabled] = useState(initial.scrollThresholdPercent !== null)
  const [scrollThresholdPercent, setScrollThresholdPercent] = useState(String(initial.scrollThresholdPercent ?? 50))
  const [exitIntentEnabled, setExitIntentEnabled] = useState(initial.exitIntentEnabled)
  const [capturedSuppressDays, setCapturedSuppressDays] = useState(String(initial.capturedSuppressDays))
  const [dismissedSuppressDays, setDismissedSuppressDays] = useState(String(initial.dismissedSuppressDays))
  const [reminderHours, setReminderHours] = useState(initial.reminderIntervalsHours.join(', '))
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsedHours = reminderHours
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (parsedHours.length === 0) {
      toast.error('Enter at least one reminder interval (hours).')
      return
    }
    for (let i = 1; i < parsedHours.length; i++) {
      if (parsedHours[i] <= parsedHours[i - 1]) {
        toast.error('Reminder intervals must be listed in strictly increasing order.')
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/acquisition-popup-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          delayMs: Math.round(Number(delaySeconds) * 1000),
          scrollThresholdPercent: scrollEnabled ? Number(scrollThresholdPercent) : null,
          exitIntentEnabled,
          capturedSuppressDays: Number(capturedSuppressDays),
          dismissedSuppressDays: Number(dismissedSuppressDays),
          reminderIntervalsHours: parsedHours,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save settings')
      toast.success('Acquisition popup settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${card} p-6 max-w-2xl space-y-6`}>
      <div>
        <h2 className={`${sectionHeading} mb-1`}>First-Visit Acquisition Popup</h2>
        <p className={`text-sm ${mutedText}`}>
          Off by default. Turning this on, together with a campaign that has its own Popup enabled at{' '}
          <span className="text-white/70">Admin → Promotions</span>, is what makes the popup auto-trigger on the
          storefront. Trigger timing, same-browser suppression windows, and the nurture-reminder cadence below apply
          globally, across whichever campaign is currently active.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm text-white/80 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-gold" />
        Popup enabled
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Delay before showing (seconds)</label>
          <input type="number" min={0} step="1" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer mb-1.5">
            <input type="checkbox" checked={scrollEnabled} onChange={(e) => setScrollEnabled(e.target.checked)} className="accent-gold" />
            Also trigger on scroll depth
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step="1"
            value={scrollThresholdPercent}
            onChange={(e) => setScrollThresholdPercent(e.target.value)}
            disabled={!scrollEnabled}
            className={`${inputCls} ${!scrollEnabled ? 'opacity-40' : ''}`}
            placeholder="% of page scrolled"
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-white/80 cursor-pointer">
        <input type="checkbox" checked={exitIntentEnabled} onChange={(e) => setExitIntentEnabled(e.target.checked)} className="mt-0.5 accent-gold" />
        <span>
          Also trigger on exit intent (desktop only — cursor leaving toward the browser chrome). Never used on
          mobile/touch devices, where there is no reliable signal for this.
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
        <div>
          <label className={labelCls}>Suppress after a successful submission (days)</label>
          <input type="number" min={0} step="1" value={capturedSuppressDays} onChange={(e) => setCapturedSuppressDays(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Suppress after a dismiss without submitting (days)</label>
          <input type="number" min={0} step="1" value={dismissedSuppressDays} onChange={(e) => setDismissedSuppressDays(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="pt-2 border-t border-white/10">
        <label className={labelCls}>Nurture reminder cadence (hours after claim, comma-separated, increasing)</label>
        <input type="text" value={reminderHours} onChange={(e) => setReminderHours(e.target.value)} className={inputCls} placeholder="24, 72, 168" />
        <p className={`text-xs ${mutedText} mt-1.5`}>
          Default 24, 72, 168 = 24 hours, 3 days, 7 days after claiming. The number of intervals is also the max
          number of reminders sent. Email nurture is fully built and safety-gated; it does not send real reminders
          until the owner explicitly enables it in production (see Owner Actions).
        </p>
      </div>

      <button type="button" onClick={save} disabled={saving} className={`${pillPrimary} px-6 py-2.5`}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
