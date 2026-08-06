// Centralized email routing: one typed lookup from "what kind of message is
// this" to which Pepscore mailbox owns it, instead of every send call site
// importing its own address constants and picking a Reply-To inline. Policy
// (which category belongs to which mailbox) lives here exactly once.
//
// The `from` address is deliberately NOT category-specific: Resend rejects
// sends whose From header uses an unverified domain, and pepscorelab.com
// isn't verified with Resend yet (RESEND_FROM_EMAIL currently falls back to
// Resend's shared sandbox address — see lib/resend.ts). Only the *display
// name* in the From header varies by category today ("Pepscore Orders
// <onboarding@resend.dev>"); once the domain is verified, FROM_EMAIL becomes
// a real pepscorelab.com address and every category's display name starts
// resolving to a real, distinct-looking sender with zero code change here.
import { FROM_EMAIL, ORDERS_EMAIL, BILLING_EMAIL, CONTACT_EMAIL, SUPPORT_EMAIL } from '@/lib/resend'

export type MessageCategory =
  // Orders — new/revised invoices, intake, backorders, fulfillment/tracking
  | 'INVOICE_ISSUED'
  | 'INVOICE_REVISED'
  | 'ORDER_CONFIRMATION'
  | 'INTAKE_REQUEST'
  | 'INTAKE_SUBMISSION_CONFIRMATION'
  | 'BACKORDER_NOTICE'
  | 'FULFILLMENT_UPDATE'
  | 'TRACKING_UPDATE'
  | 'PORTAL_INVITE' // customer-facing: admin invited them to claim portal access
  | 'PORTAL_ACCOUNT_CLAIMED' // customer-facing: confirms the claim succeeded
  // Billing — payment selection, arrangements, receipts, refunds, credits
  | 'PAYMENT_SELECTION_PENDING'
  | 'PAYMENT_SELECTION_CONFIRMATION'
  | 'PAYMENT_ARRANGEMENT_REQUEST_PENDING'
  | 'PAYMENT_ARRANGEMENT_REQUEST_RECEIVED'
  | 'PAYMENT_ARRANGEMENT_DECISION'
  | 'PAYMENT_RECEIVED'
  | 'REFUND_COMPLETED'
  | 'REFUND_REQUESTED' // customer-facing: a refund was just requested, still Pending
  | 'ACCOUNT_CREDIT_ISSUED' // customer-facing: store credit was issued (not a cash refund)
  | 'REFUND_ACTION_REQUIRED' // admin-facing: a pending refund needs manual processing
  | 'BALANCE_TRANSFER_NOTICE' // a prior invoice's balance was moved onto a new invoice
  // Contact — pre-purchase / general inquiries
  | 'CONTACT_INQUIRY'
  // Support — existing-customer problems, access issues
  | 'SUPPORT_REQUEST'
  // Internal admin alerts not tied to a specific customer-facing category —
  // routed to Orders by default (matches "Product and fulfillment questions"
  // being the closest fit for today's only such alert, intake submission).
  | 'ADMIN_INTAKE_ALERT'
  // Admin-facing: a customer-facing send (currently: the invoice-issued
  // email) failed outright — distinct from ADMIN_INTAKE_ALERT so the two can
  // route differently later if needed, even though today both land on Orders.
  | 'ADMIN_DELIVERY_FAILURE_ALERT'

interface RoutedSender {
  fromName: string
  replyTo: string
}

const ROUTING: Record<MessageCategory, RoutedSender> = {
  INVOICE_ISSUED: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  INVOICE_REVISED: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  ORDER_CONFIRMATION: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  INTAKE_REQUEST: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  INTAKE_SUBMISSION_CONFIRMATION: { fromName: 'Pepscore Orders', replyTo: CONTACT_EMAIL },
  BACKORDER_NOTICE: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  FULFILLMENT_UPDATE: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  TRACKING_UPDATE: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  PORTAL_INVITE: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  PORTAL_ACCOUNT_CLAIMED: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },

  PAYMENT_SELECTION_PENDING: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  PAYMENT_SELECTION_CONFIRMATION: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  PAYMENT_ARRANGEMENT_REQUEST_PENDING: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  PAYMENT_ARRANGEMENT_REQUEST_RECEIVED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  PAYMENT_ARRANGEMENT_DECISION: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  PAYMENT_RECEIVED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  REFUND_COMPLETED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  REFUND_REQUESTED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  ACCOUNT_CREDIT_ISSUED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  REFUND_ACTION_REQUIRED: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },
  BALANCE_TRANSFER_NOTICE: { fromName: 'Pepscore Billing', replyTo: BILLING_EMAIL },

  CONTACT_INQUIRY: { fromName: 'Pepscore', replyTo: CONTACT_EMAIL },
  SUPPORT_REQUEST: { fromName: 'Pepscore Support', replyTo: SUPPORT_EMAIL },

  ADMIN_INTAKE_ALERT: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
  ADMIN_DELIVERY_FAILURE_ALERT: { fromName: 'Pepscore Orders', replyTo: ORDERS_EMAIL },
}

export interface ResolvedSender {
  from: string
  replyTo: string
}

// The single place any send call site gets its from/replyTo — never import
// FROM_EMAIL/ORDERS_EMAIL/etc. directly at a send call site again.
export function routeFor(category: MessageCategory): ResolvedSender {
  const { fromName, replyTo } = ROUTING[category]
  return { from: `${fromName} <${FROM_EMAIL}>`, replyTo }
}

// The customer-portal correspondence view's authorization boundary for
// *which categories*, not which rows — row-level ownership (only this
// customer's own Communication rows) is still enforced separately by every
// portal query filtering on customerId. This only decides whether a given
// category is ever appropriate to show a customer at all, so an admin-only
// alert (REFUND_ACTION_REQUIRED, ADMIN_INTAKE_ALERT, ...) can never leak
// into the portal even if it happens to carry that customer's id.
// Deliberately an explicit allowlist, not "everything except admin
// categories" — a new category defaults to hidden from the portal until
// someone deliberately decides otherwise, matching the same fail-closed
// posture as every admin-route isAdmin() check.
const CUSTOMER_VISIBLE_CATEGORIES: ReadonlySet<MessageCategory> = new Set<MessageCategory>([
  'INVOICE_ISSUED',
  'INVOICE_REVISED',
  'ORDER_CONFIRMATION',
  'INTAKE_REQUEST',
  'INTAKE_SUBMISSION_CONFIRMATION',
  'BACKORDER_NOTICE',
  'FULFILLMENT_UPDATE',
  'TRACKING_UPDATE',
  'PORTAL_INVITE',
  'PORTAL_ACCOUNT_CLAIMED',
  'PAYMENT_SELECTION_CONFIRMATION',
  'PAYMENT_ARRANGEMENT_REQUEST_RECEIVED',
  'PAYMENT_ARRANGEMENT_DECISION',
  'PAYMENT_RECEIVED',
  'REFUND_COMPLETED',
  'REFUND_REQUESTED',
  'ACCOUNT_CREDIT_ISSUED',
  'BALANCE_TRANSFER_NOTICE',
])

export function isCustomerVisibleCategory(category: string): boolean {
  return CUSTOMER_VISIBLE_CATEGORIES.has(category as MessageCategory)
}
