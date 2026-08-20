// Professional Sample & Evaluation Program (2026-08-20) -- admin customer-
// profile widget. Issue Evaluation Unit + Evaluation History, mirroring
// ProfessionalAccessSection.tsx's self-contained fetch-on-mount pattern.
// Professional Access itself never entitles a customer to a sample -- every
// issuance here is an explicit, SKU-gated Admin action.
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, input } from '@/components/invoices/theme'

interface EligibleProduct {
  id: string
  name: string
  size: string
  evaluationMethod: 'PAID_ONLY' | 'COMPLIMENTARY_ALLOWED' | 'BOTH'
}

interface EvaluationRow {
  id: string
  quantity: number
  evaluationType: 'PAID' | 'COMPLIMENTARY'
  amountPaid: number
  evaluationUnitPrice: number
  creditEligible: boolean
  creditAmount: number | null
  creditStatus: 'NONE' | 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED'
  creditExpiresAt: string | null
  status: 'ISSUED' | 'CANCELLED'
  createdAt: string
  product: { name: string; size: string }
}

const CREDIT_BADGE: Record<EvaluationRow['creditStatus'], string> = {
  NONE: 'bg-white/5 text-white/40',
  AVAILABLE: 'bg-green-500/15 text-green-400',
  REDEEMED: 'bg-blue-500/15 text-blue-300',
  EXPIRED: 'bg-white/10 text-white/50',
  CANCELLED: 'bg-red-500/15 text-red-400',
}

export function ProfessionalEvaluationSection({ customerId }: { customerId: string }) {
  const [products, setProducts] = useState<EligibleProduct[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [evaluationType, setEvaluationType] = useState<'PAID' | 'COMPLIMENTARY'>('PAID')
  const [creditEligible, setCreditEligible] = useState(false)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    try {
      const [productsRes, evaluationsRes] = await Promise.all([
        fetch('/api/admin/professional-evaluation/eligible-products'),
        fetch(`/api/admin/customers/${customerId}/professional-evaluations`),
      ])
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.products)
        setProductId((prev) => prev || data.products[0]?.id || '')
      }
      if (evaluationsRes.ok) setEvaluations((await evaluationsRes.json()).evaluations)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    load()
  }, [load])

  async function issue() {
    if (!productId) {
      toast.error('Select a product')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/professional-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          productId,
          quantity: Number(quantity) || 1,
          evaluationType,
          creditEligible,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to issue evaluation unit')
      toast.success('Evaluation unit issued')
      setNotes('')
      setCreditEligible(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue evaluation unit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  const selectedProduct = products.find((p) => p.id === productId)
  const complimentaryAllowed = selectedProduct && selectedProduct.evaluationMethod !== 'PAID_ONLY'
  const paidAllowed = selectedProduct && selectedProduct.evaluationMethod !== 'COMPLIMENTARY_ALLOWED'

  return (
    <div className={`${card} p-6`}>
      <h3 className={sectionHeading}>Professional Evaluation</h3>
      <p className={`${mutedText} mb-4`}>
        Professional Access does not automatically entitle this account to free samples. Evaluation units are owner/Admin-approved,
        SKU-specific, and inventory-tracked. Default method is a paid evaluation unit, priced from this customer&apos;s own current case price.
      </p>

      {products.length === 0 ? (
        <p className={`${mutedText} mb-4`}>No products are currently enabled for evaluation. Enable a SKU from Product Master first.</p>
      ) : (
        <div className="border border-white/10 rounded-xl p-4 mb-4 space-y-2">
          <select className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.size})</option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="number" min="1" className={input} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
            <select className={input} value={evaluationType} onChange={(e) => setEvaluationType(e.target.value as 'PAID' | 'COMPLIMENTARY')}>
              {paidAllowed && <option value="PAID">Paid Evaluation</option>}
              {complimentaryAllowed && <option value="COMPLIMENTARY">Complimentary Evaluation</option>}
            </select>
          </div>
          {evaluationType === 'PAID' && (
            <label className="flex items-center gap-2 text-[12px] text-white/60">
              <input type="checkbox" checked={creditEligible} onChange={(e) => setCreditEligible(e.target.checked)} />
              Eligible for credit toward a later full-case purchase
            </label>
          )}
          <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (internal)" />
          <button onClick={issue} disabled={submitting} className={`${pillPrimary} px-4 py-2`}>
            {submitting ? 'Issuing…' : 'Issue Evaluation Unit'}
          </button>
        </div>
      )}

      {evaluations.length > 0 && (
        <div className="space-y-2">
          {evaluations.map((e) => (
            <div key={e.id} className="border border-white/10 rounded-lg p-3 flex items-start justify-between flex-wrap gap-2 text-[13px]">
              <div>
                <p className="text-white font-semibold">{e.product.name} ({e.product.size}) × {e.quantity}</p>
                <p className={mutedText}>
                  {e.evaluationType === 'PAID' ? `Paid $${e.amountPaid.toFixed(2)}` : 'Complimentary'} · ${e.evaluationUnitPrice.toFixed(2)}/unit ·{' '}
                  {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </div>
              {e.creditStatus !== 'NONE' && (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${CREDIT_BADGE[e.creditStatus]}`}>
                  Credit {e.creditStatus.toLowerCase()}{e.creditAmount ? ` · $${e.creditAmount.toFixed(2)}` : ''}
                  {e.creditStatus === 'AVAILABLE' && e.creditExpiresAt ? ` · through ${new Date(e.creditExpiresAt).toLocaleDateString()}` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
