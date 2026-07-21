// Layout pieces shared between MasterInvoiceDocument and RecipientReceiptDocument
// so the two PDFs stay visually identical everywhere except the sections the
// spec explicitly says to hide from the customer-facing copy.
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { BRAND } from './brand'
import { formatMoney, formatDate, formatCarrierLabel } from '@/lib/invoice/format'
import { INVOICE_LEGAL_SECTIONS } from '@/lib/invoice/legal'
import type { InvoiceWithRelations } from '@/lib/invoices'

export { formatMoney, formatDate }

const { colors, fonts } = BRAND

export const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.dark,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  // Sized to read as a real branding stamp anchoring the page, not a small
  // corner mark — this is the one PDF a client actually holds onto.
  logo: { width: 240, height: 161, marginBottom: 10, objectFit: 'contain' },
  companyName: { fontFamily: fonts.heading, fontSize: 16, color: colors.dark },
  docTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.dark,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Small brand accent under the title — the one deliberate spot of color in
  // an otherwise black-on-white header, echoing the landing page's gold
  // without turning the header into a marketing banner.
  headerAccent: { width: 40, height: 2, backgroundColor: colors.gold, marginTop: 8 },
  invoiceNumber: { fontSize: 9, color: colors.g500, marginTop: 8 },
  statusBadge: {
    borderWidth: 0.8,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  statusBadgeText: {
    fontFamily: fonts.heading,
    fontSize: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 24 },
  sectionCard: { flex: 1, backgroundColor: colors.g100, borderRadius: 8, padding: 12 },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.g500,
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.gold,
    paddingBottom: 3,
  },
  sectionText: { fontSize: 10, color: colors.dark, lineHeight: 1.5 },
  table: { marginBottom: 16 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.g300,
    paddingVertical: 6,
  },
  tableHeaderCell: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.g500,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableCell: { fontSize: 9.5, color: colors.dark },
  colProduct: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.2, textAlign: 'right' },
  colTotal: { flex: 1.2, textAlign: 'right' },
  totalsBlock: { alignSelf: 'flex-end', width: 240, marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: colors.g700 },
  totalsValue: { fontSize: 9.5, color: colors.dark },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.dark,
  },
  grandTotalLabel: { fontFamily: fonts.heading, fontSize: 11, color: colors.dark },
  grandTotalValue: { fontFamily: fonts.heading, fontSize: 11, color: colors.gold },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  balanceLabel: { fontFamily: fonts.heading, fontSize: 10, color: colors.dark },
  balanceValue: { fontFamily: fonts.heading, fontSize: 10, color: colors.goldDark },
  // Legal footer sits in normal document flow (never `fixed`) — deliberately,
  // so it can never overlap the totals/signature area above it: it simply
  // renders after whatever content precedes it, wherever that ends up.
  legalFooter: { marginTop: 28 },
  legalDivider: { borderTopWidth: 0.5, borderTopColor: colors.g300, marginBottom: 10 },
  legalTagline: { fontSize: 8, color: colors.g500, textAlign: 'center', marginBottom: 12 },
  legalSection: { marginBottom: 8 },
  legalHeading: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.g500,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  legalBody: { fontSize: 7, color: colors.g500, lineHeight: 1.5 },
  arrangementSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 16 },
  arrangementStat: { minWidth: 90 },
  arrangementStatLabel: {
    fontFamily: fonts.heading,
    fontSize: 7,
    color: colors.g500,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  arrangementStatValue: { fontSize: 9.5, color: colors.dark, fontFamily: fonts.heading },
})

function formatEnumLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

// Gold is reserved for PAID — the one outcome worth celebrating with the
// brand accent. Every other status reads in neutral ink so the badge stays
// legible (and doesn't waste toner) on a black-and-white printer.
function statusBadgeColor(status: string): string {
  return status === 'PAID' ? colors.gold : colors.g700
}

