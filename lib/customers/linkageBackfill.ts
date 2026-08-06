// Pure decision logic for backfilling Invoice.customerId on invoices that
// were issued without ever being linked to a Customer record (Invoice.
// customerId is optional at creation — see lib/invoices.ts's createInvoice,
// `customerId: payload.customerId || undefined`). Separated from
// scripts/backfill-invoice-customer-linkage.ts's DB I/O so the
// categorization itself is unit-testable without a database, matching this
// repo's existing pure-logic backfill convention (lib/invoice/statusBackfill.ts).
//
// Every invoice already carries a point-in-time customer snapshot
// (customerName/customerEmail/customerPhone) independent of the Customer
// relation — that snapshot is the only thing this logic ever reads, and it
// is never modified by anything downstream of this file.
export interface OrphanInvoiceSnapshot {
  id: string
  invoiceNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
}

export interface ExistingCustomerCandidate {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase()
  return t || null
}

export function normalizePhone(phone: string | null | undefined): string | null {
  const d = phone?.replace(/\D/g, '')
  return d || null
}

// A conservative, explicit allowlist-style exclusion — never auto-create a
// real CRM Customer record for what is obviously placeholder/QA data. Errs
// toward excluding (routing to manual review) rather than guessing, per the
// same "never auto-merge on a weak signal" principle as
// findPossibleDuplicateCustomers().
const TEST_DATA_MARKERS = [/\btest\b/i, /\bqa\b/i]
const TEST_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net', 'test.com']

export function looksLikeTestData(name: string, email: string | null): boolean {
  if (TEST_DATA_MARKERS.some((re) => re.test(name))) return true
  const domain = email?.split('@')[1]?.toLowerCase()
  return Boolean(domain && TEST_EMAIL_DOMAINS.includes(domain))
}

// "Marvin Alexander" -> { firstName: "Marvin", lastName: "Alexander" }
// "Cher" -> { firstName: "Cher", lastName: "" }
// Deliberately simple (first token vs. rest) -- matches how customerName is
// itself just a single free-text snapshot field with no first/last split,
// so there is no more-authoritative source to parse against.
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() }
}

export interface OrphanGroup {
  key: string
  invoices: OrphanInvoiceSnapshot[]
  existingCandidates: ExistingCustomerCandidate[]
  name: string
  email: string | null
  phone: string | null
}

export interface LinkageBackfillPlan {
  noContact: OrphanInvoiceSnapshot[]
  testData: OrphanGroup[]
  safeCreateNew: OrphanGroup[]
  safeLinkExisting: OrphanGroup[]
  ambiguous: OrphanGroup[]
}

// Groups orphaned invoices by normalized email (falling back to phone) so
// multiple invoices for the same never-linked person resolve to exactly one
// backfill action, then classifies each group by how many existing Customer
// rows match its contact info. Read-only / side-effect-free -- the caller
// decides what (if anything) to write based on this plan.
export function planLinkageBackfill(
  orphanInvoices: OrphanInvoiceSnapshot[],
  existingCustomers: ExistingCustomerCandidate[]
): LinkageBackfillPlan {
  const customersByEmail = new Map<string, ExistingCustomerCandidate[]>()
  const customersByPhone = new Map<string, ExistingCustomerCandidate[]>()
  for (const c of existingCustomers) {
    const e = normalizeEmail(c.email)
    const p = normalizePhone(c.phone)
    if (e) customersByEmail.set(e, [...(customersByEmail.get(e) ?? []), c])
    if (p) customersByPhone.set(p, [...(customersByPhone.get(p) ?? []), c])
  }

  const groupsByKey = new Map<string, OrphanGroup>()
  const noContact: OrphanInvoiceSnapshot[] = []

  for (const inv of orphanInvoices) {
    const email = normalizeEmail(inv.customerEmail)
    const phone = normalizePhone(inv.customerPhone)
    if (!email && !phone) {
      noContact.push(inv)
      continue
    }
    const key = email ? `email:${email}` : `phone:${phone}`
    if (!groupsByKey.has(key)) {
      const existingCandidates = [
        ...(email ? customersByEmail.get(email) ?? [] : []),
        ...(phone ? customersByPhone.get(phone) ?? [] : []),
      ]
      const dedupedCandidates = [...new Map(existingCandidates.map((c) => [c.id, c])).values()]
      groupsByKey.set(key, {
        key,
        invoices: [],
        existingCandidates: dedupedCandidates,
        name: inv.customerName,
        email: inv.customerEmail,
        phone: inv.customerPhone,
      })
    }
    groupsByKey.get(key)!.invoices.push(inv)
  }

  const testData: OrphanGroup[] = []
  const safeCreateNew: OrphanGroup[] = []
  const safeLinkExisting: OrphanGroup[] = []
  const ambiguous: OrphanGroup[] = []

  for (const group of groupsByKey.values()) {
    if (group.existingCandidates.length === 0 && looksLikeTestData(group.name, group.email)) {
      testData.push(group)
    } else if (group.existingCandidates.length === 0) {
      safeCreateNew.push(group)
    } else if (group.existingCandidates.length === 1) {
      safeLinkExisting.push(group)
    } else {
      ambiguous.push(group)
    }
  }

  return { noContact, testData, safeCreateNew, safeLinkExisting, ambiguous }
}
