import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import api from '../lib/api'

const fmt = n => `£${Math.round(n || 0).toLocaleString()}`
const fmtPct = n => `${(n || 0).toFixed(1)}%`

const VERDICT_STYLES = {
  star:  { bg: 'bg-emerald-50',  ring: 'ring-emerald-200',  text: 'text-emerald-700',  dot: 'bg-emerald-500',  label: 'Star' },
  ok:    { bg: 'bg-sky-50',      ring: 'ring-sky-200',      text: 'text-sky-700',      dot: 'bg-sky-500',      label: 'OK' },
  watch: { bg: 'bg-amber-50',    ring: 'ring-amber-200',    text: 'text-amber-700',    dot: 'bg-amber-500',    label: 'Watch' },
  drop:  { bg: 'bg-red-50',      ring: 'ring-red-200',      text: 'text-red-700',      dot: 'bg-red-500',      label: 'Drop' },
}

const ACTION_STYLES = {
  rent_review: { label: 'Rent review',  color: 'bg-indigo-100 text-indigo-700' },
  renewal:     { label: 'Renewal',      color: 'bg-violet-100 text-violet-700' },
  retention:   { label: 'Retention',    color: 'bg-amber-100 text-amber-700' },
}

function Kpi({ label, value, sub, color = 'indigo', accent }) {
  const colors = {
    indigo:  'text-indigo-600',
    emerald: 'text-emerald-600',
    rose:    'text-rose-600',
    amber:   'text-amber-600',
    sky:     'text-sky-600',
    gray:    'text-gray-700',
  }
  return (
    <div className={`bg-white border rounded-xl p-4 ${accent ? 'border-indigo-200 shadow-sm' : 'border-gray-200'}`}>
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color] || colors.gray}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function VerdictPill({ verdict }) {
  const s = VERDICT_STYLES[verdict] || VERDICT_STYLES.ok
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${s.bg} ${s.ring} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-sky-500' : score >= 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 tabular-nums w-7">{score}</span>
    </div>
  )
}

const ForecastTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const gross = payload.find(p => p.dataKey === 'gross_rent')?.value
  const fee = payload.find(p => p.dataKey === 'agency_revenue')?.value
  const risk = payload.find(p => p.dataKey === 'at_risk_fee')?.value
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-gray-600">Gross rent: <span className="font-semibold">{fmt(gross)}</span></p>
      <p className="text-indigo-600">Agency fee: <span className="font-semibold">{fmt(fee)}</span></p>
      {risk > 0 && <p className="text-rose-600">At risk: <span className="font-semibold">{fmt(risk)}</span></p>}
    </div>
  )
}

