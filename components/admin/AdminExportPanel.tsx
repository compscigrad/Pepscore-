// CPA export panel — downloads annual XLSX or CSV for accountant
'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

interface Props {
  currentYear: number
}

export function AdminExportPanel({ currentYear }: Props) {
  const [year, setYear] = useState(currentYear)
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/export?year=${year}&format=${format}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pepscore-sales-${year}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sh">
      <h2 className="font-heading text-[17px] font-bold text-dark mb-2">CPA Annual Export</h2>
      <p className="text-[13px] text-g500 mb-5 leading-relaxed">
        Export all orders, revenue, COGS, shipping costs, Stripe fees, and net profit for any year as an Excel spreadsheet or CSV for your accountant.
      </p>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-g300 rounded-lg px-4 py-2.5 text-[14px] bg-white focus:outline-none focus:border-gold"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Format</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value as 'xlsx' | 'csv')}
            className="border border-g300 rounded-lg px-4 py-2.5 text-[14px] bg-white focus:outline-none focus:border-gold"
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="flex items-center gap-2 bg-dark hover:bg-g700 disabled:opacity-50 text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-2.5 rounded-lg transition-colors"
        >
          <Download size={15} />
          {isLoading ? 'Generating…' : `Export ${year}`}
        </button>
      </div>
      <div className="mt-4 p-3 bg-g100 rounded-lg text-[12px] text-g500">
        Export includes: Order #, Date, Customer, Items, Subtotal, Shipping, Stripe Fees, COGS, Gross Profit, Net Profit, Payment Status, Tracking #
      </div>
    </div>
  )
}
