// Centralized legal copy for invoice PDFs. Single source of truth so a
// future policy change (new clause, reworded RUO language, etc.) means
// editing this file once, not hunting through both PDF documents.
export interface LegalSection {
  heading: string
  body: string
}

export const INVOICE_LEGAL_SECTIONS: LegalSection[] = [
  {
    heading: 'Research Use Only (RUO)',
    body: 'All products sold by Pepscore are intended solely for laboratory research purposes and are not approved for human consumption, therapeutic use, veterinary use, or diagnostic use. By purchasing these materials, the purchaser acknowledges that they understand the intended research-only nature of these products and agree to use them in accordance with all applicable laws and regulations.',
  },
  {
    heading: 'Customer Responsibility After Delivery',
    body: 'Once a shipment has been marked as delivered by the carrier, responsibility for the package transfers to the recipient. Customers are responsible for promptly retrieving delivered packages and storing products appropriately upon receipt. Pepscore is not responsible for loss, theft, weather exposure, improper storage, or damage occurring after confirmed delivery.',
  },
]
