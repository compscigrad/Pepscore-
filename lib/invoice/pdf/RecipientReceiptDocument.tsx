// Customer-facing copy — same branding and totals as the Master Invoice, but
// deliberately omits internal notes, admin comments, and the itemized
// payment-history log (amount paid / balance due still shown, since the
// customer needs to know what they owe — only the internal tracking detail
// behind that number is hidden).
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles, DocumentHeader, CustomerShippingSection, ItemsTable, TotalsBlock, PaymentArrangementSection, LegalFooter } from './shared'
import { BRAND } from './brand'
import type { InvoiceWithRelations } from '@/lib/invoices'

export function RecipientReceiptDocument({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Document title={`${invoice.invoiceNumber} — Client Invoice`}>
      <Page size="LETTER" style={styles.page}>
        <DocumentHeader title="Client Invoice" invoice={invoice} showStatus={false} />
        <CustomerShippingSection invoice={invoice} />
        <ItemsTable invoice={invoice} />
        <TotalsBlock invoice={invoice} showBalance />
        <PaymentArrangementSection invoice={invoice} variant="recipient" />
        {invoice.publicNotes ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.sectionText}>{invoice.publicNotes}</Text>
          </View>
        ) : null}
        <LegalFooter tagline={`Thank you for choosing ${BRAND.companyName}.`} />
      </Page>
    </Document>
  )
}
