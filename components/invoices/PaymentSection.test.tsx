// @vitest-environment jsdom
//
// Owner-reported defect (2026-09-03 sprint): a Direct Sales draft with
// $0 paid displayed "Paid in full." in green. Root cause traced to
// balanceDue <= 0 being treated as sufficient proof of "paid" -- true for
// a genuinely $0 balance after a real payment, but ALSO true for a fresh
// invoice with no line items yet (total === 0), which is not the same
// fact. This test rehearses every stage the owner named: draft + $0 paid,
// partial payment, paid in full, and confirms "Paid in full" never
// appears unless a real positive total has actually been fully paid.
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PaymentSection } from './PaymentSection'

afterEach(cleanup)

function renderPayments(amountPaid: number, total: number) {
  const balanceDue = Math.max(Math.round((total - amountPaid) * 100) / 100, 0)
  return render(
    <PaymentSection
      invoiceId="inv-1"
      payments={[]}
      amountPaid={amountPaid}
      total={total}
      balanceDue={balanceDue}
      paymentArrangement={null}
      onPaymentRecorded={() => {}}
    />
  )
}

describe('PaymentSection -- "Paid in full" only reflects a real settled balance', () => {
  it('fresh draft, no line items yet (total $0, paid $0): never claims Paid in full', () => {
    renderPayments(0, 0)
    expect(screen.queryByText(/Paid in full/i)).not.toBeInTheDocument()
    expect(screen.getByText(/No balance due yet/i)).toBeInTheDocument()
  })

  it('draft with real priced items, $0 paid: shows the payment form, not Paid in full', () => {
    renderPayments(0, 500)
    expect(screen.queryByText(/Paid in full/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument()
  })

  it('partial payment: shows the payment form (remaining balance), not Paid in full', () => {
    renderPayments(250, 500)
    expect(screen.queryByText(/Paid in full/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument()
  })

  it('genuinely paid in full (amountPaid === total, total > 0): shows Paid in full', () => {
    renderPayments(500, 500)
    expect(screen.getByText(/Paid in full/i)).toBeInTheDocument()
  })
})
