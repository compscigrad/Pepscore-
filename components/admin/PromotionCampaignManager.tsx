'use client'

// Admin -> Promotions -- create/activate/retire/archive/delete acquisition
// campaigns. FIRST10 becomes the first configured campaign here rather
// than a permanently hardcoded 10%; see lib/promotions/campaigns.ts.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { card, input as inputClass, label as labelClass, selectOption, pillPrimary, pillOutline, sectionHeading, mutedText, divider } from '@/components/invoices/theme'

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED'
type StackingPolicy = 'NOT_STACKABLE' | 'STACKABLE_WITH_ONE' | 'PRIVILEGED_STACKABLE'

export interface PromotionCampaignView {
  id: string
  name: string
  publicTitle: string
  publicDescription: string | null
  discountType: 'FIXED' | 'PERCENTAGE'
  discountValue: number
  status: CampaignStatus
  startsAt: string | null
  expiresAt: string | null
  isDefaultFirstOrderCampaign: boolean
  firstOrderOnly: boolean
  stackingPolicy: StackingPolicy
  createdAt: string
  codeCount: number
  redeemedCount: number
}

const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-white/5 text-white/50 border border-white/10',
  SCHEDULED: 'bg-blue-400/10 text-blue-300 border border-blue-400/20',
  ACTIVE: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20',
  RETIRED: 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
  ARCHIVED: 'bg-white/5 text-white/30 border border-white/10',
}

const STACKING_LABEL: Record<StackingPolicy, string> = {
  NOT_STACKABLE: 'Not stackable',
  STACKABLE_WITH_ONE: 'Stackable with one other promotion',
  PRIVILEGED_STACKABLE: 'Family & Friends class (stacks with one other eligible promotion)',
}

function formatDiscount(type: 'FIXED' | 'PERCENTAGE', value: number): string {
  return type === 'PERCENTAGE' ? `${value}% off` : `$${value.toFixed(2)} off`
}

