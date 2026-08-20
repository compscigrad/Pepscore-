// Customer-portal display of Professional Evaluation history and any
// resulting credit (Sample & Evaluation Program, 2026-08-20). Deliberately
// customer-safe only -- product/quantity/amount paid/credit status, never
// admin notes, the issuing admin's identity, the pricing-source snapshot,
// or the inventory ledger link (lib/professionalEvaluation/service.ts's
// listCustomerSafeEvaluations() already selects only these fields).
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'
import type { CustomerSafeEvaluationRow } from '@/lib/professionalEvaluation/service'

function creditLabel(row: CustomerSafeEvaluationRow): string | null {
  if (row.creditStatus === 'NONE') return null
  if (row.creditStatus === 'AVAILABLE') {
    const expiry = row.creditExpiresAt
      ? ` — expires ${row.creditExpiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : ''
    return `$${(row.creditAmount ?? 0).toFixed(2)} credit available toward a full case${expiry}`
  }
  if (row.creditStatus === 'REDEEMED') return `$${(row.creditAmount ?? 0).toFixed(2)} credit redeemed`
  if (row.creditStatus === 'EXPIRED') return 'Credit expired'
  if (row.creditStatus === 'CANCELLED') return 'Credit cancelled'
  return null
}

export function EvaluationCreditsSection({ rows }: { rows: CustomerSafeEvaluationRow[] }) {
  if (rows.length === 0) return null

  return (
    <div className={`${card} p-6 space-y-3`}>
      <h3 className={sectionHeading}>Professional Evaluations</h3>
      <div className="space-y-3">
        {rows.map((row) => {
          const credit = creditLabel(row)
          return (
            <div key={row.id} className="border border-white/10 rounded-xl p-4 flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="text-white font-semibold">{row.productName} ({row.productSize})</p>
                <p className={`${mutedText} text-[13px]`}>
                  {row.quantity} unit{row.quantity === 1 ? '' : 's'} · {row.evaluationType === 'PAID' ? `$${row.amountPaid.toFixed(2)} paid` : 'Complimentary'}
                </p>
                {credit ? <p className="text-gold-light text-[12px] mt-0.5">{credit}</p> : null}
              </div>
              <p className={`${mutedText} text-[12px]`}>{row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
