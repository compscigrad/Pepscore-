// Order number generator and order helpers

// Generates a human-readable order number: PSC-YYYYMM-XXXXX
export function generateOrderNumber(): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `PSC-${ym}-${rand}`
}

// Generates an invoice number: INV-YYYYMM-XXXXX
export function generateInvoiceNumber(): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `INV-${ym}-${rand}`
}

// Format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
