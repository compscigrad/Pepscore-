// Admin email-template preview capability (Phase 3D roadmap item 4): "an
// admin preview capability for reusable templates using representative
// sample data, no real send required." Every builder function below is
// called with fully-synthetic sample data -- no database read, no real
// customer/invoice referenced -- so this registry never risks leaking real
// customer data into a preview and never requires picking a real record.
// IDs referenced in sample data (invoiceId, customerId, refundId) are only
// ever string-interpolated into an admin URL by the templates themselves,
// never fetched, so fake IDs are safe.
import type { PromotionType, ShippingStatus } from '@prisma/client'
import { achPaymentProcessingSubject, buildAchPaymentProcessingHtml } from '@/emails/AchPaymentProcessing'
import {
  backorderFinancialActionRequiredSubject,
  buildBackorderFinancialActionRequiredHtml,
  refundActionRequiredSubject,
  buildRefundActionRequiredHtml,
  profileEmailChangeRequestedSubject,
  buildProfileEmailChangeRequestedHtml,
} from '@/emails/AdminBackorderAlerts'
import { adminIntakeNotificationSubject, buildAdminIntakeNotificationHtml } from '@/emails/AdminIntakeNotification'
import {
  paymentSelectionPendingSubject,
  buildPaymentSelectionPendingHtml,
  arrangementRequestPendingSubject,
  buildArrangementRequestPendingHtml,
} from '@/emails/AdminPaymentAlerts'
import {
  backorderNoticeSubject,
  buildBackorderNoticeHtml,
  backorderResolvedSubject,
  buildBackorderResolvedHtml,
  backorderAccommodationSubject,
  buildBackorderAccommodationHtml,
  refundCompletedSubject,
  buildRefundCompletedHtml,
} from '@/emails/BackorderNotice'
import { balanceTransferNoticeSubject, buildBalanceTransferNoticeHtml } from '@/emails/BalanceTransferNotice'
import {
  arrangementApprovedSubject,
  buildArrangementApprovedHtml,
  arrangementDeniedSubject,
  buildArrangementDeniedHtml,
} from '@/emails/ClientArrangementDecision'
import {
  paymentSelectionConfirmationSubject,
  buildPaymentSelectionConfirmationHtml,
  arrangementRequestReceivedSubject,
  buildArrangementRequestReceivedHtml,
} from '@/emails/ClientSubmissionConfirmation'
import {
  contactInquiryAdminSubject,
  buildContactInquiryAdminHtml,
  contactInquiryAcknowledgementSubject,
  buildContactInquiryAcknowledgementHtml,
} from '@/emails/ContactInquiry'
import { firstOrderOfferCodeSubject, buildFirstOrderOfferCodeHtml } from '@/emails/FirstOrderOfferCode'
import { firstOrderOfferReminderSubject, buildFirstOrderOfferReminderHtml } from '@/emails/FirstOrderOfferReminder'
import { intakeLinkRequestSubject, buildIntakeLinkRequestHtml } from '@/emails/IntakeLinkRequest'
import { invoiceIssuedSubject, invoiceRevisedSubject, buildInvoiceIssuedHtml } from '@/emails/InvoiceIssued'
import { shipmentUpdateSubject, buildInvoiceShipmentUpdateHtml } from '@/emails/InvoiceShipmentUpdate'
import { leadCapturedSubject, buildLeadCapturedHtml } from '@/emails/LeadCaptured'
import { buildOrderConfirmationHtml } from '@/emails/OrderConfirmation'
import { paymentReceivedSubject, buildPaymentReceivedHtml } from '@/emails/PaymentReceived'
import {
  portalInviteSubject,
  buildPortalInviteHtml,
  portalInviteReminderSubject,
  buildPortalInviteReminderHtml,
  portalAccountClaimedSubject,
  buildPortalAccountClaimedHtml,
} from '@/emails/PortalInvite'
import {
  supportRequestReceivedSubject,
  buildSupportRequestReceivedHtml,
  supportRequestAdminAlertSubject,
  buildSupportRequestAdminAlertHtml,
} from '@/emails/PortalSupport'
import {
  refundRequestedSubject,
  buildRefundRequestedHtml,
  accountCreditIssuedSubject,
  buildAccountCreditIssuedHtml,
} from '@/emails/RefundNotice'
import { buildTrackingUpdateHtml } from '@/emails/TrackingUpdate'

export interface EmailTemplatePreview {
  key: string
  label: string
  category: string
  subject: string
  html: string
}

