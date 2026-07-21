// Internal copy — includes payment history, internal notes, and balance due.
// Never sent to the customer; this is the admin's own record.
import { Document, Page, Text, View } from '@react-pdf/renderer'
import {
  styles,
  DocumentHeader,
  CustomerShippingSection,
  ShipmentTrackingSection,
  ItemsTable,
  TotalsBlock,
  PaymentArrangementSection,
  LegalFooter,
  formatMoney,
  formatDate,
} from './shared'
import { formatPaymentMethodLabel } from '@/lib/invoice/format'
import { BRAND } from './brand'
import type { InvoiceWithRelations } from '@/lib/invoices'

export function MasterInvoiceDocument({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Document title={`${invoice.invoiceNumber} — Master Invoice`}>
      <Page size="LETTER" style={styles.page}>
        <DocumentHeader title="Master Invoice" invoice={invoice} />
        <CustomerShippingSection invoice={invoice} />
        <ShipmentTrackingSection invoice={invoice} />
        <ItemsTable invoice={invoice} />
        <TotalsBlock invoice={invoice} showBalance />

        {/* Skipped when an arrangement exists — its own schedule table
            already lists every payment (including this history) as
            "Payment N," so showing both would just repeat the same rows
            twice and cost a page's worth of room for nothing. */}
        {invoice.payments.length > 0 && !invoice.paymentArrangement && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.sectionLabel}>Payment History</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Method</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Reference</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
            </View>
            {invoice.payments.map((payment) => (
              <View style={styles.tableRow} key={payment.id}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatDate(payment.paidAt)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatPaymentMethodLabel(payment.method)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{payment.referenceNumber || '—'}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                  {formatMoney(payment.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <PaymentArrangementSection invoice={invoice} variant="internal" />

        {(invoice.internalNotes || invoice.publicNotes) && (
          <View style={{ marginTop: 10 }}>
            {invoice.publicNotes ? (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.sectionLabel}>Notes to Customer</Text>
                <Text style={styles.sectionText}>{invoice.publicNotes}</Text>
              </View>
            ) : null}
            {invoice.internalNotes ? (
              <View>
                <Text style={styles.sectionLabel}>Internal Notes (admin only)</Text>
                <Text style={styles.sectionText}>{invoice.internalNotes}</Text>
              </View>
            ) : null}
          </View>
        )}

        <LegalFooter tagline={`${BRAND.companyName} · Internal record · Not for distribution to customer`} />
      </Page>
    </Document>
  )
}