// Centered logo (the logo image already contains the "Pepscore Lab"
// wordmark, so no separate company-name text is needed alongside it) above
// the document title — matches the layout of the reference invoice.
//
// `showStatus` defaults to true (the Master Invoice's internal workflow
// state — DRAFT/PENDING/etc. — is useful for the admin's own reference) but
// the Recipient Receipt passes false: a customer should never see internal
// pipeline language like "Draft" on the copy they're handed.
export function DocumentHeader({
  title,
  invoice,
  showStatus = true,
}: {
  title: string
  invoice: InvoiceWithRelations
  showStatus?: boolean
}) {
  const badgeColor = statusBadgeColor(invoice.status)
  return (
    <View style={styles.header}>
      {BRAND.logoPath ? (
        // react-pdf's Image renders into a PDF content stream, not the DOM;
        // there's no accessibility tree here for alt text to attach to.
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={BRAND.logoPath} style={styles.logo} />
      ) : (
        <Text style={styles.companyName}>{BRAND.companyName}</Text>
      )}
      <Text style={styles.docTitle}>{title}</Text>
      <View style={styles.headerAccent} />
      <Text style={styles.invoiceNumber}>
        {invoice.invoiceNumber} · {formatDate(invoice.issuedAt)}
      </Text>
      {showStatus ? (
        <View style={[styles.statusBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{formatEnumLabel(invoice.status)}</Text>
        </View>
      ) : null}
    </View>
  )
}

function formatAddress(address: unknown): string {
  if (!address || typeof address !== 'object') return '—'
  const a = address as Record<string, string | undefined>
  return [a.street1, a.street2, [a.city, a.state, a.zip].filter(Boolean).join(', '), a.country]
    .filter(Boolean)
    .join('\n')
}

export function CustomerShippingSection({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Bill To</Text>
        <Text style={styles.sectionText}>{invoice.customerName}</Text>
        {invoice.customerCompany ? <Text style={styles.sectionText}>{invoice.customerCompany}</Text> : null}
        {invoice.customerEmail ? <Text style={styles.sectionText}>{invoice.customerEmail}</Text> : null}
        {invoice.customerPhone ? <Text style={styles.sectionText}>{invoice.customerPhone}</Text> : null}
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Ship To</Text>
        <Text style={styles.sectionText}>{formatAddress(invoice.shippingAddress)}</Text>
        {invoice.carrier ? (
          <Text style={[styles.sectionText, { marginTop: 6 }]}>
            {formatCarrierLabel(invoice.carrier)} {invoice.trackingNumber ? `— ${invoice.trackingNumber}` : ''}
          </Text>
        ) : null}
        <Text style={[styles.sectionText, { marginTop: 4, color: colors.g500 }]}>
          {formatEnumLabel(invoice.deliveryStatus)}
          {invoice.deliveryStatus === 'DELIVERED' && invoice.deliveredDate
            ? ` ${formatDate(invoice.deliveredDate)}`
            : ''}
        </Text>
      </View>
    </View>
  )
}

export function ItemsTable({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, styles.colProduct]}>Product</Text>
        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
        <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
      </View>
      {invoice.items.map((item) => (
        <View style={styles.tableRow} key={item.id}>
          <View style={styles.colProduct}>
            <Text style={styles.tableCell}>{item.name}</Text>
            {item.description ? <Text style={{ fontSize: 8, color: colors.g500 }}>{item.description}</Text> : null}
          </View>
          <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
          <Text style={[styles.tableCell, styles.colPrice]}>{formatMoney(item.unitPrice)}</Text>
          <Text style={[styles.tableCell, styles.colTotal]}>{formatMoney(item.total)}</Text>
        </View>
      ))}
    </View>
  )
}