export default function CFO() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feePct, setFeePct] = useState(10)
  const [handlingCost, setHandlingCost] = useState(25)
  const [scoreSort, setScoreSort] = useState('net_to_agency_12mo')
  const [scoreDir, setScoreDir] = useState('desc')
  const [letterModal, setLetterModal] = useState(null) // { action }
  const [letterForm, setLetterForm] = useState({ proposed_rent: '', effective_date: '', custom_notes: '', send_email: false })
  const [letterLoading, setLetterLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { load() }, [feePct, handlingCost])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/cfo/dashboard', { params: { fee_pct: feePct, handling_cost_per_job: handlingCost } })
      setData(r.data)
    } finally {
      setLoading(false)
    }
  }

  const sortedScorecard = useMemo(() => {
    if (!data?.scorecard) return []
    return [...data.scorecard].sort((a, b) => {
      const av = a[scoreSort], bv = b[scoreSort]
      if (typeof av === 'string') return scoreDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return scoreDir === 'asc' ? av - bv : bv - av
    })
  }, [data, scoreSort, scoreDir])

  const handleSort = col => {
    if (scoreSort === col) setScoreDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setScoreSort(col); setScoreDir('desc') }
  }
  const SortIcon = ({ col }) => scoreSort !== col
    ? <span className="text-gray-300 ml-1">↕</span>
    : scoreDir === 'asc' ? <span className="text-indigo-500 ml-1">↑</span> : <span className="text-indigo-500 ml-1">↓</span>

  async function sendLetter(e) {
    e.preventDefault()
    setLetterLoading(true)
    try {
      const res = await api.post('/cfo/rent-review-letter', {
        unit_id: letterModal.action.unit_id,
        proposed_rent: Number(letterForm.proposed_rent),
        effective_date: letterForm.effective_date,
        custom_notes: letterForm.custom_notes || null,
        send_email: letterForm.send_email,
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'RentReview.pdf'; a.click()
      URL.revokeObjectURL(url)
      setLetterModal(null)
    } catch {
      alert('Failed to generate letter.')
    } finally {
      setLetterLoading(false)
    }
  }

  if (loading && !data) return <div className="text-center py-20 text-gray-400">Loading CFO synthesis…</div>
  if (!data) return null

  const { kpis, scorecard, push_actions, drop_actions, forecast } = data
  const totalPushUplift = push_actions.reduce((s, a) => s + (a.fee_impact_annual || 0), 0)
  const totalDropDrag = drop_actions.reduce((s, d) => s + (d.drag_estimate || 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>💼</span> CFO Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Portfolio synthesis — what to push, what to drop, where the money goes.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Mgmt fee %</label>
            <input
              type="number" min="0" max="100" step="0.5"
              value={feePct} onChange={e => setFeePct(Number(e.target.value) || 0)}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">£/job</label>
            <input
              type="number" min="0" step="5"
              value={handlingCost} onChange={e => setHandlingCost(Number(e.target.value) || 0)}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi accent label="Agency rev (12mo)" value={fmt(kpis.agency_revenue_12mo)} sub={`${fmtPct(kpis.margin_pct)} margin`} color="indigo" />
        <Kpi label="Net to agency" value={fmt(kpis.net_agency_margin_12mo)} sub={`after £${kpis.cost_to_serve_12mo.toLocaleString()} handling`} color={kpis.net_agency_margin_12mo >= 0 ? 'emerald' : 'rose'} />
        <Kpi label="Run-rate (annual)" value={fmt(kpis.annual_agency_run_rate)} sub={`${fmt(kpis.monthly_agency_run_rate)}/mo`} color="sky" />
        <Kpi label="Rent roll" value={fmt(kpis.monthly_rent_roll)} sub="per month" color="gray" />
        <Kpi label="Occupancy" value={fmtPct(kpis.occupancy_pct)} sub={`${kpis.occupied_units}/${kpis.units} units`} color={kpis.occupancy_pct >= 90 ? 'emerald' : 'amber'} />
        <Kpi label="Profitable props" value={`${kpis.profitable_properties}/${kpis.properties}`} sub={fmtPct(kpis.pct_profitable)} color={kpis.pct_profitable >= 80 ? 'emerald' : 'amber'} />
      </div>

      {/* Push / Drop side-by-side */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* PUSH */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 text-lg">↗</span>
              <h2 className="font-semibold text-gray-900">Push this</h2>
              <span className="text-xs text-gray-500">({push_actions.length})</span>
            </div>
            <div className="text-xs text-emerald-700 font-semibold">
              +{fmt(totalPushUplift)}/yr potential
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {push_actions.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No push actions surfaced — portfolio looks fully optimised.
              </div>
            )}
            {push_actions.map((a, i) => {
              const style = ACTION_STYLES[a.type] || ACTION_STYLES.rent_review
              return (
                <div key={i} className="px-5 py-3 hover:bg-gray-50 transition-colors flex items-start justify-between gap-3">
                  <button
                    onClick={() => a.link && navigate(a.link)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.color}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">{a.title}</span>
                    </div>
                    <p className="text-xs text-gray-500">{a.detail}</p>
                  </button>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-emerald-600">+{fmt(a.fee_impact_annual)}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">fee/yr</p>
                    {a.type === 'rent_review' && a.unit_id && (
                      <button
                        onClick={() => {
                          setLetterModal({ action: a })
                          setLetterForm({ proposed_rent: a.impact_annual ? Math.round(a.impact_annual / 12 + (a.impact_annual / 12)) : '', effective_date: '', custom_notes: '', send_email: false })
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium underline"
                      >
                        Send letter
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* DROP */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-rose-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-rose-600 text-lg">↘</span>
              <h2 className="font-semibold text-gray-900">Drop this</h2>
              <span className="text-xs text-gray-500">({drop_actions.length})</span>
            </div>
            <div className="text-xs text-rose-700 font-semibold">
              −{fmt(totalDropDrag)}/yr drag
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {drop_actions.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No drag detected — every property pulls its weight.
              </div>
            )}
            {drop_actions.map((d, i) => (
              <button
                key={i}
                onClick={() => navigate(d.link)}
                className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <VerdictPill verdict={d.verdict} />
                    <span className="text-sm font-medium text-gray-900 truncate">{d.property_name}</span>
                  </div>
                  <ul className="text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                    {d.reasons.slice(0, 3).map((r, j) => <li key={j}>{r}</li>)}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-rose-600">−{fmt(d.drag_estimate)}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">drag/yr</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">12-month agency revenue forecast</h2>
            <p className="text-xs text-gray-500 mt-0.5">Based on active leases, end dates & fee rate.</p>
          </div>
          <div className="text-xs text-gray-500">
            Assumes <span className="font-semibold text-gray-700">{kpis.fee_pct}%</span> management fee
          </div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={forecast} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={v => `£${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<ForecastTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="agency_revenue" name="Agency fee" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
              <Bar dataKey="at_risk_fee" name="At-risk fee" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Property scorecard */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Property scorecard</h2>
            <p className="text-xs text-gray-500 mt-0.5">Score = margin × occupancy × collection × low-jobs (out of 100).</p>
          </div>
          <div className="text-xs text-gray-500">{scorecard.length} properties</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('property_name')}>Property<SortIcon col="property_name" /></th>
                <th className="text-left px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('score')}>Score<SortIcon col="score" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('monthly_rent')}>Rent/mo<SortIcon col="monthly_rent" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('agency_revenue_12mo')}>Fee 12mo<SortIcon col="agency_revenue_12mo" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('cost_to_serve_12mo')}>Cost 12mo<SortIcon col="cost_to_serve_12mo" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('net_to_agency_12mo')}>Net 12mo<SortIcon col="net_to_agency_12mo" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('margin_pct')}>Margin<SortIcon col="margin_pct" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('collection_rate')}>Collection<SortIcon col="collection_rate" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('jobs_12mo')}>Jobs<SortIcon col="jobs_12mo" /></th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-gray-700" onClick={() => handleSort('void_units')}>Void<SortIcon col="void_units" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedScorecard.map(s => (
                <tr key={s.property_id} onClick={() => navigate(`/properties/${s.property_id}`)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <VerdictPill verdict={s.verdict} />
                      <span className="font-medium text-gray-900">{s.property_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{s.address}</p>
                  </td>
                  <td className="px-3 py-2.5"><ScoreBar score={s.score} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmt(s.monthly_rent)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 font-medium">{fmt(s.agency_revenue_12mo)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmt(s.cost_to_serve_12mo)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${s.net_to_agency_12mo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(s.net_to_agency_12mo)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${s.margin_pct >= 50 ? 'text-emerald-600' : s.margin_pct >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>{fmtPct(s.margin_pct)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${s.collection_rate >= 95 ? 'text-emerald-600' : s.collection_rate >= 85 ? 'text-amber-600' : 'text-rose-600'}`}>{fmtPct(s.collection_rate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{s.jobs_12mo}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${s.void_units > 0 ? 'text-rose-600 font-medium' : 'text-gray-400'}`}>{s.void_units}</td>
                </tr>
              ))}
              {sortedScorecard.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No properties yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center pt-2">
        Synthesis combines rent payments, maintenance, churn signals, renewals & active leases.
        Adjust fee % & £/job above to test scenarios.
      </p>

      {/* Rent review letter modal */}
      {letterModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Rent review letter</h2>
            <p className="text-sm text-gray-500 mb-4">{letterModal.action.title}</p>
            <form onSubmit={sendLetter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Proposed rent (£/mo) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="25" required
                  value={letterForm.proposed_rent}
                  onChange={e => setLetterForm(f => ({ ...f, proposed_rent: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 1250" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Effective date <span className="text-red-500">*</span></label>
                <input type="date" required
                  value={letterForm.effective_date}
                  onChange={e => setLetterForm(f => ({ ...f, effective_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Additional notes (optional)</label>
                <textarea rows={2} value={letterForm.custom_notes}
                  onChange={e => setLetterForm(f => ({ ...f, custom_notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Any context for the landlord…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={letterForm.send_email}
                  onChange={e => setLetterForm(f => ({ ...f, send_email: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm text-gray-700">Also email PDF to landlord</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={letterLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {letterLoading ? 'Generating…' : 'Download PDF'}
                </button>
                <button type="button" onClick={() => setLetterModal(null)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
