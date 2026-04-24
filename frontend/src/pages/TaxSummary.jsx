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
    <div className="p-6 max-w-4xl mx-auto">
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
        const totalExpenses = (data.maintenance_expenses || 0) + (data.management_fee_estimate || 0)
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
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Gross Rental Income', value: `£${grossIncome.toFixed(2)}`, color: 'text-green-600' },
                { label: 'Total Expenses', value: `£${totalExpenses.toFixed(2)}`, color: 'text-red-600' },
                { label: 'Net Profit', value: `£${netProfit.toFixed(2)}`, color: netProfit >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: 'Est. Tax (20% basic rate)', value: `£${estimatedTax.toFixed(2)}`, color: 'text-amber-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
              ))}
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
                  {data.management_fee_estimate > 0 && (
                    <tr className="bg-gray-50 text-xs text-gray-400 italic">
                      <td className="px-4 py-2" colSpan={2}>Estimated management fees (12%)</td>
                      <td className="px-4 py-2 text-right"></td>
                      <td className="px-4 py-2 text-right text-red-400">£{data.management_fee_estimate.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
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
