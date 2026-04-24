import { PageHeader } from '../components/Illustration'
import { useEffect, useState } from 'react'
import api from '../lib/api'

const SOURCE_LABELS = {
  manual: 'Manual estimate',
  surveyor: 'Surveyor',
  zoopla: 'Zoopla',
  rightmove: 'Rightmove',
  other: 'Other',
}

function fmt(n) {
  if (n == null) return '—'
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtYield(y) {
  if (y == null) return '—'
  return y.toFixed(2) + '%'
}
function yieldColor(y) {
  if (y == null) return 'text-gray-400'
  if (y >= 7) return 'text-green-600'
  if (y >= 5) return 'text-blue-600'
  if (y >= 3) return 'text-amber-600'
  return 'text-red-600'
}

function ValuationModal({ prop, onClose, onSaved }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState('manual')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!value || isNaN(parseFloat(value))) return
    setSaving(true)
    try {
      await api.post(`/valuation/${prop.property_id}`, {
        estimated_value: parseFloat(value),
        valuation_date: date,
        source,
        notes: notes || null,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Update Valuation</h2>
        <p className="text-sm text-gray-500 mb-5">{prop.name} · {prop.address}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value (£)</label>
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="e.g. 250000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Valuation'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({ prop, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/valuation/history/${prop.property_id}`)
      .then(r => setHistory(r.data))
      .finally(() => setLoading(false))
  }, [prop.property_id])

  async function del(id) {
    if (!confirm('Delete this valuation record?')) return
    await api.delete(`/valuation/${id}`)
    setHistory(h => h.filter(r => r.id !== id))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Valuation History</h2>
            <p className="text-sm text-gray-500">{prop.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No valuation history yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map(r => (
              <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{fmt(r.estimated_value)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.valuation_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{SOURCE_LABELS[r.source] || r.source}
                  </p>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                </div>
                <button
                  onClick={() => del(r.id)}
                  className="text-xs text-red-400 hover:text-red-600 ml-4"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function Valuation() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [valuationModal, setValuationModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)

  function load() {
    setLoading(true)
    api.get('/valuation')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <p className="text-gray-500 text-sm">Loading portfolio…</p>
  if (!data) return null

  const { summary, properties } = data

  return (
    <div className="space-y-6">
      <PageHeader title="Portfolio Valuation" subtitle="Estimated market values, rental yield and net income across your portfolio" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(summary.total_value)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.valued_count} of {summary.property_count} properties valued</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Rent Roll</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(summary.total_annual_rent)}</p>
          <p className="text-xs text-gray-400 mt-1">{fmt(summary.total_annual_rent / 12)}/mo across all units</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Gross Yield</p>
          <p className={`text-2xl font-bold mt-1 ${yieldColor(summary.avg_gross_yield)}`}>
            {fmtYield(summary.avg_gross_yield)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Before maintenance costs</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Net Yield</p>
          <p className={`text-2xl font-bold mt-1 ${yieldColor(summary.avg_net_yield)}`}>
            {fmtYield(summary.avg_net_yield)}
          </p>
          <p className="text-xs text-gray-400 mt-1">After last 12m maintenance</p>
        </div>
      </div>

      {/* Net income bar */}
      {summary.total_annual_rent > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-gray-700">Annual Income Breakdown</p>
            <p className="text-sm font-bold text-gray-900">Net: {fmt(summary.total_net_income)}</p>
          </div>
          <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
            {summary.total_annual_rent > 0 && (() => {
              const maintenancePct = Math.min((summary.total_annual_maintenance / summary.total_annual_rent) * 100, 100)
              const netPct = 100 - maintenancePct
              return (
                <>
                  <div className="bg-green-500 h-3 transition-all" style={{ width: `${netPct}%` }} title={`Net income: ${fmt(summary.total_net_income)}`} />
                  <div className="bg-red-300 h-3 transition-all" style={{ width: `${maintenancePct}%` }} title={`Maintenance: ${fmt(summary.total_annual_maintenance)}`} />
                </>
              )
            })()}
          </div>
          <div className="flex gap-6 mt-2 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Net income {fmt(summary.total_net_income)}</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-300 mr-1" />Maintenance {fmt(summary.total_annual_maintenance)}</span>
          </div>
        </div>
      )}

      {/* Per-property table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Properties</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Property</th>
                <th className="text-right px-4 py-3">Units</th>
                <th className="text-right px-4 py-3">Annual Rent</th>
                <th className="text-right px-4 py-3">Estimated Value</th>
                <th className="text-right px-4 py-3">Gross Yield</th>
                <th className="text-right px-4 py-3">Net Yield</th>
                <th className="text-right px-4 py-3">Maintenance (12m)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {properties.map(p => (
                <tr key={p.property_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.address} · {p.postcode}</p>
                    {p.valuation_date && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Valued {new Date(p.valuation_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{SOURCE_LABELS[p.valuation_source] || p.valuation_source}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-700">
                    {p.occupied_count}/{p.unit_count}
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-gray-900">
                    {fmt(p.annual_rent)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {p.estimated_value ? (
                      <span className="font-semibold text-gray-900">{fmt(p.estimated_value)}</span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not set</span>
                    )}
                  </td>
                  <td className={`px-4 py-4 text-right font-semibold ${yieldColor(p.gross_yield)}`}>
                    {fmtYield(p.gross_yield)}
                  </td>
                  <td className={`px-4 py-4 text-right font-semibold ${yieldColor(p.net_yield)}`}>
                    {fmtYield(p.net_yield)}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-600">
                    {fmt(p.annual_maintenance)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setValuationModal(p)}
                        className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium"
                      >
                        {p.estimated_value ? 'Update' : '+ Value'}
                      </button>
                      {p.latest_valuation_id && (
                        <button
                          onClick={() => setHistoryModal(p)}
                          className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium"
                        >
                          History
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {properties.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No properties found. Add properties first.</p>
          )}
        </div>
      </div>

      {/* Yield guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold mb-1">Yield Guide (UK residential)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <span><span className="font-bold text-green-600">≥ 7%</span> — Excellent</span>
          <span><span className="font-bold text-blue-600">5–7%</span> — Good</span>
          <span><span className="font-bold text-amber-600">3–5%</span> — Average</span>
          <span><span className="font-bold text-red-600">&lt; 3%</span> — Below average</span>
        </div>
        <p className="text-blue-600 mt-1">Net yield deducts maintenance costs logged in the last 12 months. Add actual costs to maintenance jobs for accurate figures.</p>
      </div>

      {valuationModal && (
        <ValuationModal
          prop={valuationModal}
          onClose={() => setValuationModal(null)}
          onSaved={load}
        />
      )}
      {historyModal && (
        <HistoryPanel
          prop={historyModal}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  )
}
