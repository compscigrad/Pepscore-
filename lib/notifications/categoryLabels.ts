// Single source of truth for customer-facing category display text — used by
// both the Dashboard's "Recent Communications" widget and the full
// Correspondence page, so the two surfaces can never drift out of sync.
// Record<MessageCategory, string> (not Partial) so adding a new
// MessageCategory without adding its label here is a compile error, not a
// silent raw-enum leak discovered later in production.
import type { MessageCategory } from './routing'

const CATEGORY_LABELS: Record<MessageCategory, string> = {
  INVOICE_ISSUED: 'Invoice Issued',
  INVOICE_REVISED: 'Invoice Updated',
  ORDER_CONFIRMATION: 'Order Confirmation',
  ACH_PAYMENT_PROCESSING: 'Payment Processing',
  INTAKE_REQUEST: 'Information Requested',
  INTAKE_SUBMISSION_CONFIRMATION: 'Information Received',
  BACKORDER_NOTICE: 'Backorder Notice',
  BACKORDER_ACCOMMODATION: 'Backorder Accommodation',
  FULFILLMENT_UPDATE: 'Fulfillment Update',
  TRACKING_UPDATE: 'Tracking Update',
  PORTAL_INVITE: 'Account Setup',
  PORTAL_ACCOUNT_CLAIMED: 'Account Setup',
  PORTAL_INVITE_REMINDER: 'Account Setup',
  PAYMENT_SELECTION_PENDING: 'Payment Selection',
  PAYMENT_SELECTION_CONFIRMATION: 'Payment Selection',
  PAYMENT_ARRANGEMENT_REQUEST_PENDING: 'Payment Arrangement',
  PAYMENT_ARRANGEMENT_REQUEST_RECEIVED: 'Payment Arrangement',
  PAYMENT_ARRANGEMENT_DECISION: 'Payment Arrangement',
  PAYMENT_RECEIVED: 'Payment Receipt',
  REFUND_COMPLETED: 'Refund Completed',
  REFUND_REQUESTED: 'Refund Requested',
  ACCOUNT_CREDIT_ISSUED: 'Account Credit',
  REFUND_ACTION_REQUIRED: 'Refund Update',
  BALANCE_TRANSFER_NOTICE: 'Balance Transfer',
  CONTACT_INQUIRY: 'Inquiry',
  LEAD_CAPTURED: 'Inquiry',
  FIRST_ORDER_OFFER_CODE: 'First-Order Offer',
  FIRST_ORDER_OFFER_REMINDER: 'First-Order Offer',
  SUPPORT_REQUEST: 'Support Request',
  SUPPORT_REQUEST_RECEIVED: 'Support Request',
  ADMIN_INTAKE_ALERT: 'Account Update',
  ADMIN_DELIVERY_FAILURE_ALERT: 'Account Update',
  ADMIN_PRICING_REPORT: 'Pricing Report',
  PROFESSIONAL_ACCESS_APPLICATION_RECEIVED: 'Professional Access',
  PROFESSIONAL_ACCESS_MORE_INFO_REQUESTED: 'Professional Access',
  PROFESSIONAL_ACCESS_APPROVED: 'Professional Access',
  PROFESSIONAL_ACCESS_REJECTED: 'Professional Access',
  PROFESSIONAL_ACCESS_INVITE: 'Professional Access',
  PROFESSIONAL_ACCESS_INVITE_REMINDER: 'Professional Access',
  PROFESSIONAL_ACCESS_REVOKED: 'Professional Access',
  PROFESSIONAL_ACCESS_APPLICATION_ALERT: 'Professional Access',
}

// Never falls back to the raw category string — a category this app somehow
// doesn't recognize (e.g. stale data from a since-renamed value) still gets
// a clear, generic customer-safe title rather than exposing internal naming.
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as MessageCategory] ?? 'Account Update'
}
