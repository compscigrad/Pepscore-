// Download links for the two generated PDF variants. No client-side PDF
// logic here — the API route (app/api/admin/invoices/[id]/pdf) does the
// generation; these are just links.
//
// Two distinct outline-pill styles (gold-tinted for the internal record,
// neutral for the customer copy) rather than the old solid bg-dark button —
// a near-black fill was nearly invisible against this page's black
// background.
export function PDFExportButtons({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=master`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-gold/30 bg-gold/10 text-gold-light text-sm font-bold px-5 py-2.5 hover:bg-gold/15 transition-colors"
      >
        Download Master Invoice
      </a>
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=recipient`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/15 bg-white/5 text-white/70 text-sm font-bold px-5 py-2.5 hover:bg-white/10 transition-colors"
      >
        Download Recipient Receipt
      </a>
    </div>
  )
}
