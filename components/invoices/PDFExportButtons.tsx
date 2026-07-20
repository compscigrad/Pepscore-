// Download links for the two generated PDF variants. No client-side PDF
// logic here — the API route (app/api/admin/invoices/[id]/pdf) does the
// generation; these are just links.
export function PDFExportButtons({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=master`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-dark text-white text-sm font-bold px-5 py-2.5 hover:bg-g700 transition-colors"
      >
        Download Master Invoice
      </a>
      <a
        href={`/api/admin/invoices/${invoiceId}/pdf?variant=recipient`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-g100 text-dark text-sm font-bold px-5 py-2.5 hover:bg-g300/50 transition-colors"
      >
        Download Recipient Receipt
      </a>
    </div>
  )
}
