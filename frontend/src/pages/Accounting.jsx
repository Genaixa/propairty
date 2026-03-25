import { useState, useEffect } from 'react'
import api from '../lib/api'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

function ukTaxYears() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const years = []
  // Generate last 5 tax years
  for (let y = currentYear; y >= currentYear - 4; y--) {
    const startYear = now >= new Date(y, 3, 6) ? y : y - 1
    years.push({
      label: `${startYear}/${String(startYear + 1).slice(-2)} Tax Year`,
      from: `${startYear}-04-06`,
      to: `${startYear + 1}-04-05`,
    })
  }
  // Deduplicate
  const seen = new Set()
  return years.filter(y => { if (seen.has(y.from)) return false; seen.add(y.from); return true })
}

export default function Accounting() {
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [mode, setMode] = useState('taxyear') // taxyear | custom
  const [taxYear, setTaxYear] = useState(ukTaxYears()[0])
  const [fromDate, setFromDate] = useState(ukTaxYears()[0].from)
  const [toDate, setToDate] = useState(ukTaxYears()[0].to)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    api.get('/accounting/properties').then(r => setProperties(r.data)).catch(() => {})
  }, [])

  const effectiveFrom = mode === 'taxyear' ? taxYear.from : fromDate
  const effectiveTo = mode === 'taxyear' ? taxYear.to : toDate

  async function loadReport() {
    setLoading(true)
    setReport(null)
    try {
      const params = new URLSearchParams({ from_date: effectiveFrom, to_date: effectiveTo })
      if (propertyId) params.set('property_id', propertyId)
      const r = await api.get(`/accounting/report?${params}`)
      setReport(r.data)
    } catch {}
    setLoading(false)
  }

  async function downloadFile(type) {
    setExporting(type)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ from_date: effectiveFrom, to_date: effectiveTo })
      if (propertyId) params.set('property_id', propertyId)
      const res = await fetch(`${BASE}/accounting/export/${type}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `income_expenditure_${effectiveFrom}_${effectiveTo}.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting('')
  }

  const taxYears = ukTaxYears()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Accounting Export</h2>
        {report && (
          <div className="flex gap-2">
            <button onClick={() => downloadFile('csv')} disabled={exporting === 'csv'}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors">
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </button>
            <button onClick={() => downloadFile('pdf')} disabled={exporting === 'pdf'}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors">
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button onClick={() => setMode('taxyear')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'taxyear' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            UK Tax Year
          </button>
          <button onClick={() => setMode('custom')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Custom Range
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {mode === 'taxyear' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year</label>
              <select
                value={taxYear.from}
                onChange={e => {
                  const ty = taxYears.find(y => y.from === e.target.value)
                  if (ty) setTaxYear(ty)
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              >
                {taxYears.map(y => (
                  <option key={y.from} value={y.from}>{y.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48">
              <option value="">All properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <button onClick={loadReport} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60 transition-colors">
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report preview */}
      {report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-600 font-medium">Total Income</p>
              <p className="text-3xl font-bold text-green-700 mt-1">£{report.total_income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-green-500 mt-1">{report.income_count} rent payments</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm text-red-600 font-medium">Total Expenditure</p>
              <p className="text-3xl font-bold text-red-700 mt-1">£{report.total_expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-red-500 mt-1">{report.expenditure_count} maintenance jobs</p>
            </div>
            <div className={`border rounded-xl p-5 ${report.net_profit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-sm font-medium ${report.net_profit >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Net Profit</p>
              <p className={`text-3xl font-bold mt-1 ${report.net_profit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                £{report.net_profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">before tax &amp; allowances</p>
            </div>
          </div>

          {/* Per-property summary table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">Per-Property Summary</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Property', 'Income', 'Expenditure', 'Net'].map(h => (
                    <th key={h} className={`px-5 py-3 font-medium text-gray-500 text-xs uppercase ${h === 'Property' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.properties.map(p => (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.name}
                      <span className="text-xs text-gray-400 ml-2">{p.income_rows.length} payments · {p.expenditure_rows.length} jobs</span>
                    </td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold">£{p.total_income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3 text-right text-red-500 font-semibold">£{p.total_expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td className={`px-5 py-3 text-right font-bold ${p.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>£{p.net.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                  <td className="px-5 py-3 text-gray-700">Total</td>
                  <td className="px-5 py-3 text-right text-green-700">£{report.total_income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-right text-red-600">£{report.total_expenditure.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className={`px-5 py-3 text-right ${report.net_profit >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>£{report.net_profit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Expanded per-property detail */}
          {report.properties.map(p => (
            <PropertyDetail key={p.name} prop={p} />
          ))}

          <p className="text-xs text-gray-400 text-center pb-4">
            For self-assessment reference only — verify with a qualified accountant.
          </p>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-gray-500 text-sm">Select a period and click Generate Report to preview your income &amp; expenditure statement.</p>
          <p className="text-xs text-gray-400 mt-2">Export as CSV for your accountant or PDF for your records.</p>
        </div>
      )}
    </div>
  )
}


function PropertyDetail({ prop }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{prop.name}</span>
          <span className="text-xs text-gray-400">{prop.income_rows.length} income · {prop.expenditure_rows.length} expenditure</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-green-600 font-semibold">+£{prop.total_income.toFixed(2)}</span>
          <span className="text-sm text-red-500 font-semibold">-£{prop.total_expenditure.toFixed(2)}</span>
          <span className={`text-sm font-bold ${prop.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>= £{prop.net.toFixed(2)}</span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {prop.income_rows.length > 0 && (
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-green-600 uppercase mb-3">Income — Rent Received</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-green-50">
                    <th className="text-left px-3 py-2">Date Paid</th>
                    <th className="text-left px-3 py-2">Tenant</th>
                    <th className="text-left px-3 py-2">Unit</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prop.income_rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{r.paid_date}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.tenant_name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.unit_name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.period}</td>
                      <td className="px-3 py-2 text-right text-green-600 font-semibold">£{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prop.expenditure_rows.length > 0 && (
            <div className="px-5 py-4">
              <h4 className="text-xs font-semibold text-red-500 uppercase mb-3">Expenditure — Maintenance &amp; Repairs</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-red-50">
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Contractor</th>
                    <th className="text-left px-3 py-2">Invoice Ref</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prop.expenditure_rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{r.date}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.title}</td>
                      <td className="px-3 py-2 text-gray-500">{r.contractor || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{r.invoice_ref || '—'}</td>
                      <td className="px-3 py-2 text-right text-red-500 font-semibold">£{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prop.income_rows.length === 0 && prop.expenditure_rows.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-400">No transactions recorded for this property in the selected period.</p>
          )}
        </div>
      )}
    </div>
  )
}