export function PromotionCampaignManager({ campaigns }: { campaigns: PromotionCampaignView[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'ACTIVE' | 'SCHEDULED' | 'DRAFT' | 'RETIRED' | 'ARCHIVED' | 'ALL'>('ALL')

  const visible = filter === 'ALL' ? campaigns : campaigns.filter((c) => c.status === filter)

  return (
    <div className="space-y-6">
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className={sectionHeading}>Campaigns</h3>
          <button type="button" className={`${pillPrimary} px-5 py-2`} onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : '+ New Campaign'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(['ALL', 'ACTIVE', 'SCHEDULED', 'DRAFT', 'RETIRED', 'ARCHIVED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11px] font-heading font-bold uppercase tracking-[0.06em] px-3 py-1.5 rounded-full transition-colors ${
                filter === f ? 'bg-gold text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {creating && <CreateCampaignForm onDone={() => { setCreating(false); router.refresh() }} />}

        {visible.length === 0 ? (
          <p className={`text-sm ${mutedText} py-8 text-center`}>No campaigns in this view.</p>
        ) : (
          <div className={`divide-y ${divider}`}>
            {visible.map((c) => (
              <CampaignRow key={c.id} campaign={c} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateCampaignForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [publicTitle, setPublicTitle] = useState('')
  const [publicDescription, setPublicDescription] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('10')
  const [stackingPolicy, setStackingPolicy] = useState<StackingPolicy>('NOT_STACKABLE')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const value = Number(discountValue)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Discount value must be greater than 0.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/promotion-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          publicTitle,
          publicDescription: publicDescription || undefined,
          discountType,
          discountValue: value,
          stackingPolicy,
          startsAt: startsAt ? new Date(`${startsAt}T00:00:00.000Z`).toISOString() : null,
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create campaign')
      toast.success('Campaign created as Draft')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${card} p-5 mb-5 space-y-4 border-gold/20`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Internal campaign name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FIRST20 — Fall Launch" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Public offer title</label>
          <input value={publicTitle} onChange={(e) => setPublicTitle(e.target.value)} placeholder="e.g. Get 20% off your first order" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Public description (optional)</label>
        <input value={publicDescription} onChange={(e) => setPublicDescription(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Discount type</label>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')} className={inputClass}>
            <option value="PERCENTAGE" className={selectOption}>Percentage</option>
            <option value="FIXED" className={selectOption}>Fixed dollar</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{discountType === 'PERCENTAGE' ? 'Percent off' : 'Dollars off'}</label>
          <input type="number" min={0.01} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Stacking policy</label>
          <select value={stackingPolicy} onChange={(e) => setStackingPolicy(e.target.value as StackingPolicy)} className={inputClass}>
            <option value="NOT_STACKABLE" className={selectOption}>Not stackable (default)</option>
            <option value="STACKABLE_WITH_ONE" className={selectOption}>Stackable with one other</option>
            <option value="PRIVILEGED_STACKABLE" className={selectOption}>Family & Friends class</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Starts (optional — blank = draft until activated manually)</label>
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputClass} max-w-[200px]`} />
        </div>
        <div>
          <label className={labelClass}>Expires (optional)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${inputClass} max-w-[200px]`} />
        </div>
      </div>
      <button type="button" onClick={submit} disabled={submitting || !name || !publicTitle} className={`${pillPrimary} px-6 py-2.5`}>
        {submitting ? 'Creating…' : 'Create Campaign'}
      </button>
    </div>
  )
}

function CampaignRow({ campaign, onChanged }: { campaign: PromotionCampaignView; onChanged: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [confirmingActivate, setConfirmingActivate] = useState(false)
  const [outstandingPolicy, setOutstandingPolicy] = useState<'HONOR' | 'EXPIRE_NOW'>('HONOR')

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/promotion-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Action failed')
      toast.success(successMessage)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(false)
      setConfirmingActivate(false)
    }
  }

  async function remove() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/promotion-campaigns/${campaign.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Delete failed')
      toast.success('Campaign deleted')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium">{campaign.name}</p>
            <span className={`text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${STATUS_STYLE[campaign.status]}`}>
              {campaign.status}
            </span>
            {campaign.isDefaultFirstOrderCampaign && (
              <span className="text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-gold/15 text-gold-light border border-gold/30">
                Default First-Order Offer
              </span>
            )}
          </div>
          <p className={`text-sm ${mutedText} mt-1`}>
            {campaign.publicTitle} — {formatDiscount(campaign.discountType, campaign.discountValue)}
          </p>
          <p className={`text-xs ${mutedText} mt-0.5`}>{STACKING_LABEL[campaign.stackingPolicy]}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-white">{campaign.codeCount} code{campaign.codeCount === 1 ? '' : 's'} issued</p>
          <p className={mutedText}>{campaign.redeemedCount} redeemed</p>
        </div>
      </div>

      {confirmingActivate ? (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-3">
          <p className="text-sm text-white">
            This will stop issuing new codes for the current default first-order promotion and make{' '}
            <span className="font-medium">{campaign.name}</span> the active offer.
          </p>
          <div>
            <label className={labelClass}>Outstanding codes from the previous campaign</label>
            <select value={outstandingPolicy} onChange={(e) => setOutstandingPolicy(e.target.value as 'HONOR' | 'EXPIRE_NOW')} className={`${inputClass} max-w-xs`}>
              <option value="HONOR" className={selectOption}>Honor until their original expiration</option>
              <option value="EXPIRE_NOW" className={selectOption}>Expire outstanding codes now</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className={`${pillPrimary} px-5 py-2`}
              disabled={submitting}
              onClick={() => patch({ action: 'activate', outstandingCodePolicy: outstandingPolicy }, 'Campaign activated')}
            >
              {submitting ? 'Activating…' : 'Confirm Activate'}
            </button>
            <button type="button" className={`${pillOutline} px-5 py-2`} disabled={submitting} onClick={() => setConfirmingActivate(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED' || campaign.status === 'RETIRED') && campaign.firstOrderOnly && (
            <button type="button" className={`${pillPrimary} px-4 py-2`} disabled={submitting} onClick={() => setConfirmingActivate(true)}>
              Activate as Default
            </button>
          )}
          {campaign.status === 'ACTIVE' && (
            <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => patch({ action: 'retire' }, 'Campaign retired')}>
              Retire
            </button>
          )}
          {campaign.status === 'RETIRED' && (
            <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => patch({ action: 'archive' }, 'Campaign archived')}>
              Archive
            </button>
          )}
          {(campaign.status === 'DRAFT' || campaign.status === 'ARCHIVED') && campaign.codeCount === 0 && (
            <button type="button" className={`${pillOutline} px-4 py-2 text-red-300`} disabled={submitting} onClick={remove}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