// Fixed, obviously-fake sample identity reused across every preview so an
// admin scanning the list immediately recognizes none of it is real.
const SAMPLE_CUSTOMER = 'Jordan Rivera'
const SAMPLE_INVOICE = 'PS-2026-000099'
const SAMPLE_ORDER = 'ORD-2026-000099'
const SAMPLE_APP_URL = 'https://pepscorelab.com'
const SAMPLE_DATE = new Date('2026-08-15T14:30:00Z')

function build(): EmailTemplatePreview[] {
  return [
    // --- Orders & Payments -------------------------------------------------
    {
      key: 'order-confirmation',
      label: 'Order Confirmation',
      category: 'Orders & Payments',
      subject: 'Order Confirmation',
      html: buildOrderConfirmationHtml({
        orderNumber: SAMPLE_ORDER,
        customerName: SAMPLE_CUSTOMER,
        items: [
          { name: 'Semaglutide', size: '5mg', quantity: 1, unitPrice: 370 },
          { name: 'BAC Water', size: '3ml', quantity: 2, unitPrice: 25 },
        ],
        subtotal: 420,
        shippingCost: 15,
        total: 435,
        invoiceNumber: SAMPLE_INVOICE,
      }),
    },
    {
      key: 'ach-payment-processing',
      label: 'ACH Payment Processing',
      category: 'Orders & Payments',
      subject: achPaymentProcessingSubject(SAMPLE_ORDER),
      html: buildAchPaymentProcessingHtml({
        orderNumber: SAMPLE_ORDER,
        customerName: SAMPLE_CUSTOMER,
        total: 435,
        bankName: 'Chase',
        bankAccountLast4: '4321',
      }),
    },
    {
      key: 'payment-received',
      label: 'Payment Received',
      category: 'Orders & Payments',
      subject: paymentReceivedSubject(SAMPLE_INVOICE),
      html: buildPaymentReceivedHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        amountPaid: 435,
        balanceDue: 0,
        total: 435,
      }),
    },
    {
      key: 'payment-selection-confirmation',
      label: 'Payment Selection Confirmation',
      category: 'Orders & Payments',
      subject: paymentSelectionConfirmationSubject(SAMPLE_INVOICE),
      html: buildPaymentSelectionConfirmationHtml(SAMPLE_CUSTOMER, SAMPLE_INVOICE),
    },
    // --- Invoices ------------------------------------------------------------
    {
      key: 'invoice-issued',
      label: 'Invoice Issued',
      category: 'Invoices',
      subject: invoiceIssuedSubject(SAMPLE_INVOICE),
      html: buildInvoiceIssuedHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        total: 435,
        amountPaid: 0,
        balanceDue: 435,
        secureLink: `${SAMPLE_APP_URL}/intake/sample-token`,
      }),
    },
    {
      key: 'invoice-revised',
      label: 'Invoice Revised',
      category: 'Invoices',
      subject: invoiceRevisedSubject(SAMPLE_INVOICE),
      html: buildInvoiceIssuedHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        total: 460,
        amountPaid: 0,
        balanceDue: 460,
        secureLink: `${SAMPLE_APP_URL}/intake/sample-token`,
        previousTotal: 435,
      }),
    },
    {
      key: 'invoice-shipment-update',
      label: 'Invoice Shipment Update (In Transit)',
      category: 'Invoices',
      subject: shipmentUpdateSubject('IN_TRANSIT' as ShippingStatus, SAMPLE_INVOICE),
      html: buildInvoiceShipmentUpdateHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        status: 'IN_TRANSIT' as ShippingStatus,
        carrier: 'USPS',
        trackingNumber: '9500110200881234567890',
        trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9500110200881234567890',
        latestMessage: 'Departed USPS regional facility',
        estimatedDeliveryAt: new Date('2026-08-18T00:00:00Z'),
      }),
    },
    {
      key: 'balance-transfer-notice',
      label: 'Balance Transfer Notice',
      category: 'Invoices',
      subject: balanceTransferNoticeSubject(SAMPLE_INVOICE),
      html: buildBalanceTransferNoticeHtml({
        customerName: SAMPLE_CUSTOMER,
        amount: 100,
        sourceInvoiceNumber: 'PS-2026-000098',
        destinationInvoiceNumber: SAMPLE_INVOICE,
        destinationBalanceDue: 335,
      }),
    },
    {
      key: 'tracking-update',
      label: 'Tracking Update (Storefront Order)',
      category: 'Invoices',
      subject: 'Your Order Is On Its Way',
      html: buildTrackingUpdateHtml({
        customerName: SAMPLE_CUSTOMER,
        orderNumber: SAMPLE_ORDER,
        carrier: 'USPS',
        trackingNumber: '9500110200881234567890',
        trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9500110200881234567890',
      }),
    },
    // --- Backorders & Refunds ------------------------------------------------
    {
      key: 'backorder-notice',
      label: 'Backorder Notice',
      category: 'Backorders & Refunds',
      subject: backorderNoticeSubject(SAMPLE_INVOICE),
      html: buildBackorderNoticeHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        productName: 'Tesamorelin 10mg',
        expectedAvailableDate: new Date('2026-09-01T00:00:00Z'),
        compensationLines: ['A $25.00 account credit was applied for the delay.'],
      }),
    },
    {
      key: 'backorder-resolved',
      label: 'Backorder Resolved',
      category: 'Backorders & Refunds',
      subject: backorderResolvedSubject(SAMPLE_INVOICE),
      html: buildBackorderResolvedHtml({ customerName: SAMPLE_CUSTOMER, invoiceNumber: SAMPLE_INVOICE, productName: 'Tesamorelin 10mg' }),
    },
    {
      key: 'backorder-accommodation',
      label: 'Backorder Accommodation',
      category: 'Backorders & Refunds',
      subject: backorderAccommodationSubject(SAMPLE_INVOICE),
      html: buildBackorderAccommodationHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        accommodationAmount: 25,
        revisedBalanceDue: 410,
        reason: '2-week backorder on Tesamorelin 10mg',
        portalUrl: `${SAMPLE_APP_URL}/account/invoices/sample-id`,
      }),
    },
    {
      key: 'refund-completed',
      label: 'Refund Completed',
      category: 'Backorders & Refunds',
      subject: refundCompletedSubject(SAMPLE_INVOICE),
      html: buildRefundCompletedHtml({ customerName: SAMPLE_CUSTOMER, invoiceNumber: SAMPLE_INVOICE, amount: 50, method: 'Cash App' }),
    },
    {
      key: 'refund-requested',
      label: 'Refund Requested',
      category: 'Backorders & Refunds',
      subject: refundRequestedSubject(SAMPLE_INVOICE),
      html: buildRefundRequestedHtml({ customerName: SAMPLE_CUSTOMER, invoiceNumber: SAMPLE_INVOICE, requestedAmount: 50, reason: 'Damaged in transit' }),
    },
    {
      key: 'account-credit-issued',
      label: 'Account Credit Issued',
      category: 'Backorders & Refunds',
      subject: accountCreditIssuedSubject(SAMPLE_INVOICE),
      html: buildAccountCreditIssuedHtml({ customerName: SAMPLE_CUSTOMER, invoiceNumber: SAMPLE_INVOICE, amount: 25, reason: 'Backorder accommodation' }),
    },
    // --- Payment Arrangements --------------------------------------------
    {
      key: 'arrangement-request-received',
      label: 'Arrangement Request Received',
      category: 'Payment Arrangements',
      subject: arrangementRequestReceivedSubject(SAMPLE_INVOICE),
      html: buildArrangementRequestReceivedHtml(SAMPLE_CUSTOMER, SAMPLE_INVOICE),
    },
    {
      key: 'arrangement-approved',
      label: 'Arrangement Approved',
      category: 'Payment Arrangements',
      subject: arrangementApprovedSubject(SAMPLE_INVOICE),
      html: buildArrangementApprovedHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        invoiceTotal: 435,
        amountPaid: 145,
        balanceDue: 290,
        paymentStatus: 'PARTIALLY_PAID',
        frequency: 'Biweekly',
        downPayment: 145,
        installmentCount: 3,
        scheduleSummary: '3 payments of $96.67 every 2 weeks',
      }),
    },
    {
      key: 'arrangement-denied',
      label: 'Arrangement Denied',
      category: 'Payment Arrangements',
      subject: arrangementDeniedSubject(SAMPLE_INVOICE),
      html: buildArrangementDeniedHtml({
        customerName: SAMPLE_CUSTOMER,
        invoiceNumber: SAMPLE_INVOICE,
        reason: 'Proposed schedule extends beyond our 60-day policy.',
        secureLink: `${SAMPLE_APP_URL}/intake/sample-token`,
        paymentStatus: 'UNPAID',
        balanceDue: 435,
      }),
    },
    // --- Portal & Account ----------------------------------------------------
    {
      key: 'portal-invite',
      label: 'Portal Invite',
      category: 'Portal & Account',
      subject: portalInviteSubject(),
      html: buildPortalInviteHtml({ customerName: SAMPLE_CUSTOMER, claimUrl: `${SAMPLE_APP_URL}/account/claim/sample-token`, expiresAt: new Date('2026-08-22T00:00:00Z') }),
    },
    {
      key: 'portal-invite-reminder',
      label: 'Portal Invite Reminder',
      category: 'Portal & Account',
      subject: portalInviteReminderSubject(),
      html: buildPortalInviteReminderHtml({ customerName: SAMPLE_CUSTOMER, claimUrl: `${SAMPLE_APP_URL}/account/claim/sample-token`, expiresAt: new Date('2026-08-22T00:00:00Z') }),
    },
    {
      key: 'portal-account-claimed',
      label: 'Portal Account Claimed',
      category: 'Portal & Account',
      subject: portalAccountClaimedSubject(),
      html: buildPortalAccountClaimedHtml({ customerName: SAMPLE_CUSTOMER, portalUrl: `${SAMPLE_APP_URL}/account` }),
    },
    {
      key: 'intake-link-request',
      label: 'Intake Link Request',
      category: 'Portal & Account',
      subject: intakeLinkRequestSubject(),
      html: buildIntakeLinkRequestHtml({ customerName: SAMPLE_CUSTOMER, link: `${SAMPLE_APP_URL}/intake/sample-token` }),
    },
    // --- Support & Contact -----------------------------------------------
    {
      key: 'support-request-received',
      label: 'Support Request Received',
      category: 'Support & Contact',
      subject: supportRequestReceivedSubject(),
      html: buildSupportRequestReceivedHtml({ customerName: SAMPLE_CUSTOMER, message: 'When will my order ship?' }),
    },
    {
      key: 'contact-inquiry-acknowledgement',
      label: 'Contact Inquiry Acknowledgement',
      category: 'Support & Contact',
      subject: contactInquiryAcknowledgementSubject(),
      html: buildContactInquiryAcknowledgementHtml({ name: SAMPLE_CUSTOMER }),
    },
    // --- Promotions --------------------------------------------------------
    {
      key: 'first-order-offer-code',
      label: 'First Order Offer Code',
      category: 'Promotions',
      subject: firstOrderOfferCodeSubject({
        firstName: 'Jordan',
        publicTitle: 'Welcome Offer',
        discountType: 'PERCENTAGE' as PromotionType,
        discountValue: 10,
        code: 'WELCOME10',
        expiresAt: new Date('2026-09-15T00:00:00Z'),
      }),
      html: buildFirstOrderOfferCodeHtml({
        firstName: 'Jordan',
        publicTitle: 'Welcome Offer',
        publicDescription: 'Save on your first order.',
        discountType: 'PERCENTAGE' as PromotionType,
        discountValue: 10,
        code: 'WELCOME10',
        expiresAt: new Date('2026-09-15T00:00:00Z'),
      }),
    },
    {
      key: 'first-order-offer-reminder',
      label: 'First Order Offer Reminder (Nurture)',
      category: 'Promotions',
      subject: firstOrderOfferReminderSubject({
        firstName: 'Jordan',
        publicTitle: 'Welcome Offer',
        discountType: 'PERCENTAGE' as PromotionType,
        discountValue: 10,
        code: 'WELCOME10',
        isFinalReminder: false,
        customerId: 'sample-customer',
      }),
      html: buildFirstOrderOfferReminderHtml({
        firstName: 'Jordan',
        publicTitle: 'Welcome Offer',
        discountType: 'PERCENTAGE' as PromotionType,
        discountValue: 10,
        code: 'WELCOME10',
        isFinalReminder: false,
        customerId: 'sample-customer',
      }),
    },
    {
      key: 'lead-captured',
      label: 'Lead Captured (Admin Notification)',
      category: 'Promotions',
      subject: leadCapturedSubject({ name: SAMPLE_CUSTOMER, interestType: 'PRODUCT_INTEREST', sourcePage: '/products/semaglutide-5mg', isNewCustomer: true }),
      html: buildLeadCapturedHtml({
        name: SAMPLE_CUSTOMER,
        email: 'jordan@example.com',
        phone: '(202) 555-0199',
        interestType: 'PRODUCT_INTEREST',
        productName: 'Semaglutide',
        productSize: '5mg',
        message: 'Is this currently in stock?',
        sourcePage: '/products/semaglutide-5mg',
        isNewCustomer: true,
      }),
    },
    // --- Admin Alerts --------------------------------------------------------
    {
      key: 'admin-intake-notification',
      label: 'Admin: New Intake Submitted',
      category: 'Admin Alerts',
      subject: adminIntakeNotificationSubject(SAMPLE_CUSTOMER),
      html: buildAdminIntakeNotificationHtml({ customerName: SAMPLE_CUSTOMER, invoiceNumber: SAMPLE_INVOICE, isNewCustomer: true, submittedAt: SAMPLE_DATE }),
    },
    {
      key: 'admin-payment-selection-pending',
      label: 'Admin: Payment Selection Pending',
      category: 'Admin Alerts',
      subject: paymentSelectionPendingSubject(SAMPLE_INVOICE),
      html: buildPaymentSelectionPendingHtml({
        invoiceNumber: SAMPLE_INVOICE,
        invoiceId: 'sample-invoice-id',
        clientName: SAMPLE_CUSTOMER,
        clientPhone: '(202) 555-0199',
        clientEmail: 'jordan@example.com',
        invoiceTotal: 435,
        amountPaid: 0,
        balanceDue: 435,
        selectedMethod: 'ACH',
        submittedAt: SAMPLE_DATE,
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-arrangement-request-pending',
      label: 'Admin: Arrangement Request Pending',
      category: 'Admin Alerts',
      subject: arrangementRequestPendingSubject(SAMPLE_INVOICE),
      html: buildArrangementRequestPendingHtml({
        invoiceNumber: SAMPLE_INVOICE,
        invoiceId: 'sample-invoice-id',
        clientName: SAMPLE_CUSTOMER,
        clientPhone: '(202) 555-0199',
        clientEmail: 'jordan@example.com',
        invoiceTotal: 435,
        amountPaid: 145,
        balanceDue: 290,
        paymentStatus: 'PARTIALLY_PAID',
        frequency: 'Biweekly',
        proposedDownPayment: 145,
        installmentCount: 3,
        scheduleSummary: '3 payments of $96.67 every 2 weeks',
        submittedAt: SAMPLE_DATE,
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-backorder-financial-action-required',
      label: 'Admin: Manual Refund Required (Backorder)',
      category: 'Admin Alerts',
      subject: backorderFinancialActionRequiredSubject(SAMPLE_INVOICE),
      html: buildBackorderFinancialActionRequiredHtml({
        invoiceNumber: SAMPLE_INVOICE,
        invoiceId: 'sample-invoice-id',
        refundId: 'sample-refund-id',
        clientName: SAMPLE_CUSTOMER,
        refundAmount: 25,
        reason: '2-week backorder on Tesamorelin 10mg, invoice already paid',
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-refund-action-required',
      label: 'Admin: Manual Refund Required',
      category: 'Admin Alerts',
      subject: refundActionRequiredSubject(SAMPLE_INVOICE),
      html: buildRefundActionRequiredHtml({
        invoiceNumber: SAMPLE_INVOICE,
        invoiceId: 'sample-invoice-id',
        refundId: 'sample-refund-id',
        clientName: SAMPLE_CUSTOMER,
        refundAmount: 50,
        reason: 'Damaged in transit',
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-profile-email-change-requested',
      label: 'Admin: Profile Email Change Requested',
      category: 'Admin Alerts',
      subject: profileEmailChangeRequestedSubject(),
      html: buildProfileEmailChangeRequestedHtml({
        customerName: SAMPLE_CUSTOMER,
        customerId: 'sample-customer-id',
        currentEmail: 'jordan.old@example.com',
        requestedEmail: 'jordan@example.com',
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-support-request-alert',
      label: 'Admin: New Support Request',
      category: 'Admin Alerts',
      subject: supportRequestAdminAlertSubject(SAMPLE_CUSTOMER),
      html: buildSupportRequestAdminAlertHtml({
        customerName: SAMPLE_CUSTOMER,
        customerId: 'sample-customer-id',
        message: 'When will my order ship?',
        invoiceNumber: SAMPLE_INVOICE,
        invoiceId: 'sample-invoice-id',
        appUrl: SAMPLE_APP_URL,
      }),
    },
    {
      key: 'admin-contact-inquiry',
      label: 'Admin: Contact Inquiry',
      category: 'Admin Alerts',
      subject: contactInquiryAdminSubject(SAMPLE_CUSTOMER),
      html: buildContactInquiryAdminHtml({
        name: SAMPLE_CUSTOMER,
        email: 'jordan@example.com',
        phone: '(202) 555-0199',
        company: undefined,
        inquiryType: 'General',
        message: 'Do you offer wholesale pricing?',
      }),
    },
  ]
}

let cached: EmailTemplatePreview[] | null = null

// Building every template is cheap (pure string concatenation, no I/O) but
// there's no reason to redo it per request within the same server instance.
export function getAllEmailTemplatePreviews(): EmailTemplatePreview[] {
  if (!cached) cached = build()
  return cached
}
