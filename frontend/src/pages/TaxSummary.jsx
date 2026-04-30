import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const API_BASE = ''

export default function TaxSummary() {
  const [landlords, setLandlords] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState('property_name')
  const [sortDir, setSortDir] = useState('asc')

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const SortTh = ({ col, label, right }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-800 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  useEffect(() => {
    api.get('/landlord/landlords').then(r => setLandlords(r.data))
  }, [])

  const load = async () => {
    if (!selectedId) return
    setLoading(true)
    setData(null)
    try {
      const r = await api.get(`/intelligence/tax-summary/${selectedId}?tax_year=${year}`)
      setData(r.data)
    } catch (e) {
      setData({ error: e.response?.data?.detail || e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Tax Summary" subtitle="Annual income & expense summary for landlord self-assessment" />

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landlord</label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Select landlord —</option>
              {landlords.map(l => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {[2025, 2024, 2023, 2022].map(y => (
                <option key={y} value={y}>{y}/{y + 1} (6 Apr {y} – 5 Apr {y + 1})</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={load}
              disabled={loading || !selectedId}
              className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Generate Summary'}
            </button>
          </div>
        </div>
      </div>

      {data && !data.error && (() => {
        const grossIncome = data.gross_rental_income || 0
        const maintenance = data.maintenance_expenses || 0
        const mgmtFee = data.management_fee_estimate || 0
        const mgmtFeePct = data.management_fee_rate_pct || 10
        const mgmtFeeIsEstimate = data.management_fee_is_estimate ?? true
        const netBeforeFees = grossIncome - maintenance
        const netProfit = data.net_profit_estimate || 0
        const estimatedTax = netProfit > 12570 ? Math.round((netProfit - 12570) * 0.2 * 100) / 100 : 0

        const rows = [...(data.property_breakdown || [])].sort((a, b) => {
          let av, bv
          if      (sortCol === 'gross_income')      { av = a.gross_income || 0;      bv = b.gross_income || 0;      return sortDir === 'asc' ? av - bv : bv - av }
          else if (sortCol === 'maintenance_costs') { av = a.maintenance_costs || 0; bv = b.maintenance_costs || 0; return sortDir === 'asc' ? av - bv : bv - av }
          else if (sortCol === 'net')               { av = (a.gross_income||0)-(a.maintenance_costs||0); bv = (b.gross_income||0)-(b.maintenance_costs||0); return sortDir === 'asc' ? av - bv : bv - av }
          else if (sortCol === 'address')           { av = a.address || ''; bv = b.address || '' }
          else                                      { av = a.property_name || ''; bv = b.property_name || '' }
          if (av < bv) return sortDir === 'asc' ? -1 : 1
          if (av > bv) return sortDir === 'asc' ? 1 : -1
          return 0
        })

        return (
          <div className="space-y-4">
            {/* P&L waterfall */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Income &amp; Expense Summary</h3>
                <p className="text-xs text-gray-400">{data.period}</p>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-700">Gross rental income</span>
                  <span className="text-sm font-semibold text-green-600">£{grossIncome.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                {maintenance > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-500 pl-4">Less: maintenance &amp; repairs (actual)</span>
                    <span className="text-sm text-red-500">−£{maintenance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50/60">
                  <span className="text-sm font-medium text-gray-700">Net before agency fees</span>
                  <span className="text-sm font-semibold text-gray-800">£{netBeforeFees.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                {mgmtFee > 0 && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <div>
                      <span className="text-sm text-gray-500 pl-4">
                        Less: agency management fees{mgmtFeeIsEstimate ? ' (estimated)' : ''}
                      </span>
                      <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${mgmtFeeIsEstimate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {mgmtFeePct}% of gross{mgmtFeeIsEstimate ? ' · no rate set' : ' · agreed rate'}
                      </span>
                    </div>
                    <span className="text-sm text-red-500">−£{mgmtFee.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-4 bg-blue-50/40">
                  <span className="text-sm font-semibold text-gray-800">Net profit estimate</span>
                  <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>£{netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 bg-amber-50/40">
                  <div>
                    <span className="text-sm text-gray-600">Estimated tax liability</span>
                    <span className="ml-2 text-xs text-gray-400">20% basic rate · above £12,570 personal allowance</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-700">£{estimatedTax.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Income by Property</h2>
                <span className="text-xs text-gray-400">{data.period}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <SortTh col="property_name" label="Property" />
                    <SortTh col="address" label="Address" />
                    <SortTh col="gross_income" label="Income" right />
                    <SortTh col="maintenance_costs" label="Maintenance" right />
                    <SortTh col="net" label="Net" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((p, i) => {
                    const pNet = (p.gross_income || 0) - (p.maintenance_costs || 0)
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">
                          {p.property_id
                            ? <Link to={`/properties/${p.property_id}`} className="text-indigo-600 hover:underline">{p.property_name}</Link>
                            : p.property_name}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {p.property_id
                            ? <Link to={`/properties/${p.property_id}`} className="text-gray-500 hover:text-indigo-600 hover:underline">{p.address}</Link>
                            : <span className="text-gray-400">{p.address}</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600">£{(p.gross_income || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-red-600">£{(p.maintenance_costs || 0).toFixed(2)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${pNet >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>{pNet >= 0 ? '+' : ''}£{pNet.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
              {data.disclaimer}
            </div>

            {data.pdf_url && (
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    const path = data.pdf_url.replace(/^\/api/, '')
                    const r = await api.get(path, { responseType: 'blob' })
                    const url = URL.createObjectURL(r.data)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = data.pdf_url.split('/').pop()
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {data?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{data.error}</div>
      )}
    </div>
  )
}