export function TotalsBlock({ invoice, showBalance }: { invoice: InvoiceWithRelations; showBalance: boolean }) {
  const itemsSubtotal = invoice.subtotal - invoice.shippingCost
  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Items</Text>
        <Text style={styles.totalsValue}>{formatMoney(itemsSubtotal)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Shipping</Text>
        <Text style={styles.totalsValue}>{formatMoney(invoice.shippingCost)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue}>{formatMoney(invoice.subtotal)}</Text>
      </View>
      {invoice.discounts.map((d) => (
        <View style={styles.totalsRow} key={d.id}>
          <Text style={styles.totalsLabel}>{d.label}</Text>
          <Text style={styles.totalsValue}>-{formatMoney(d.appliedAmount)}</Text>
        </View>
      ))}
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>Total</Text>
        <Text style={styles.grandTotalValue}>{formatMoney(invoice.total)}</Text>
      </View>
      {showBalance ? (
        <>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Amount Paid</Text>
            <Text style={styles.totalsValue}>{formatMoney(invoice.amountPaid)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Due</Text>
            <Text style={styles.balanceValue}>{formatMoney(invoice.balanceDue)}</Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

// Shared between both PDFs, like everything else in this file — but the
// two variants intentionally show different amounts of detail. `internal`
// (Master Invoice) gets the full schedule table plus summary stats;
// `recipient` gets only what the customer needs to know their remaining
// obligation (no full history, no internal accounting framing).
export function PaymentArrangementSection({
  invoice,
  variant,
}: {
  invoice: InvoiceWithRelations
  variant: 'internal' | 'recipient'
}) {
  const arrangement = invoice.paymentArrangement
  if (!arrangement) return null

  const nextDue = arrangement.installments.find((i) => i.status === 'PENDING')

  if (variant === 'recipient') {
    const upcoming = arrangement.installments.filter((i) => i.status !== 'PAID')
    return (
      <View style={{ marginTop: 24 }} wrap={false}>
        <Text style={styles.sectionLabel}>Payment Arrangement</Text>
        <View style={styles.arrangementSummaryRow}>
          <View style={styles.arrangementStat}>
            <Text style={styles.arrangementStatLabel}>Remaining Balance</Text>
            <Text style={styles.arrangementStatValue}>{formatMoney(invoice.balanceDue)}</Text>
          </View>
          <View style={styles.arrangementStat}>
            <Text style={styles.arrangementStatLabel}>Next Payment Due</Text>
            <Text style={styles.arrangementStatValue}>{nextDue ? formatDate(nextDue.dueDate) : '—'}</Text>
          </View>
        </View>
        {upcoming.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Payment #</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Due Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {upcoming.map((inst) => (
              <View style={styles.tableRow} key={inst.id}>
                <Text style={[styles.tableCell, { flex: 1 }]}>Payment {inst.installmentNumber}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(inst.dueDate)}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatMoney(inst.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View style={{ marginTop: 24 }} wrap={false}>
      <Text style={styles.sectionLabel}>Payment Arrangement</Text>
      <View style={styles.arrangementSummaryRow}>
        <View style={styles.arrangementStat}>
          <Text style={styles.arrangementStatLabel}>Original Invoice Total</Text>
          <Text style={styles.arrangementStatValue}>{formatMoney(invoice.total)}</Text>
        </View>
        <View style={styles.arrangementStat}>
          <Text style={styles.arrangementStatLabel}>Payments Received</Text>
          <Text style={styles.arrangementStatValue}>{formatMoney(invoice.amountPaid)}</Text>
        </View>
        <View style={styles.arrangementStat}>
          <Text style={styles.arrangementStatLabel}>Remaining Balance</Text>
          <Text style={styles.arrangementStatValue}>{formatMoney(invoice.balanceDue)}</Text>
        </View>
        <View style={styles.arrangementStat}>
          <Text style={styles.arrangementStatLabel}>Next Payment Due</Text>
          <Text style={styles.arrangementStatValue}>{nextDue ? formatDate(nextDue.dueDate) : '—'}</Text>
        </View>
        <View style={styles.arrangementStat}>
          <Text style={styles.arrangementStatLabel}>Payment Frequency</Text>
          <Text style={styles.arrangementStatValue}>
            {arrangement.frequency === 'WEEKLY' ? 'Every Week' : 'Every Two Weeks'}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Payment #</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Due Date</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Status</Text>
        </View>
        {arrangement.installments.map((inst) => (
          <View style={styles.tableRow} key={inst.id}>
            <Text style={[styles.tableCell, { flex: 1 }]}>Payment {inst.installmentNumber}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(inst.dueDate)}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatMoney(inst.amount)}</Text>
            <Text
              style={[styles.tableCell, { flex: 1, textAlign: 'right', color: statusBadgeColor(inst.status) }]}
            >
              {formatEnumLabel(inst.status)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// Shared between both PDFs so legal copy is edited in exactly one place
// (`lib/invoice/legal.ts`). `wrap={false}` keeps each section intact if the
// footer gets pushed to a fresh page on an unusually long invoice, rather
// than splitting a paragraph awkwardly across the page break.
export function LegalFooter({ tagline }: { tagline: string }) {
  return (
    <View style={styles.legalFooter} wrap={false}>
      <View style={styles.legalDivider} />
      <Text style={styles.legalTagline}>{tagline}</Text>
      {INVOICE_LEGAL_SECTIONS.map((section) => (
        <View style={styles.legalSection} key={section.heading}>
          <Text style={styles.legalHeading}>{section.heading}</Text>
          <Text style={styles.legalBody}>{section.body}</Text>
        </View>
      ))}
    </View>
  )
}
