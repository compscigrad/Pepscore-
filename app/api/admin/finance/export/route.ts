// GET /api/admin/finance/export?from=...&to=...&format=xlsx|csv
// Server-generated Finance export (spec #35/#36) -- Pepscore's own data is
// authoritative; this is an export, never a source of truth to hand-edit
// and re-import.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { assembleFinanceExport, buildFinanceExportXLSX, buildFinanceExportCSV } from '@/lib/finance/export'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'from and to query params are required (ISO dates)' }, { status: 400 })
  }
  const from = new Date(fromParam)
  const to = new Date(toParam)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 })
  }

  const data = await assembleFinanceExport({ from, to })
  const filenameRange = `${fromParam}_to_${toParam}`

  if (format === 'csv') {
    const csv = buildFinanceExportCSV(data.expenseSheet)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pepscore-finance-expenses-${filenameRange}.csv"`,
      },
    })
  }

  const buffer = buildFinanceExportXLSX(data)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pepscore-finance-${filenameRange}.xlsx"`,
    },
  })
}
