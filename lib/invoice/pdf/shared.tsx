// Layout pieces shared between MasterInvoiceDocument and RecipientReceiptDocument
// so the two PDFs stay visually identical everywhere except the sections the
// spec explicitly says to hide from the customer-facing copy.
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { BRAND } from './brand'
import { formatMoney, formatDate } from '@/lib/invoice/format'
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  logo: { width: 56, height: 56 },
  companyBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companyName: { fontFamily: fonts.heading, fontSize: 16, color: colors.dark },
  tagline: { fontSize: 8, color: colors.g500, marginTop: 2 },
  docTitleBlock: { alignItems: 'flex-end' },
  docTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.gold, letterSpacing: 1 },
  invoiceNumber: { fontSize: 9, color: colors.g500, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 24 },
  sectionCard: { flex: 1, backgroundColor: colors.g100, borderRadius: 8, padding: 12 },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 8,
    color: colors.g500,
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
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
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: colors.g300,
    paddingTop: 8,
    fontSize: 8,
    color: colors.g500,
    textAlign: 'center',
  },
})

export function DocumentHeader({ title, invoice }: { title: string; invoice: InvoiceWithRelations }) {
  return (
    <View style={styles.header}>
      <View style={styles.companyBlock}>
        {BRAND.logoPath ? <Image src={BRAND.logoPath} style={styles.logo} /> : null}
        <View>
          <Text style={styles.companyName}>{BRAND.companyName}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
        </View>
      </View>
      <View style={styles.docTitleBlock}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
        <Text style={styles.invoiceNumber}>{formatDate(invoice.issuedAt)}</Text>
      </View>
    </View>
  )
}

function formatDeliveryStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
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
            {invoice.carrier} {invoice.trackingNumber ? `— ${invoice.trackingNumber}` : ''}
          </Text>
        ) : null}
        <Text style={[styles.sectionText, { marginTop: 4, color: colors.g500 }]}>
          {formatDeliveryStatus(invoice.deliveryStatus)}
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

export function DocumentFooter({ text }: { text: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{text}</Text>
    </View>
  )
}
