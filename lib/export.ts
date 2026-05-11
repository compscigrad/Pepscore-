// CPA export utilities — generates XLSX and CSV files for accounting
// Used by the admin dashboard annual export feature

import * as XLSX from 'xlsx'

export interface ExportRow {
  orderNumber: string
  date: string
  customerName: string
  customerEmail: string
  items: string
  subtotal: number
  shippingCost: number
  stripeFee: number
  tax: number
  total: number
  cogs: number
  grossProfit: number
  netProfit: number
  paymentStatus: string
  fulfillmentStatus: string
  trackingNumber: string
}

// Build an XLSX buffer from an array of export rows
export function buildExportXLSX(rows: ExportRow[], year: number): Buffer {
  const wsData = [
    // Header row
    [
      'Order #', 'Date', 'Customer', 'Email', 'Items',
      'Subtotal', 'Shipping', 'Stripe Fee', 'Tax', 'Total',
      'COGS', 'Gross Profit', 'Net Profit',
      'Payment', 'Fulfillment', 'Tracking #',
    ],
    // Data rows
    ...rows.map(r => [
      r.orderNumber, r.date, r.customerName, r.customerEmail, r.items,
      r.subtotal, r.shippingCost, r.stripeFee, r.tax, r.total,
      r.cogs, r.grossProfit, r.netProfit,
      r.paymentStatus, r.fulfillmentStatus, r.trackingNumber,
    ]),
    // Totals row
    [
      'TOTALS', '', '', '', '',
      sumCol(rows, 'subtotal'),
      sumCol(rows, 'shippingCost'),
      sumCol(rows, 'stripeFee'),
      sumCol(rows, 'tax'),
      sumCol(rows, 'total'),
      sumCol(rows, 'cogs'),
      sumCol(rows, 'grossProfit'),
      sumCol(rows, 'netProfit'),
      '', '', '',
    ],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 40 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 20 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, `Sales ${year}`)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// Build a CSV string from export rows
export function buildExportCSV(rows: ExportRow[]): string {
  const cols: (keyof ExportRow)[] = [
    'orderNumber', 'date', 'customerName', 'customerEmail', 'items',
    'subtotal', 'shippingCost', 'stripeFee', 'tax', 'total',
    'cogs', 'grossProfit', 'netProfit',
    'paymentStatus', 'fulfillmentStatus', 'trackingNumber',
  ]
  const header = cols.join(',')
  const body = rows.map(r =>
    cols.map(c => {
      const v = r[c]
      const s = String(v ?? '')
      return s.includes(',') ? `"${s}"` : s
    }).join(',')
  )
  return [header, ...body].join('\n')
}

function sumCol(rows: ExportRow[], key: keyof ExportRow): number {
  return Math.round(rows.reduce((s, r) => s + Number(r[key] ?? 0), 0) * 100) / 100
}
