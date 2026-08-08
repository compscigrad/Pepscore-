// Storefront SEO/content editor (Phase 2B item 6) -- lets an admin change
// public-facing product copy, SEO metadata, search synonyms, FAQ, related
// products, and index/noindex without a code deployment. Never edits
// pricing/inventory fields (those already have their own editor on this
// same page, InventoryDetailPanel.tsx -- both share the dark PepScore Lab
// admin theme, see components/invoices/theme.ts).
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { input as inputCls, label as fieldLabel, card, sectionHeading, mutedText, pillPrimary } from '@/components/invoices/theme'

interface FaqEntry {
  question: string
  answer: string
}

interface ProductContent {
  slug: string
  name: string
  category: string
  description: string
  fullDescription: string | null
  seoTitle: string | null
  metaDescription: string | null
  imageAltText: string | null
  searchSynonyms: string | null
  faq: FaqEntry[] | null
  relatedProductSlugs: string[]
  featured: boolean
  noindex: boolean
  availabilityMessageOverride: string | null
}

export function ProductContentSection({ productId }: { productId: string }) {
  const router = useRouter()
  const [content, setContent] = useState<ProductContent | null>(null)
  const [redirects, setRedirects] = useState<{ oldSlug: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inventory/${productId}/content`)
      if (res.ok) {
        const data = await res.json()
        setContent(data.product)
        setRedirects(data.redirects)
      }
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    refresh()
  }, [refresh])

  function update<K extends keyof ProductContent>(key: K, value: ProductContent[K]) {
    setContent((c) => (c ? { ...c, [key]: value } : c))
  }

  async function save() {
    if (!content) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/inventory/${productId}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...content, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Storefront content updated')
      setReason('')
      await refresh()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  function addFaqEntry() {
    if (!content) return
    update('faq', [...(content.faq ?? []), { question: '', answer: '' }])
  }

  function updateFaqEntry(i: number, field: 'question' | 'answer', value: string) {
    if (!content?.faq) return
    const next = content.faq.map((f, idx) => (idx === i ? { ...f, [field]: value } : f))
    update('faq', next)
  }

  function removeFaqEntry(i: number) {
    if (!content?.faq) return
    update('faq', content.faq.filter((_, idx) => idx !== i))
  }

  if (loading || !content) return null

  return (
    <div className={`${card} p-6 space-y-4`}>
      <div>
        <h2 className={`${sectionHeading} mb-1`}>Storefront SEO &amp; Content</h2>
        <p className={`text-[12px] ${mutedText}`}>
          Public-facing product copy and search metadata. Changes go live immediately, no deployment required. Never enter supplier
          cost, suggested pricing, or internal notes here — this content is always publicly visible.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={fieldLabel}>Display Title</span>
          <input className={`${inputCls} mt-1`} value={content.name} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Category</span>
          <input className={`${inputCls} mt-1`} value={content.category} onChange={(e) => update('category', e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className={fieldLabel}>Slug (URL) — changing this creates an automatic redirect from the old URL</span>
          <input className={`${inputCls} mt-1`} value={content.slug} onChange={(e) => update('slug', e.target.value)} />
          {redirects.length > 0 && (
            <p className="text-[11px] text-white/50 mt-1">Redirecting from: {redirects.map((r) => r.oldSlug).join(', ')}</p>
          )}
        </label>
      </div>

      <label className="block">
        <span className={fieldLabel}>Short Description (used on cards + meta description fallback)</span>
        <textarea className={`${inputCls} mt-1`} rows={2} value={content.description} onChange={(e) => update('description', e.target.value)} />
      </label>
      <label className="block">
        <span className={fieldLabel}>Full Description (product detail page — optional, falls back to short description)</span>
        <textarea
          className={`${inputCls} mt-1`}
          rows={4}
          value={content.fullDescription ?? ''}
          onChange={(e) => update('fullDescription', e.target.value || null)}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={fieldLabel}>SEO Title (falls back to an auto-generated title)</span>
          <input className={`${inputCls} mt-1`} value={content.seoTitle ?? ''} onChange={(e) => update('seoTitle', e.target.value || null)} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Meta Description (falls back to short description)</span>
          <input className={`${inputCls} mt-1`} value={content.metaDescription ?? ''} onChange={(e) => update('metaDescription', e.target.value || null)} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Image Alt Text (falls back to product name)</span>
          <input className={`${inputCls} mt-1`} value={content.imageAltText ?? ''} onChange={(e) => update('imageAltText', e.target.value || null)} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Search Synonyms (comma-separated)</span>
          <input className={`${inputCls} mt-1`} value={content.searchSynonyms ?? ''} onChange={(e) => update('searchSynonyms', e.target.value || null)} />
        </label>
        <label className="block sm:col-span-2">
          <span className={fieldLabel}>Availability Message Override (optional — replaces the generic status label)</span>
          <input
            className={`${inputCls} mt-1`}
            placeholder="e.g. Restocking mid-August"
            value={content.availabilityMessageOverride ?? ''}
            onChange={(e) => update('availabilityMessageOverride', e.target.value || null)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={fieldLabel}>Related Product Slugs (comma-separated)</span>
          <input
            className={`${inputCls} mt-1`}
            value={content.relatedProductSlugs.join(', ')}
            onChange={(e) => update('relatedProductSlugs', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </label>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-[13px] text-white">
          <input type="checkbox" checked={content.featured} onChange={(e) => update('featured', e.target.checked)} />
          Featured (shown first on the storefront)
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white">
          <input type="checkbox" checked={content.noindex} onChange={(e) => update('noindex', e.target.checked)} />
          Noindex (hide from search engines)
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={fieldLabel}>FAQ</span>
          <button type="button" onClick={addFaqEntry} className="text-[11px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-wide">
            + Add question
          </button>
        </div>
        {(content.faq ?? []).map((f, i) => (
          <div key={i} className="flex gap-2 mb-2 items-start">
            <div className="flex-1 space-y-1">
              <input className={inputCls} placeholder="Question" value={f.question} onChange={(e) => updateFaqEntry(i, 'question', e.target.value)} />
              <input className={inputCls} placeholder="Answer" value={f.answer} onChange={(e) => updateFaqEntry(i, 'answer', e.target.value)} />
            </div>
            <button type="button" onClick={() => removeFaqEntry(i)} className="text-red-400 text-[12px] mt-2 font-heading font-bold">
              Remove
            </button>
          </div>
        ))}
      </div>

      <label className="block">
        <span className={fieldLabel}>Reason (optional, recorded in the audit log)</span>
        <input className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <button onClick={save} disabled={submitting} className={`${pillPrimary} px-4 py-2`}>
        Save Storefront Content
      </button>
    </div>
  )
}
