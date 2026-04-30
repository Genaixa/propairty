import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'
import { formatCurrency } from '../lib/locale'

export default function RentOptimisation() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState(null)

  async function load(bust = false) {
    if (bust) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await api.get('/intelligence/rent-optimisation')
      setData(r.data)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const underpriced = data?.filter(u => u.status === 'underpriced') || []
  const overpriced  = data?.filter(u => u.status === 'overpriced')  || []
  const atMarket    = data?.filter(u => u.status === 'at_market')    || []
  const noData      = data?.filter(u => !u.market_rent)              || []

  const totalOpportunity = underpriced.reduce((s, u) => s + Math.abs(u.difference || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
        <p className="text-gray-500 text-sm mt-4">Analysing market data…</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <PageHeader title="Rent Optimiser" subtitle="Benchmarked against VOA Rental Market Statistics 2023–24" />
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Underpriced" count={underpriced.length} color="amber" icon="↓" active={filter==='underpriced'} onClick={() => setFilter(f => f==='underpriced' ? null : 'underpriced')} />
          <SummaryCard label="Overpriced" count={overpriced.length} color="red" icon="↑" active={filter==='overpriced'} onClick={() => setFilter(f => f==='overpriced' ? null : 'overpriced')} />
          <SummaryCard label="At market" count={atMarket.length} color="green" icon="✓" active={filter==='at_market'} onClick={() => setFilter(f => f==='at_market' ? null : 'at_market')} />
          {totalOpportunity > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Revenue opportunity</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">+£{totalOpportunity.toLocaleString()}</p>
              <p className="text-xs text-indigo-500 mt-0.5">per month if optimised</p>
            </div>
          )}
        </div>
      )}

      {filter && (
        <button onClick={() => setFilter(null)} className="text-sm text-indigo-600 hover:underline">
          ← Show all
        </button>
      )}

      {(!filter || filter === 'underpriced') && underpriced.length > 0 && (
        <Section title="Underpriced — action recommended" color="amber">
          {underpriced.map(u => <UnitRow key={u.unit_id} unit={u} />)}
        </Section>
      )}

      {(!filter || filter === 'overpriced') && overpriced.length > 0 && (
        <Section title="Above market — monitor at renewal" color="red">
          {overpriced.map(u => <UnitRow key={u.unit_id} unit={u} />)}
        </Section>
      )}

      {(!filter || filter === 'at_market') && atMarket.length > 0 && (
        <Section title="At market rate" color="green">
          {atMarket.map(u => <UnitRow key={u.unit_id} unit={u} />)}
        </Section>
      )}

      {!filter && noData.length > 0 && (
        <Section title="No market data found" color="gray">
          {noData.map(u => <UnitRow key={u.unit_id} unit={u} />)}
        </Section>
      )}
    </div>
  )
}

function SummaryCard({ label, count, color, icon, onClick, active }) {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    gray:  'bg-gray-50 border-gray-200 text-gray-600',
  }
  return (
    <button onClick={onClick}
      className={`rounded-xl border p-4 text-left w-full transition-all ${colors[color]} ${active ? 'ring-2 ring-indigo-400' : 'hover:opacity-80'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{icon} {count}</p>
    </button>
  )
}

function Section({ title, color, children }) {
  const headers = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50 border-red-200 text-red-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    gray:  'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-5 py-3 border-b ${headers[color]}`}>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function UnitRow({ unit }) {
  const [expanded, setExpanded] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const diffColor = unit.status === 'underpriced'
    ? 'text-amber-600' : unit.status === 'overpriced'
    ? 'text-red-600' : 'text-green-600'

  async function notifyLandlord(e) {
    e.stopPropagation()
    setEmailing(true); setEmailMsg('')
    try {
      await api.post(`/intelligence/rent-optimisation/${unit.unit_id}/email-landlord`)
      setEmailMsg('Email sent ✓')
    } catch (err) {
      setEmailMsg(err.response?.data?.detail || 'Failed to send')
    }
    setEmailing(false)
  }

  return (
    <div>
      <button onClick={() => setExpanded(x => !x)}
        className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 text-left transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{unit.property_name} — {unit.unit_name}</p>
          <p className="text-xs text-gray-400">{unit.postcode} · {unit.bedrooms} bed</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-800">£{unit.current_rent?.toLocaleString()}/mo</p>
          {unit.market_rent && (
            <p className="text-xs text-gray-400">market £{unit.market_rent.toLocaleString()}/mo</p>
          )}
        </div>
        {unit.difference !== null && unit.difference !== undefined && (
          <div className={`text-sm font-bold shrink-0 w-20 text-right ${diffColor}`}>
            {unit.difference > 0 ? '+' : ''}£{unit.difference}/mo
          </div>
        )}
        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <p className="text-sm text-gray-700 mt-3">{unit.recommendation}</p>
          {unit.status === 'underpriced' && (
            <div className="flex items-center gap-3">
              <button onClick={notifyLandlord} disabled={emailing}
                className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                ✉ {emailing ? 'Sending…' : 'Notify Landlord'}
              </button>
              {emailMsg && <span className={`text-xs ${emailMsg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>{emailMsg}</span>}
            </div>
          )}
          {unit.comparables_sample?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                VOA 2023–24 median ± spread ({unit.comparables_count} data points)
              </p>
              <div className="flex flex-wrap gap-2">
                {unit.comparables_sample.map((c, i) => (
                  <span key={i} className="bg-white border border-gray-200 text-xs text-gray-700 px-2.5 py-1 rounded-full">
                    £{c.price.toLocaleString()}/mo{c.address ? ` · ${c.address}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
