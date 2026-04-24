import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const RISK_CONFIG = {
  1: { label: 'Low', bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', dot: 'bg-green-500' },
  2: { label: 'Low-Medium', bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  3: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500', dot: 'bg-yellow-500' },
  4: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  5: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', dot: 'bg-red-500' },
}

const TREND_CONFIG = {
  improving: { icon: '↗', text: 'text-green-600', label: 'Improving' },
  stable: { icon: '→', text: 'text-gray-500', label: 'Stable' },
  worsening: { icon: '↘', text: 'text-red-600', label: 'Worsening' },
}

export default function RentRisk() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/risk')
      setData(res.data)
    } finally {
      setLoading(false)
    }
  }

  const tenants = data?.tenants || []
  const filtered = filter === 'all' ? tenants : tenants.filter(t =>
    filter.startsWith('score_') ? t.risk_score === parseInt(filter.split('_')[1]) : true
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-3xl mb-3">🤖</div>
          <p className="text-gray-500 text-sm">Analysing payment history...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Rent Risk Scoring" subtitle="AI-powered arrears risk assessment across your portfolio">
        <button
          onClick={load}
          className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>↻</span> Refresh
        </button>
      </PageHeader>

      {/* AI Summary */}
      {data?.summary && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 flex gap-4">
          <div className="text-2xl">🤖</div>
          <div>
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">AI Portfolio Briefing</p>
            <p className="text-sm text-indigo-900 leading-relaxed">{data.summary}</p>
          </div>
        </div>
      )}

      {/* Score breakdown */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          [5, 'Critical', data?.counts?.critical || 0],
          [4, 'High', data?.counts?.high || 0],
          [3, 'Medium', data?.counts?.medium || 0],
          [2, 'Low-Med', data?.counts?.low_medium || 0],
          [1, 'Low', data?.counts?.low || 0],
        ].map(([score, label, count]) => {
          const cfg = RISK_CONFIG[score]
          return (
            <div
              key={score}
              onClick={() => setFilter(filter === `score_${score}` ? 'all' : `score_${score}`)}
              className={`bg-white border rounded-xl p-4 text-center cursor-pointer transition-all ${
                filter === `score_${score}` ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${cfg.text}`}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Arrears total */}
      {data?.total_arrears > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Total Current Arrears</p>
              <p className="text-xs text-red-600">Across all active tenants</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-700">£{data.total_arrears.toLocaleString('en-GB', { minimumFractionDigits: 0 })}</p>
        </div>
      )}

      {/* Reset filter */}
      {filter !== 'all' && (
        <div className="mb-4">
          <button onClick={() => setFilter('all')} className="text-sm text-indigo-600 hover:underline">
            ← Show all tenants
          </button>
        </div>
      )}

      {/* Tenant list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          {filter === 'critical' || filter === 'action'
            ? 'No tenants require action right now.'
            : 'No active tenants found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const cfg = RISK_CONFIG[t.risk_score]
            const trend = TREND_CONFIG[t.trend] || TREND_CONFIG.stable
            return (
              <div
                key={t.tenant_id}
                onClick={() => setSelected(selected?.tenant_id === t.tenant_id ? null : t)}
                className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Risk indicator */}
                  <div className="flex flex-col items-center w-16 shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${cfg.bg}`}>
                      <span className={`text-xl font-black ${cfg.text}`}>{t.risk_score}</span>
                    </div>
                    <span className={`text-xs font-semibold mt-1 ${cfg.text}`}>{cfg.label}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{t.tenant_name}</h3>
                      <span className={`text-xs font-medium ${trend.text}`}>
                        {trend.icon} {trend.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{t.property} · {t.unit} · £{t.monthly_rent.toLocaleString()}/mo</p>
                    <div className="flex flex-wrap gap-2">
                      {t.factors.map((f, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="w-32 shrink-0 hidden sm:block">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Health</span>
                      <span>{t.score_pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.bar}`}
                        style={{ width: `${t.score_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-400 shrink-0">
                    {selected?.tenant_id === t.tenant_id ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?.tenant_id === t.tenant_id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Stats</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ['Total', t.stats.total_payments],
                          ['On Time', t.stats.on_time],
                          ['Late', t.stats.late],
                          ['Overdue', t.stats.overdue],
                          ['Partial', t.stats.partial],
                          ['Arrears', `£${t.stats.current_arrears.toLocaleString()}`],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="text-base font-bold text-gray-800 mt-0.5">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommended Action</p>
                      <div className={`${cfg.bg} rounded-lg p-4`}>
                        <p className={`text-sm font-medium ${cfg.text}`}>{t.recommendation}</p>
                      </div>
                      {t.tenant_email && (
                        <p className="text-xs text-gray-500 mt-3">
                          <span className="font-medium">Email:</span> {t.tenant_email}
                        </p>
                      )}
                      {t.tenant_phone && (
                        <p className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Phone:</span> {t.tenant_phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
