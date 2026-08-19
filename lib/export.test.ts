import { describe, it, expect } from 'vitest'
import { neutralizeFormulaInjection, buildFinanceExportCSV, buildExportCSV, type FinanceSheet, type ExportRow } from './export'

describe('neutralizeFormulaInjection', () => {
  it('prefixes a leading = with a single quote', () => {
    expect(neutralizeFormulaInjection('=cmd|"/c calc"!A1')).toBe("'=cmd|\"/c calc\"!A1")
  })

  it('prefixes a leading +, -, @, tab, or carriage return', () => {
    expect(neutralizeFormulaInjection('+1234')).toBe("'+1234")
    expect(neutralizeFormulaInjection('-1234')).toBe("'-1234")
    expect(neutralizeFormulaInjection('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)")
    expect(neutralizeFormulaInjection('\t=HYPERLINK(1)')).toBe("'\t=HYPERLINK(1)")
  })

  it('leaves an ordinary string untouched', () => {
    expect(neutralizeFormulaInjection('Acme Supplies')).toBe('Acme Supplies')
  })

  it('leaves a negative-looking number (not a string) untouched', () => {
    expect(neutralizeFormulaInjection(-42)).toBe(-42)
  })

  it('leaves an empty string untouched', () => {
    expect(neutralizeFormulaInjection('')).toBe('')
  })

  it('does not falsely trigger on a value merely containing = elsewhere', () => {
    expect(neutralizeFormulaInjection('total=42')).toBe('total=42')
  })
})

describe('buildFinanceExportCSV formula-injection guard', () => {
  it('neutralizes a malicious vendor name in a real sheet row', () => {
    const sheet: FinanceSheet = {
      name: 'Expense Ledger',
      headers: ['Vendor', 'Amount'],
      rows: [['=cmd|"/c calc"!A1', 100]],
    }
    const csv = buildFinanceExportCSV(sheet)
    const dataLine = csv.split('\n')[1]
    expect(dataLine.includes("'=cmd")).toBe(true)
  })
})

describe('buildExportCSV formula-injection guard', () => {
  it('neutralizes a malicious customer name in a real sales-export row', () => {
    const row: ExportRow = {
      orderNumber: 'PS-1', date: '2026-01-01', customerName: '=1+1', customerEmail: 'a@b.com',
      items: 'x', subtotal: 1, shippingCost: 0, stripeFee: 0, tax: 0, total: 1,
      cogs: 0, grossProfit: 1, netProfit: 1, paymentStatus: 'PAID', fulfillmentStatus: 'SHIPPED', trackingNumber: '',
    }
    const csv = buildExportCSV([row])
    const dataLine = csv.split('\n')[1]
    expect(dataLine.includes("'=1+1")).toBe(true)
  })
})
