// GET /api/admin/finance/export?from=...&to=...&format=xlsx|csv
// Server-generated Finance export (spec #35/#36) -- Pepscore's own data is
// authoritative; this is an export, never a source of truth to hand-edit
// and re-import.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { assembleFinanceExport, buildFinanceExportXLSX, buildFinanceExportCSV } from '@/lib/finance/export'

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const formatParam = searchParams.get('format')
  const format = formatParam === 'csv' ? 'csv' : formatParam === 'qbo' ? 'qbo' : 'xlsx'

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'from and to query params are required (ISO dates)' }, { status: 400 })
  }
  const from = new Date(fromParam)
  const to = new Date(toParam)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 })
  }

  const data = await assembleFinanceExport({ from, to })
  // Deterministic filename: PEPSCORE_TAX-YEAR_REPORT-TYPE_EXPORT-DATE
  // (spec #20) -- tax year here means the year the range's end date falls
  // in, matching the same convention getMonthlySummary/getForm1099KReport
  // use elsewhere; report type is the date range itself since this export
  // is range-scoped, not a fixed annual package.
  const taxYear = to.getFullYear()
  const exportDate = new Date().toISOString().slice(0, 10)
  const reportType = `${fromParam}_to_${toParam}`
  const baseFilename = `Pepscore_${taxYear}_${reportType}_Export_${exportDate}`

  if (format === 'csv') {
    const csv = buildFinanceExportCSV(data.expenseSheet)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${baseFilename}_ExpenseLedger.csv"`,
      },
    })
  }

  if (format === 'qbo') {
    const csv = buildFinanceExportCSV(data.quickBooksXeroSheet!)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${baseFilename}_QuickBooks-Xero.csv"`,
      },
    })
  }

  const buffer = buildFinanceExportXLSX(data)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
    },
  })
}
