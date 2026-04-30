import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const EPC_COLORS = {
  A: 'bg-green-600', B: 'bg-green-500', C: 'bg-lime-500',
  D: 'bg-yellow-400', E: 'bg-orange-400', F: 'bg-orange-600', G: 'bg-red-600',
}

const COMPLIANCE_BANDS = [
  { key: '30',    label: '0–30 days',   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
  { key: '60',    label: '31–60 days',  bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { key: '90',    label: '61–90 days',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'  },
  { key: '120',   label: '91–120 days', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  { key: 'later', label: '120+ days',   bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600'   },
]

function urgencyLabel(days) {
  if (days === undefined || days === null) return null
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, cls: 'text-red-600 font-bold' }
  if (days === 0) return { label: 'Start today', cls: 'text-red-600 font-bold' }
  if (days <= 14) return { label: `Start within ${days}d`, cls: 'text-red-500 font-semibold' }
  if (days <= 30) return { label: `Start within ${days}d`, cls: 'text-orange-500 font-semibold' }
  return { label: `Start by ${days}d from now`, cls: 'text-gray-500' }
}

export default function EpcRoadmap() {
  const [properties, setProperties] = useState([])
  const [compliance, setCompliance] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ current_rating: 'D', year_built: '', floor_area_sqm: '', target_date: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState(new Map())

  function toggleItem(key, imp) {
    setSelectedItems(prev => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, imp)
      return next
    })
  }

  useEffect(() => {
    api.get('/properties').then(r => setProperties(r.data)).catch(() => {})
    api.get('/intelligence/epc-compliance').then(r => {
      setCompliance(r.data)
      // Silently generate roadmaps for any non-compliant properties not yet in the DB
      if (r.data.length > 0) {
        api.post('/intelligence/epc-roadmap/auto-generate-all').catch(() => {})
      }
    }).catch(() => {})
  }, [])

  async function generateWith(propertyObj, rating, targetDate, yearBuilt, floorArea) {
    if (!propertyObj) return
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/intelligence/epc-roadmap', {
        property_id: propertyObj.id,
        current_rating: rating,
        property_type: propertyObj.property_type || '',
        year_built: yearBuilt ? parseInt(yearBuilt) : null,
        floor_area_sqm: floorArea ? parseInt(floorArea) : null,
        target_date: targetDate || null,
      })
      setResult(r.data)
      setSelectedItems(new Map())
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to generate roadmap')
    }
    setLoading(false)
  }

  function generate() {
    generateWith(selected, form.current_rating, form.target_date, form.year_built, form.floor_area_sqm)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <PageHeader title="EPC Roadmap" subtitle="AI-powered energy efficiency improvement plans" />
      </div>

      {/* Compliance urgency panel */}
      {compliance.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Non-compliant properties — lease end urgency</h3>
            <p className="text-xs text-gray-400 mt-0.5">Properties with EPC D–G where tenancies are ending soonest. These need upgrading before re-letting.</p>
          </div>
          {COMPLIANCE_BANDS.map(band => {
            const items = compliance.filter(p => p.band === band.key)
            if (!items.length) return null
            return (
              <div key={band.key}>
                <div className={`px-5 py-2 border-b text-xs font-semibold uppercase tracking-wide ${band.bg} ${band.border} ${band.text}`}>
                  {band.label}{band.key === 'later' ? '' : ' until lease ends'}
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map(p => (
                    <div key={p.unit_id} className="px-5 py-3 flex items-center gap-4">
                      <span className={`w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold shrink-0 ${EPC_COLORS[p.epc_rating] || 'bg-gray-400'}`}>
                        {p.epc_rating}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{p.property_name}{p.unit_name ? <span className="text-gray-400 font-normal"> · {p.unit_name}</span> : ''}</p>
                        <p className="text-xs text-gray-400">{p.address} · {p.postcode}</p>
                        {p.vacant
                          ? <p className="text-xs text-red-500 font-medium mt-0.5">Vacant — cannot re-let without EPC C</p>
                          : <p className="text-xs text-gray-400 mt-0.5">Tenant: {p.tenant_name} · lease ends {new Date(p.lease_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        }
                      </div>
                      <button
                        onClick={() => {
                          const prop = properties.find(pp => pp.id === p.property_id)
                            || { id: p.property_id, name: p.property_name, property_type: '' }
                          const rating = p.epc_rating
                          const targetDate = p.lease_end ? p.lease_end.slice(0, 10) : ''
                          setSelected(prop)
                          setForm(f => ({ ...f, current_rating: rating, target_date: targetDate }))
                          setResult(null)
                          setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
                          generateWith(prop, rating, targetDate, '', '')
                        }}
                        className="text-xs bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-100 whitespace-nowrap shrink-0">
                        Generate roadmap
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {compliance.length === 0 && properties.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <span className="text-green-500 text-xl">✓</span>
          <p className="text-sm text-green-800 font-medium">All properties with stored EPC ratings are compliant (A–C).</p>
        </div>
      )}

      {/* Input card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Select a property to analyse</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Property</label>
            <select value={selected?.id || ''} onChange={e => {
              const p = properties.find(p => String(p.id) === e.target.value) || null
              setSelected(p)
              if (p?.epc_rating) setForm(f => ({ ...f, current_rating: p.epc_rating }))
            }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.postcode}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current EPC Rating</label>
            <div className="flex gap-1.5">
              {['A','B','C','D','E','F','G'].map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, current_rating: r }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                    form.current_rating === r
                      ? `${EPC_COLORS[r]} text-white ring-2 ring-offset-1 ring-gray-400`
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year Built (optional)</label>
            <input type="number" placeholder="e.g. 1975" value={form.year_built}
              onChange={e => setForm(f => ({ ...f, year_built: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Floor Area (sqm, optional)</label>
            <input type="number" placeholder="e.g. 75" value={form.floor_area_sqm}
              onChange={e => setForm(f => ({ ...f, floor_area_sqm: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target completion — before re-letting (optional)</label>
            <input type="date" value={form.target_date}
              onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <button onClick={generate} disabled={!selected || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Generating plan…' : 'Generate EPC Roadmap'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{result.property_name}</h2>
                {result.summary && <p className="text-sm text-gray-600 mt-1">{result.summary}</p>}
                {result.target_date && (
                  <p className="text-xs text-indigo-600 font-medium mt-1">
                    Recommended completion before re-letting: {new Date(result.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Legal deadline: 2028
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold ${EPC_COLORS[result.current_rating] || 'bg-gray-400'}`}>
                    {result.current_rating}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Now</p>
                </div>
                <span className="text-gray-300">→</span>
                {['C','B','A'].map(r => (
                  <div key={r} className="text-center">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${EPC_COLORS[r]} ${r === 'C' ? 'text-lg ring-2 ring-offset-1 ring-lime-400' : 'text-sm opacity-60'}`}>{r}</div>
                    <p className="text-xs text-gray-400 mt-1">{r === 'C' ? 'Legal min' : r === 'B' ? 'Premium' : 'Best'}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.already_compliant && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <span className="text-green-500 text-xl">✓</span>
                <p className="text-sm text-green-800 font-medium">{result.message}</p>
              </div>
            )}
          </div>

          {/* Tiered improvements */}
          {result.tiers?.map((tier, ti) => (
            <TierPanel key={tier.target_rating} tier={tier} targetDate={result.target_date} tierIndex={ti}
              selectedItems={selectedItems} onToggle={toggleItem} />
          ))}
        </div>
      )}

      <SelectionSummary
        selected={[...selectedItems.values()]}
        onClear={() => setSelectedItems(new Map())}
      />

      <ProcurementPanel />
    </div>
  )
}

const TIER_STYLES = {
  C: { bg: 'bg-lime-50',   border: 'border-lime-200',   badge: 'bg-lime-100 text-lime-800',   dot: 'bg-lime-500'   },
  B: { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500'  },
  A: { bg: 'bg-emerald-50',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-800',dot: 'bg-emerald-600'},
}

function SelectionSummary({ selected, onClear }) {
  if (selected.length === 0) return null
  const totalMinCost = selected.reduce((s, i) => s + (i.estimated_cost_min || 0), 0)
  const totalMaxCost = selected.reduce((s, i) => s + (i.estimated_cost_max || 0), 0)
  const totalEpcPts = selected.reduce((s, i) => s + (i.epc_points || 0), 0)
  const totalEnergy = selected.reduce((s, i) => s + (i.annual_energy_saving || 0), 0)
  const totalRent = selected.reduce((s, i) => s + (i.monthly_rent_uplift || 0), 0)
  const needsVoid = selected.some(i => i.timing_recommendation === 'between_lettings')
  const maxDuration = selected.reduce((s, i) => s + (i.duration_days || 0), 0)

  return (
    <div className="sticky bottom-4 z-10 mx-1">
      <div className="bg-indigo-700 text-white rounded-xl shadow-xl px-5 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wide">Selected works</span>
          <span className="bg-white text-indigo-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{selected.length}</span>
        </div>
        <div className="flex gap-5 flex-wrap flex-1">
          <div>
            <p className="text-xs text-indigo-300">Combined cost</p>
            <p className="text-sm font-bold">£{totalMinCost.toLocaleString()}–£{totalMaxCost.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-300">EPC gain</p>
            <p className="text-sm font-bold">+{totalEpcPts} pts</p>
          </div>
          {totalEnergy > 0 && (
            <div>
              <p className="text-xs text-indigo-300">Energy saving</p>
              <p className="text-sm font-bold">£{totalEnergy.toLocaleString()}/yr</p>
            </div>
          )}
          {totalRent > 0 && (
            <div>
              <p className="text-xs text-indigo-300">Rent uplift</p>
              <p className="text-sm font-bold">+£{totalRent}/mo</p>
            </div>
          )}
          {maxDuration > 0 && (
            <div>
              <p className="text-xs text-indigo-300">Total duration</p>
              <p className="text-sm font-bold">{maxDuration} days</p>
            </div>
          )}
          {needsVoid && (
            <div className="flex items-center">
              <span className="text-xs bg-orange-400 text-white px-2 py-0.5 rounded-full font-medium">Requires void period</span>
            </div>
          )}
        </div>
        <button onClick={onClear} className="text-xs text-indigo-300 hover:text-white ml-auto shrink-0">Clear</button>
      </div>
    </div>
  )
}

function TierPanel({ tier, targetDate, tierIndex, selectedItems, onToggle }) {
  const [open, setOpen] = useState(tierIndex === 0)
  const s = TIER_STYLES[tier.target_rating] || TIER_STYLES.C
  const hasImprovements = tier.improvements?.length > 0

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${s.border}`}>
      <button onClick={() => setOpen(o => !o)}
        className={`w-full px-6 py-4 flex items-center justify-between gap-4 text-left ${s.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg ${EPC_COLORS[tier.target_rating]}`}>
            {tier.target_rating}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              To reach EPC {tier.target_rating}
              {tierIndex > 0 && <span className="text-xs font-normal text-gray-500 ml-2">(additional works beyond {['C','B'][tierIndex-1]})</span>}
            </p>
            <p className="text-xs text-gray-500">{tier.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {tier.total_estimated_cost_min > 0 && (
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">£{tier.total_estimated_cost_min?.toLocaleString()}–£{tier.total_estimated_cost_max?.toLocaleString()}</p>
              {tier.estimated_rent_uplift > 0 && <p className="text-xs text-indigo-600">+£{tier.estimated_rent_uplift}/mo rent</p>}
            </div>
          )}
          {tier.achievable === false && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.badge}`}>Not achievable</span>
          )}
          <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="bg-white">
          {tier.note && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-700">{tier.note}</p>
            </div>
          )}
          {!hasImprovements && !tier.note && (
            <p className="px-6 py-4 text-sm text-gray-400 italic">No additional works required to reach this rating.</p>
          )}
          {hasImprovements && (
            <div className="divide-y divide-gray-100">
              {tier.improvements
                .slice()
                .sort((a, b) => (a.days_until_start ?? 999) - (b.days_until_start ?? 999))
                .map((imp, i) => {
                  const urgency = urgencyLabel(imp.days_until_start)
                  const key = `${tier.target_rating}-${i}`
                  const checked = selectedItems.has(key)
                  return (
                    <div key={i}
                      onClick={() => onToggle(key, imp)}
                      className={`px-6 py-4 cursor-pointer transition-colors ${checked ? 'bg-indigo-50' : urgency && imp.days_until_start <= 14 ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-2 shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggle(key, imp)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                              {imp.priority}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{imp.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{imp.description}</p>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {imp.duration_days && <span className="text-xs text-gray-400">⏱ {imp.duration_days} days</span>}
                              {imp.latest_start_date && (
                                <span className="text-xs text-gray-500">
                                  Latest start: <strong>{new Date(imp.latest_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                                </span>
                              )}
                              {urgency && <span className={`text-xs ${urgency.cls}`}>{urgency.label}</span>}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {imp.intrusiveness === 'low' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">● Low disruption</span>
                              )}
                              {imp.intrusiveness === 'medium' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">● Medium disruption</span>
                              )}
                              {imp.intrusiveness === 'high' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">● High — void only</span>
                              )}
                              {imp.timing_recommendation === 'during_tenancy' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">✓ Can do while occupied</span>
                              )}
                              {imp.timing_recommendation === 'between_lettings' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">⚠ Best done between lettings</span>
                              )}
                              {imp.timing_recommendation === 'either' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">✓ Either works</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="text-sm font-bold text-gray-800">£{imp.estimated_cost_min?.toLocaleString()}–£{imp.estimated_cost_max?.toLocaleString()}</p>
                          <p className="text-xs text-green-600">+{imp.epc_points} EPC pts</p>
                          {imp.annual_energy_saving && <p className="text-xs text-gray-400">£{imp.annual_energy_saving}/yr saving</p>}
                          {imp.monthly_rent_uplift && <p className="text-xs text-indigo-500">+£{imp.monthly_rent_uplift}/mo rent</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TRADE_META = {
  insulation: { label: 'Insulation',  color: 'bg-blue-100 text-blue-700'    },
  glazing:    { label: 'Glazing',     color: 'bg-cyan-100 text-cyan-700'     },
  heating:    { label: 'Heating',     color: 'bg-orange-100 text-orange-700' },
  electrical: { label: 'Electrical',  color: 'bg-yellow-100 text-yellow-700' },
  solar:      { label: 'Solar',       color: 'bg-green-100 text-green-700'   },
  roofing:    { label: 'Roofing',     color: 'bg-stone-100 text-stone-700'   },
  general:    { label: 'General',     color: 'bg-gray-100 text-gray-600'     },
}

function TradeBadge({ trade }) {
  const meta = TRADE_META[trade] || TRADE_META.general
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
}

function ProcurementPanel() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTrade, setActiveTrade] = useState(null)

  useEffect(() => {
    api.get('/intelligence/epc-procurement')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading || data.length === 0) return null

  // Infer trade for older records that lack it (title-based fallback)
  function inferTrade(g) {
    if (g.trade && g.trade !== 'general') return g.trade
    const t = g.title.toLowerCase()
    if (t.includes('insul') || t.includes('draught') || t.includes('loft') || t.includes('wall insul') || t.includes('floor insul')) return 'insulation'
    if (t.includes('glaz') || t.includes('window')) return 'glazing'
    if (t.includes('boiler') || t.includes('heat pump') || t.includes('heating') || t.includes('radiator')) return 'heating'
    if (t.includes('solar') || t.includes('pv') || t.includes('battery')) return 'solar'
    if (t.includes('electr') || t.includes('led') || t.includes('lighting') || t.includes('rewire')) return 'electrical'
    if (t.includes('roof')) return 'roofing'
    return 'general'
  }

  const enriched = data.map(g => ({ ...g, _trade: inferTrade(g) }))
  const trades = [...new Set(enriched.map(g => g._trade))].sort()
  const filtered = activeTrade ? enriched.filter(g => g._trade === activeTrade) : enriched

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Portfolio works procurement</h3>
            <p className="text-xs text-gray-400 mt-0.5">All EPC improvement types grouped across your portfolio — brief contractors on batched jobs.</p>
          </div>
        </div>
        {/* Trade filter chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() => setActiveTrade(null)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!activeTrade ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All trades
          </button>
          {trades.map(trade => {
            const meta = TRADE_META[trade] || TRADE_META.general
            return (
              <button key={trade}
                onClick={() => setActiveTrade(activeTrade === trade ? null : trade)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${activeTrade === trade ? 'bg-indigo-600 text-white' : `${meta.color} hover:opacity-80`}`}>
                {meta.label} ({enriched.filter(g => g._trade === trade).length})
              </button>
            )
          })}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {filtered.map((g, i) => (
          <div key={i} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{g.title}</p>
                  <TradeBadge trade={g._trade} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{g.properties.length} propert{g.properties.length === 1 ? 'y' : 'ies'} need this</p>
                <div className="mt-2 space-y-1">
                  {g.properties.map((p, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center shrink-0 ${EPC_COLORS[p.epc_rating] || 'bg-gray-400'}`}>{p.epc_rating}</span>
                      <span className="font-medium text-gray-700">{p.property_name}</span>
                      {p.latest_start_date && (
                        <span className={`ml-1 ${p.days_until_start !== undefined && p.days_until_start <= 14 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          · start by {new Date(p.latest_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {p.days_until_start !== undefined && p.days_until_start <= 30 ? ` (${p.days_until_start}d)` : ''}
                        </span>
                      )}
                      {p.duration_days && <span className="text-gray-400">· {p.duration_days}d work</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-800">£{g.total_cost_min.toLocaleString()}–£{g.total_cost_max.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">combined estimate</p>
                {g.earliest_deadline && (
                  <p className="text-xs text-indigo-600 mt-1">Earliest deadline: {new Date(g.earliest_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
