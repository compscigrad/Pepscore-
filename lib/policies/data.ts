// Admin Policies & Operations Center -- the ONE canonical, owner-facing
// definition of Pepscore's current operating rules (2026-08-20). Every
// numeric rule that has a real, live implementation imports its value
// directly from that implementation rather than re-typing it here, so this
// page can never silently drift out of sync with what the software
// actually does -- see lib/policies/data.test.ts for the tests that pin
// this.
//
// Standing rule (Definition of Done, per the owner's own instruction): any
// meaningful new Pepscore business policy introduced by a future sprint
// must be evaluated for inclusion here. A sprint that introduces a new
// material owner-operational rule but leaves this file stale is not
// complete.
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING_RATE } from '@/lib/storefront/shipping'
import { STANDARD_VOLUME_TIERS } from '@/lib/pricing/canonicalPricing'
import { EVALUATION_CREDIT_DEFAULT_VALIDITY_DAYS } from '@/lib/professionalEvaluation/pricing'
import { RECOGNIZED_REVENUE_STATUSES } from '@/lib/finance/reports'

export type PolicyCategory =
  | 'PRICING_DISCOUNTS'
  | 'PROFESSIONAL_ACCESS'
  | 'PRICE_MATCH_PREFERRED_PRICING'
  | 'SAMPLES_EVALUATION'
  | 'SHIPPING_FULFILLMENT'
  | 'RETURNS_REFUNDS'
  | 'DIRECT_SALES_INVOICES'
  | 'CUSTOMER_ACCOUNTS_PORTAL'
  | 'LEAD_CAPTURE_PROMOTIONS'
  | 'CUSTOMER_COMMUNICATIONS'
  | 'FINANCE_TAX'
  | 'RUO_COMPLIANCE'
  | 'SECURITY_ADMIN'
  | 'DATA_AUDIT_TRAIL'

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  PRICING_DISCOUNTS: 'A. Pricing & Discounts',
  PROFESSIONAL_ACCESS: 'B. Professional Access',
  PRICE_MATCH_PREFERRED_PRICING: 'C. Price Match & Preferred Pricing',
  SAMPLES_EVALUATION: 'D. Samples & Evaluation Units',
  SHIPPING_FULFILLMENT: 'E. Shipping & Fulfillment',
  RETURNS_REFUNDS: 'F. Returns / Refunds',
  DIRECT_SALES_INVOICES: 'G. Direct Sales & Invoices',
  CUSTOMER_ACCOUNTS_PORTAL: 'H. Customer Accounts / Portal',
  LEAD_CAPTURE_PROMOTIONS: 'I. Lead Capture & Promotions',
  CUSTOMER_COMMUNICATIONS: 'J. Customer Communications',
  FINANCE_TAX: 'K. Finance & Tax Operations',
  RUO_COMPLIANCE: 'L. RUO / Compliance Boundaries',
  SECURITY_ADMIN: 'M. Security / Admin Controls',
  DATA_AUDIT_TRAIL: 'N. Data / Audit Trail',
}

export type PolicyStatus = 'ACTIVE' | 'DRAFT' | 'DEPRECATED' | 'OWNER_REVIEW_REQUIRED' | 'EXTERNAL_DEPENDENCY'
export type PolicyOverride = 'YES' | 'NO' | 'LIMITED'
export type PolicyEnforcement = 'SYSTEM_ENFORCED' | 'OPERATIONAL_GUIDANCE'

export interface Policy {
  id: string
  name: string
  category: PolicyCategory
  currentRule: string
  businessRationale?: string
  appliesTo: string
  ownerOverride: PolicyOverride
  overrideNotes?: string
  doNot?: string[]
  status: PolicyStatus
  enforcement: PolicyEnforcement
  relatedWorkflow?: { label: string; href: string }
  sourceRef: string
  lastUpdated: string
  quickReference?: boolean
}

