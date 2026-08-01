// Pure decision logic for the Invoice.status hotfix backfill (see
// scripts/backfill-invoice-status.ts). Separated from that script's DB I/O
// so it can be unit-tested without a database, matching this repo's existing
// pure-logic test convention (lib/invoice/status.ts itself, lib/customerIdentity.ts).
//
// Root cause this fixes: scripts/backfill-payment-status.ts (the earlier
// Phase 1 hotfix) recomputed paymentStatus/overpaidAmount/paymentIntentStatus
// for every existing invoice, but never touched Invoice.status itself. Any
// row whose status predates the positive-balance rule and hasn't been
// re-saved since stays stale until this runs once.
import { deriveInvoiceWorkflowStatus } from './status'
import type { InvoiceStatus } from '@prisma/client'

export interface BackfillableInvoice {
  status: InvoiceStatus
  balanceDue: number
}

// hasBeenIssued has no separate tracking column -- DRAFT is the only
// pre-issuance status, so "not DRAFT" is exactly "has been issued at least
// once," the same signal already used for the paymentIntentStatus backfill.
export function computeBackfilledStatus(invoice: BackfillableInvoice): InvoiceStatus {
  return deriveInvoiceWorkflowStatus({
    currentStatus: invoice.status,
    hasBeenIssued: invoice.status !== 'DRAFT',
    balanceDue: invoice.balanceDue,
  })
}
