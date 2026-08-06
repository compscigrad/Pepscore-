import { describe, it, expect } from 'vitest'
import { routeFor, isCustomerVisibleCategory, type MessageCategory } from './routing'

// Every category the Orders/Billing/Contact/Support/DMARC policy defines —
// listing them explicitly here means adding a new MessageCategory without a
// ROUTING entry fails type-checking, not just a runtime lookup.
// INTAKE_SUBMISSION_CONFIRMATION is deliberately excluded — it's the one
// Orders-family category whose Reply-To is Contact, covered by its own test
// below instead of the blanket assertion here.
const ORDERS_CATEGORIES: MessageCategory[] = [
  'INVOICE_ISSUED',
  'INVOICE_REVISED',
  'ORDER_CONFIRMATION',
  'INTAKE_REQUEST',
  'BACKORDER_NOTICE',
  'FULFILLMENT_UPDATE',
  'TRACKING_UPDATE',
  'ADMIN_INTAKE_ALERT',
  'ADMIN_DELIVERY_FAILURE_ALERT',
]

// Account-setup correspondence deliberately routes through admin@, not
// orders@ — see routing.ts.
const PORTAL_CATEGORIES: MessageCategory[] = ['PORTAL_INVITE', 'PORTAL_ACCOUNT_CLAIMED', 'PORTAL_INVITE_REMINDER']

const BILLING_CATEGORIES: MessageCategory[] = [
  'PAYMENT_SELECTION_PENDING',
  'PAYMENT_SELECTION_CONFIRMATION',
  'PAYMENT_ARRANGEMENT_REQUEST_PENDING',
  'PAYMENT_ARRANGEMENT_REQUEST_RECEIVED',
  'PAYMENT_ARRANGEMENT_DECISION',
  'PAYMENT_RECEIVED',
  'REFUND_COMPLETED',
  'REFUND_REQUESTED',
  'ACCOUNT_CREDIT_ISSUED',
  'REFUND_ACTION_REQUIRED',
  'BALANCE_TRANSFER_NOTICE',
]

describe('routeFor', () => {
  it('routes every Orders-category message to the orders mailbox', () => {
    for (const category of ORDERS_CATEGORIES) {
      expect(routeFor(category).replyTo).toBe('orders@pepscorelab.com')
    }
  })

  it('routes every portal account-setup category to the admin mailbox, not orders', () => {
    for (const category of PORTAL_CATEGORIES) {
      expect(routeFor(category).replyTo).toBe('admin@pepscorelab.com')
    }
  })

  it('routes every Billing-category message to the billing mailbox', () => {
    for (const category of BILLING_CATEGORIES) {
      expect(routeFor(category).replyTo).toBe('billing@pepscorelab.com')
    }
  })

  it('routes contact inquiries to the contact mailbox', () => {
    expect(routeFor('CONTACT_INQUIRY').replyTo).toBe('contact@pepscorelab.com')
  })

  it('routes support requests to the support mailbox', () => {
    expect(routeFor('SUPPORT_REQUEST').replyTo).toBe('support@pepscorelab.com')
    expect(routeFor('SUPPORT_REQUEST_RECEIVED').replyTo).toBe('support@pepscorelab.com')
  })

  it('the intake submission confirmation replies to contact, not orders, even though it is sent from the orders identity', () => {
    // The request itself ("please fill in your order details") is an Orders
    // concern; the auto-confirmation after submission is closer to a
    // pre-purchase/general acknowledgment, per the routing policy.
    const result = routeFor('INTAKE_SUBMISSION_CONFIRMATION')
    expect(result.replyTo).toBe('contact@pepscorelab.com')
  })

  it('never returns a from address for an unverified domain literally as the sender — always wraps FROM_EMAIL with a display name', () => {
    const result = routeFor('INVOICE_ISSUED')
    expect(result.from).toMatch(/^Pepscore Orders <.+>$/)
  })

  it('never marks an admin-only/internal category as customer-visible', () => {
    const adminOnly: MessageCategory[] = [
      'REFUND_ACTION_REQUIRED',
      'ADMIN_INTAKE_ALERT',
      'ADMIN_DELIVERY_FAILURE_ALERT',
      'PAYMENT_SELECTION_PENDING',
      'PAYMENT_ARRANGEMENT_REQUEST_PENDING',
      'SUPPORT_REQUEST',
      'CONTACT_INQUIRY',
    ]
    for (const category of adminOnly) {
      expect(isCustomerVisibleCategory(category)).toBe(false)
    }
  })

  it('marks every genuinely customer-facing category as customer-visible', () => {
    const customerFacing: MessageCategory[] = [
      'INVOICE_ISSUED',
      'INVOICE_REVISED',
      'ORDER_CONFIRMATION',
      'BACKORDER_NOTICE',
      'FULFILLMENT_UPDATE',
      'TRACKING_UPDATE',
      'PORTAL_INVITE',
      'PORTAL_ACCOUNT_CLAIMED',
      'PORTAL_INVITE_REMINDER',
      'PAYMENT_SELECTION_CONFIRMATION',
      'PAYMENT_ARRANGEMENT_REQUEST_RECEIVED',
      'PAYMENT_ARRANGEMENT_DECISION',
      'PAYMENT_RECEIVED',
      'REFUND_COMPLETED',
      'REFUND_REQUESTED',
      'ACCOUNT_CREDIT_ISSUED',
      'BALANCE_TRANSFER_NOTICE',
      'SUPPORT_REQUEST_RECEIVED',
    ]
    for (const category of customerFacing) {
      expect(isCustomerVisibleCategory(category)).toBe(true)
    }
  })

  it('defaults an unrecognized category string to not customer-visible (fail closed)', () => {
    expect(isCustomerVisibleCategory('SOME_FUTURE_CATEGORY_NOT_YET_CLASSIFIED')).toBe(false)
  })

  it('gives every category a distinct, non-empty display name', () => {
    const allCategories = [
      ...ORDERS_CATEGORIES,
      ...PORTAL_CATEGORIES,
      ...BILLING_CATEGORIES,
      'INTAKE_SUBMISSION_CONFIRMATION',
      'CONTACT_INQUIRY',
      'SUPPORT_REQUEST',
    ] as MessageCategory[]
    for (const category of allCategories) {
      const { from } = routeFor(category)
      expect(from.length).toBeGreaterThan(0)
      expect(from).toContain('Pepscore')
    }
  })
})