const tierLine = (t: { minCases: number; maxCases: number | null; rate: number }) =>
  `${t.minCases}${t.maxCases ? `–${t.maxCases}` : '+'} cases: ${t.rate === 0 ? 'standard price' : `${t.rate * 100}%`}`

export const POLICIES: Policy[] = [
  // ─── A. Pricing & Discounts ────────────────────────────────────────────
  {
    id: 'standard-volume-case-savings',
    name: 'Standard Volume Case Savings',
    category: 'PRICING_DISCOUNTS',
    currentRule: `Automatic, server-side discount on Standard Case purchases, aggregated across every qualifying Standard Case line in one order: ${STANDARD_VOLUME_TIERS.map(tierLine).join(' · ')}.`,
    businessRationale: 'Rewards larger standard orders without requiring a coupon code or manual approval, while keeping Professional pricing a distinct, separately-earned tier rather than just a bigger volume discount.',
    appliesTo: 'Standard (non-Professional) customers, Standard Case lines only',
    ownerOverride: 'NO',
    overrideNotes: 'Rate table is code, not admin-editable data. Changing the tiers requires an engineering change and a new Decision entry.',
    doNot: ['Issue this as a coupon/promo code', 'Apply it to Professional, Bulk, or Individual Vial lines', 'Stack it on top of Professional pricing'],
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/canonicalPricing.ts (STANDARD_VOLUME_TIERS), Decision #75',
    lastUpdated: '2026-08-19',
    quickReference: true,
  },
  {
    id: 'canonical-pricing-precedence',
    name: 'One Canonical Pricing Engine, Non-Stacking Precedence',
    category: 'PRICING_DISCOUNTS',
    currentRule: 'Every real transaction (storefront checkout, admin invoices, reorders) resolves price through the same engine: Preferred Price / Price Match (if active and lower) beats Professional, which beats the Standard Volume ladder, which beats sticker price. Precedence layers never stack -- the winning layer is the final price for that line.',
    businessRationale: 'A second, disconnected pricing calculator anywhere in the app is how prices silently drift between the storefront, admin invoices, and reports. One engine means one truth.',
    appliesTo: 'Every priced line, every surface',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/canonicalPricing.ts, Decisions #75, #77',
    lastUpdated: '2026-08-20',
  },

  // ─── B. Professional Access ────────────────────────────────────────────
  {
    id: 'professional-access-case-only',
    name: 'Professional Access Is Case-Only Purchasing',
    category: 'PROFESSIONAL_ACCESS',
    currentRule: 'An approved Professional account purchases by complete case at Professional pricing. There is no recurring monthly minimum, subscription, or minimum annual spend requirement.',
    businessRationale: 'Buying by complete case is itself what distinguishes Professional procurement from individual-vial purchasing -- an arbitrary volume quota is not required to make the relationship meaningful.',
    appliesTo: 'Approved Professional accounts',
    ownerOverride: 'LIMITED',
    overrideNotes: 'A recurring minimum could be introduced later, but only as an explicit, separate owner-approved policy change -- never assumed.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Professional Applications', href: '/admin/professional-access' },
    sourceRef: 'lib/pricing/canonicalPricing.ts, docs/Decisions.md #75, Sample Program appendix section 1',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'professional-access-no-stacking',
    name: 'Professional Pricing Never Stacks With the Volume Ladder',
    category: 'PROFESSIONAL_ACCESS',
    currentRule: 'A Professional Case line never additionally receives the Standard Volume Case Savings discount -- Professional pricing is already the preferred tier and is final for that line.',
    appliesTo: 'Professional Case lines',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/canonicalPricing.ts',
    lastUpdated: '2026-08-19',
  },
  {
    id: 'professional-access-fulfillment-expectation',
    name: 'Professional Order Fulfillment Expectation',
    category: 'PROFESSIONAL_ACCESS',
    currentRule: 'Professional Case orders are communicated as shipping in approximately two weeks -- produced to order.',
    appliesTo: 'Professional Case purchases',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'OPERATIONAL_GUIDANCE',
    sourceRef: 'components/storefront/ProductDetail.tsx, ProductCard.tsx, emails/ProfessionalAccess.tsx',
    lastUpdated: '2026-08-19',
  },
  {
    id: 'professional-access-verification-required',
    name: 'Verified Application Required',
    category: 'PROFESSIONAL_ACCESS',
    currentRule: 'Professional Access is never self-service or automatic. A verified business/research application must be Admin-approved (or an Admin-issued early-launch invite accepted) before Professional pricing appears for an account.',
    appliesTo: 'All accounts',
    ownerOverride: 'YES',
    overrideNotes: 'Admin can approve, reject, request more information, or revoke at any time from the review queue.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Professional Applications', href: '/admin/professional-access' },
    sourceRef: 'lib/professionalAccess/, Decision #75',
    lastUpdated: '2026-08-19',
  },

  // ─── C. Price Match & Preferred Pricing ────────────────────────────────
  {
    id: 'price-match-delivered-cost-basis',
    name: 'Price Match Compares Delivered Cost, Not Sticker Price',
    category: 'PRICE_MATCH_PREFERRED_PRICING',
    currentRule: 'A price match request is evaluated against the competitor\'s total delivered price (item + their shipping), never their bare listed price alone.',
    businessRationale: 'A lower sticker price with high shipping can still be a worse deal -- comparing delivered cost keeps the match honest.',
    appliesTo: 'Every Price Match request',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Price Match Queue', href: '/admin/price-match' },
    sourceRef: 'lib/priceMatch/, Decision #77',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'price-match-admin-approval-required',
    name: 'Price Match Requires Admin Approval',
    category: 'PRICE_MATCH_PREFERRED_PRICING',
    currentRule: 'Every price match request is reviewed by hand -- there is no auto-match threshold or automatic approval rule. An approval creates a specific, product-and-sell-unit-scoped authorization, never a cart-wide or account-wide discount.',
    businessRationale: 'Keeps pricing decisions deliberate and product-specific rather than a generic, exploitable discount rule.',
    appliesTo: 'Every Price Match request',
    ownerOverride: 'YES',
    overrideNotes: 'Admin can approve, reject, or request more information; approval requires an exact price and one of three durations.',
    doNot: ['Auto-approve based on a percentage threshold', 'Apply an approval to the whole cart instead of the specific product/sell unit'],
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Price Match Queue', href: '/admin/price-match' },
    sourceRef: 'lib/priceMatch/requests.ts, Decisions #77, #79',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'preferred-pricing-durations',
    name: 'Preferred Pricing Authorization Durations',
    category: 'PRICE_MATCH_PREFERRED_PRICING',
    currentRule: 'An approved authorization is one of exactly three types: valid for one purchase, valid until a specific date, or valid until revoked.',
    appliesTo: 'Approved Price Match authorizations',
    ownerOverride: 'YES',
    overrideNotes: 'Admin chooses the duration at approval time and can revoke an ongoing authorization at any time.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Price Match Queue', href: '/admin/price-match' },
    sourceRef: 'prisma/schema.prisma (PriceMatchAuthorizationType), Decision #77',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'preferred-pricing-lower-wins',
    name: 'A Preferred Price Never Costs the Customer More',
    category: 'PRICE_MATCH_PREFERRED_PRICING',
    currentRule: 'An active preferred price only ever applies when it is strictly lower than what the line would otherwise resolve to. A stale authorization (e.g. after a later catalog price drop) never overrides a better current price.',
    appliesTo: 'Every active Preferred Pricing authorization',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/canonicalPricing.ts (PRICE_MATCH precedence), Decision #77',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'preferred-pricing-isolation',
    name: 'Preferred Pricing Is Product- and Customer-Isolated',
    category: 'PRICE_MATCH_PREFERRED_PRICING',
    currentRule: 'An authorization applies only to the exact customer, product, and sell unit it was granted for. It never discounts a different product, a different variant/strength, or a different customer\'s cart.',
    appliesTo: 'Every active Preferred Pricing authorization',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/preferredPricing.ts, canonicalPricing.test.ts isolation tests',
    lastUpdated: '2026-08-20',
  },

  // ─── D. Samples & Evaluation Units ─────────────────────────────────────
  {
    id: 'evaluation-not-automatic-entitlement',
    name: 'Samples Are Not an Automatic Professional Benefit',
    category: 'SAMPLES_EVALUATION',
    currentRule: 'Professional Access does not by itself entitle an account to a free or discounted sample. An evaluation unit is only available for a SKU an Admin has explicitly enabled, and is only issued by an explicit Admin action.',
    businessRationale: 'Prevents informal giveaways, inconsistent pricing, and inventory ambiguity while still allowing Pepscore to build relationships with qualified organizations.',
    appliesTo: 'Professional accounts',
    ownerOverride: 'YES',
    overrideNotes: 'Admin enables evaluation eligibility per SKU from the Inventory Detail Panel.',
    doNot: ['Assume Professional Access alone unlocks samples', 'Issue an evaluation unit for a SKU that is not explicitly enabled'],
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/professionalEvaluation/, Decision #82',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'evaluation-paid-default',
    name: 'Paid Evaluation Is the Default Method',
    category: 'SAMPLES_EVALUATION',
    currentRule: 'The default evaluation method is a paid unit, priced from the customer\'s own current applicable case price divided by the product\'s real case quantity -- never a flat or invented number. Complimentary is an explicit exception an Admin must separately choose.',
    appliesTo: 'Evaluation-eligible products',
    ownerOverride: 'YES',
    overrideNotes: 'Admin selects Paid or Complimentary at issuance, subject to the SKU\'s configured evaluation method (paid-only / complimentary-allowed / both).',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Customer Profile', href: '/admin/customers' },
    sourceRef: 'lib/professionalEvaluation/pricing.ts, Decision #82',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'evaluation-fresh-full-case',
    name: 'A Later Case Purchase Is Always a Fresh, Complete Case',
    category: 'SAMPLES_EVALUATION',
    currentRule: 'An evaluation unit is its own separate inventory/fulfillment event. If a customer later purchases a full case of the same product, they receive a complete fresh case -- never the remaining units from a previously opened evaluation case.',
    businessRationale: 'Prevents partial-case fulfillment ambiguity, inconsistent packaging, and confusing inventory.',
    appliesTo: 'Evaluation-eligible products',
    ownerOverride: 'NO',
    doNot: ['Fulfill a case order using leftover units from an evaluation issuance'],
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/professionalEvaluation/service.ts, Decision #82',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'evaluation-credit-separate-from-quantity',
    name: 'Evaluation Credit Is a Monetary Adjustment, Not a Quantity Reduction',
    category: 'SAMPLES_EVALUATION',
    currentRule: `A paid evaluation may optionally carry a purchase credit toward one later qualifying full-case purchase of the same product, valid by default for ${EVALUATION_CREDIT_DEFAULT_VALIDITY_DAYS} days (configurable per product). Redeeming it reduces the invoice total by the credit amount -- it never reduces the physical case quantity delivered. It is single-use, product-specific, customer-specific, and non-transferable.`,
    appliesTo: 'Paid evaluations on credit-eligible products',
    ownerOverride: 'YES',
    overrideNotes: 'Admin chooses credit eligibility at issuance; the validity window is configurable per product.',
    doNot: ['Apply a credit to a different product or a different customer', 'Redeem the same credit twice', 'Redeem an expired credit'],
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/professionalEvaluation/service.ts (redeemEvaluationCredit), Decision #82',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'evaluation-complimentary-no-auto-credit',
    name: 'A Complimentary Sample Never Auto-Generates a Credit',
    category: 'SAMPLES_EVALUATION',
    currentRule: 'A complimentary evaluation unit cannot automatically carry a purchase credit -- requesting one is rejected outright. Granting an additional future credit for a complimentary sample would require a separate, explicit Admin action.',
    businessRationale: 'Prevents a free sample plus an automatic additional discount from stacking accidentally.',
    appliesTo: 'Complimentary evaluations',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/professionalEvaluation/service.ts, Decision #82',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'evaluation-no-barter',
    name: 'No Informal Barter Inside the Evaluation System',
    category: 'SAMPLES_EVALUATION',
    currentRule: 'The Sample & Evaluation Program never represents informal exchanges of products for services, treatments, or other consideration. Any genuine product-for-service exchange must be documented as a separate, explicitly agreed commercial transaction.',
    appliesTo: 'All evaluation issuance',
    ownerOverride: 'NO',
    doNot: ['Use a "free sample" as an undocumented substitute for payment or reciprocal services'],
    status: 'OWNER_REVIEW_REQUIRED',
    enforcement: 'OPERATIONAL_GUIDANCE',
    sourceRef: 'Sample & Evaluation Program appendix, section 15',
    lastUpdated: '2026-08-20',
  },

  // ─── E. Shipping & Fulfillment ─────────────────────────────────────────
  {
    id: 'storefront-shipping-rate',
    name: 'Storefront Shipping Rate',
    category: 'SHIPPING_FULFILLMENT',
    currentRule: `Orders under $${FREE_SHIPPING_THRESHOLD} are charged a flat $${FLAT_SHIPPING_RATE.toFixed(2)} for shipping. Orders of $${FREE_SHIPPING_THRESHOLD} or more ship free.`,
    businessRationale: 'A flat rate avoids calling a real carrier rate-shopping API (and its cost) merely to price checkout shipping.',
    appliesTo: 'Every storefront checkout',
    ownerOverride: 'LIMITED',
    overrideNotes: 'The threshold and rate are code constants, not admin-editable — changing them requires an engineering change.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/storefront/shipping.ts, Decision #77',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'self-delivery-no-tracking-required',
    name: 'Self Delivery Is a Valid Fulfillment Method Without Tracking',
    category: 'SHIPPING_FULFILLMENT',
    currentRule: 'Hand-delivered/self-fulfilled orders (carrier: Pickup, Hand Delivery, or Courier) are a legitimate fulfillment path that does not require a tracking number or a purchased shipping label.',
    appliesTo: 'Orders fulfilled without a third-party carrier',
    ownerOverride: 'YES',
    overrideNotes: 'Admin selects the carrier/fulfillment method per order.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'prisma/schema.prisma (ShippingCarrier), lib/invoice/validation.ts',
    lastUpdated: '2026-08-12',
    quickReference: true,
  },
  {
    id: 'no-real-label-purchase-in-testing',
    name: 'No Automatic Real Shipping Label Purchase',
    category: 'SHIPPING_FULFILLMENT',
    currentRule: 'Real shipping label purchasing stays behind an explicit activation gate and is never triggered automatically by testing, rehearsal, or development activity.',
    appliesTo: 'All environments',
    ownerOverride: 'YES',
    overrideNotes: 'Owner activates real label purchasing explicitly once Shippo account review clears.',
    status: 'EXTERNAL_DEPENDENCY',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'docs/PendingOwnerActions.md #4',
    lastUpdated: '2026-08-12',
  },

  // ─── G. Direct Sales & Invoices ────────────────────────────────────────
  {
    id: 'direct-sale-engine-parity',
    name: 'Direct Sales Use the Same Engine as the Storefront',
    category: 'DIRECT_SALES_INVOICES',
    currentRule: 'An admin-composed invoice resolves pricing, Professional entitlement, Preferred Pricing, and volume discounts through the exact same canonical pricing engine storefront checkout uses -- never a separate, hand-typed price.',
    businessRationale: 'A direct-sale customer must never see a different, less-favorable pricing reality than a storefront customer would for the identical purchase.',
    appliesTo: 'All admin-composed invoices',
    ownerOverride: 'LIMITED',
    overrideNotes: 'An explicit, auditable manual price override remains available for genuine one-off cases, always logged.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Invoices', href: '/admin/invoices' },
    sourceRef: 'components/invoices/InvoiceItemsTable.tsx, Decisions #75, #79',
    lastUpdated: '2026-08-20',
    quickReference: true,
  },
  {
    id: 'repeat-order-repricing',
    name: 'Repeat Orders Always Re-Resolve Current Pricing',
    category: 'DIRECT_SALES_INVOICES',
    currentRule: 'Reordering a past purchase re-checks the customer\'s CURRENT entitlement, preferred pricing, and catalog price -- it never blindly copies a historical price, even if the original order had a preferred/matched price that has since expired or been revoked.',
    appliesTo: 'Buy Again and admin-assisted reorder',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/storefront/reorder.ts, Decision #79',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'archived-product-non-deletion',
    name: 'Archived Products Are Never Deleted',
    category: 'DIRECT_SALES_INVOICES',
    currentRule: 'Retiring a product from active merchandising sets its status to archived/inactive -- it never deletes the product row, its pricing history, images, or any historical invoice/order that references it. Fully reversible via the same admin toggle.',
    appliesTo: 'All catalog products',
    ownerOverride: 'YES',
    overrideNotes: 'Admin can archive or reactivate a product at any time from Product Master.',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Product Master', href: '/admin/catalog/product-master' },
    sourceRef: 'lib/pricing/service.ts (pricingStatus), Decision #78',
    lastUpdated: '2026-08-20',
  },

  // ─── I. Lead Capture & Promotions ──────────────────────────────────────
  {
    id: 'existing-customer-promo-protection',
    name: 'Existing Customers Are Never Treated as First-Order-Eligible',
    category: 'LEAD_CAPTURE_PROMOTIONS',
    currentRule: 'A first-order promotion is only offered to a genuinely new customer. A person with prior direct-sale or storefront order history is never granted first-order eligibility merely because they just created a portal account.',
    businessRationale: 'Protects margin and fairness -- a first-order incentive is meant for acquisition, not for an existing relationship claiming a new-customer discount.',
    appliesTo: 'First-order promotion eligibility checks',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/promotions/firstOrderOffer.ts',
    lastUpdated: '2026-08-12',
  },

  // ─── K. Finance & Tax Operations ───────────────────────────────────────
  {
    id: 'finance-test-data-exclusion',
    name: 'Test/Rehearsal Data Never Counts as Real Revenue',
    category: 'FINANCE_TAX',
    currentRule: `Every Finance report and dashboard metric filters out invoices flagged isTestData, and only recognizes revenue for invoices with status in [${RECOGNIZED_REVENUE_STATUSES.join(', ')}]. A rehearsal or demo invoice can never inflate a real report.`,
    appliesTo: 'All Finance reporting',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    relatedWorkflow: { label: 'Open Finance Center', href: '/admin/finance' },
    sourceRef: 'lib/finance/reports.ts',
    lastUpdated: '2026-08-19',
    quickReference: true,
  },
  {
    id: 'no-real-charges-in-testing',
    name: 'No Real Payments, Labels, SMS, or Customer Email in Testing',
    category: 'FINANCE_TAX',
    currentRule: 'Rehearsals and development verification never place a real payment, purchase a real shipping label, send a real SMS, or email a real customer. Test scenarios use disposable data, run with the email provider key unset, and are cleaned up afterward.',
    appliesTo: 'All engineering verification/rehearsal work',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'OPERATIONAL_GUIDANCE',
    sourceRef: 'Established session-wide convention, e.g. Decisions #76, #77, #82',
    lastUpdated: '2026-08-20',
  },

  // ─── L. RUO / Compliance Boundaries ────────────────────────────────────
  {
    id: 'ruo-no-human-use-claims',
    name: 'Research Use Only -- No Human-Use Claims',
    category: 'RUO_COMPLIANCE',
    currentRule: 'No public or customer-facing surface claims or implies a product is intended for human use, consumption, diagnostic, therapeutic, or veterinary use. Pricing/entitlement programs (Professional Access, Price Match, Evaluation Units) change purchasing terms only -- never the RUO status of any product.',
    appliesTo: 'All public and customer-facing copy',
    ownerOverride: 'NO',
    doNot: ['Add or approve copy that implies human/therapeutic use', 'Ask an applicant to certify intended human use'],
    status: 'ACTIVE',
    enforcement: 'OPERATIONAL_GUIDANCE',
    sourceRef: 'emails/ProfessionalAccess.tsx (RUO_FOOTER), components/storefront/Footer.tsx, docs/launch/LegalComplianceStatus.md',
    lastUpdated: '2026-08-12',
    quickReference: true,
  },

  // ─── M. Security / Admin Controls ──────────────────────────────────────
  {
    id: 'admin-rbac',
    name: 'Admin-Only Financial and Operational Access',
    category: 'SECURITY_ADMIN',
    currentRule: 'Every admin API route requires a real ADMIN-role User row, resolved server-side (never trusted from client input). A signed-in customer with no admin role receives 403/404 on every admin surface, the same as an anonymous visitor.',
    appliesTo: 'Every /admin and /api/admin route',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/auth/rbac.ts',
    lastUpdated: '2026-08-15',
  },
  {
    id: 'preferred-pricing-never-email-matched',
    name: 'Protected Entitlements Are Never Resolved by Email Match',
    category: 'SECURITY_ADMIN',
    currentRule: 'Professional Access, Price Match/Preferred Pricing, and Evaluation credits are only ever resolved from an authenticated Clerk identity linked to a real Customer row -- never by a guest simply typing someone else\'s email address at checkout.',
    businessRationale: 'A promo code is an acceptable convenience to resolve by email; a protected, individually-negotiated entitlement is not -- email matching there would let anyone unlock another customer\'s price.',
    appliesTo: 'Professional Access, Preferred Pricing, Evaluation credits',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/storefront/professionalAccess.ts, lib/pricing/preferredPricing.ts',
    lastUpdated: '2026-08-19',
  },

  // ─── N. Data / Audit Trail ─────────────────────────────────────────────
  {
    id: 'price-change-audit-trail',
    name: 'Every Price Change Is Audited',
    category: 'DATA_AUDIT_TRAIL',
    currentRule: 'A product\'s active price can only be changed through the one audited write path, which automatically records a permanent, append-only history row for every change -- who changed it, when, from what, to what, and why.',
    appliesTo: 'All product active pricing',
    ownerOverride: 'NO',
    status: 'ACTIVE',
    enforcement: 'SYSTEM_ENFORCED',
    sourceRef: 'lib/pricing/service.ts (setActivePricing), lib/pricing/history.ts',
    lastUpdated: '2026-08-12',
  },
]

export function getPolicy(id: string): Policy | undefined {
  return POLICIES.find((p) => p.id === id)
}

export function getPoliciesByCategory(category: PolicyCategory): Policy[] {
  return POLICIES.filter((p) => p.category === category)
}

export function searchPolicies(query: string): Policy[] {
  const q = query.trim().toLowerCase()
  if (!q) return POLICIES
  return POLICIES.filter((p) =>
    [p.name, p.currentRule, p.businessRationale, p.appliesTo, CATEGORY_LABEL[p.category]]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q))
  )
}
