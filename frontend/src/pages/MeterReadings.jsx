import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const TYPE_ICONS = { electricity: '⚡', gas: '🔥', water: '💧' }
const TYPE_UNITS = { electricity: 'kWh', gas: 'm³', water: 'm³' }
const TYPE_COLORS = {
  electricity: { active: 'border-yellow-400 bg-yellow-50', text: 'text-yellow-700', count: 'text-yellow-900' },
  gas:         { active: 'border-orange-400 bg-orange-50', text: 'text-orange-700', count: 'text-orange-900' },
  water:       { active: 'border-blue-400 bg-blue-50',   text: 'text-blue-700',   count: 'text-blue-900'   },
}

function fmtDate(d) { return d ? d.slice(0, 10) : '—' }

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return (
    <svg className="inline ml-1 w-3 h-3 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5-5 5 5M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
  return sortDir === 'asc'
    ? <svg className="inline ml-1 w-3 h-3 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 15l7-7 7 7"/></svg>
    : <svg className="inline ml-1 w-3 h-3 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 9l-7 7-7-7"/></svg>
}

function LogReadingModal({ tenants, onClose, onSaved }) {
  const [form, setForm] = useState({
    tenant_id: '', meter_type: 'electricity', reading: '',
    reading_date: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!form.tenant_id || !form.reading) { setErr('Tenant and reading are required'); return }
    setSaving(true); setErr('')
    try {
      const r = await api.post('/tenants/meter-readings', {
        ...form, tenant_id: Number(form.tenant_id), reading: Number(form.reading),
      })
      onSaved(r.data); onClose()
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Log Meter Reading</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tenant</label>
            <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer">
              <option value="">Select tenant…</option>
              {[...tenants].sort((a, b) => (a.full_name?.split(' ').slice(-1)[0] || '').localeCompare(b.full_name?.split(' ').slice(-1)[0] || '')).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meter type</label>
              <select value={form.meter_type} onChange={e => setForm(f => ({ ...f, meter_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer">
                <option value="electricity">⚡ Electricity</option>
                <option value="gas">🔥 Gas</option>
                <option value="water">💧 Water</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={form.reading_date} onChange={e => setForm(f => ({ ...f, reading_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reading ({TYPE_UNITS[form.meter_type]})</label>
            <input type="number" step="0.01" value={form.reading} onChange={e => setForm(f => ({ ...f, reading: e.target.value }))}
              placeholder="e.g. 12345.67"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. check-out reading"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="cursor-pointer text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="cursor-pointer bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Save Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const COLS = [
  { key: 'tenant_name',  label: 'Tenant',          align: 'left'  },
  { key: 'property',     label: 'Property / Unit',  align: 'left'  },
  { key: 'meter_type',   label: 'Type',             align: 'center'},
  { key: 'reading',      label: 'Reading',          align: 'right' },
  { key: 'reading_date', label: 'Date',             align: 'left'  },
  { key: 'notes',        label: 'Notes',            align: 'left'  },
  { key: 'submitted_by', label: 'Source',           align: 'left'  },
]

function sortVal(r, key) {
  if (key === 'reading') return Number(r.reading) || 0
  if (key === 'reading_date') return r.reading_date || ''
  if (key === 'property') return `${r.property || ''} ${r.unit || ''}`
  return (r[key] || '').toString().toLowerCase()
}

export default function MeterReadings() {
  const [readings, setReadings]     = useState(null)
  const [tenants, setTenants]       = useState([])
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortCol, setSortCol]       = useState('reading_date')
  const [sortDir, setSortDir]       = useState('desc')
  const [showModal, setShowModal]   = useState(false)

  useEffect(() => {
    api.get('/tenants/meter-readings').then(r => setReadings(r.data)).catch(() => setReadings([]))
    api.get('/tenants').then(r => setTenants(r.data)).catch(() => {})
  }, [])

  function toggleType(t) { setTypeFilter(prev => prev === t ? 'all' : t) }

  function handleSort(key) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  const counts = { electricity: 0, gas: 0, water: 0 }
  ;(readings || []).forEach(r => { if (counts[r.meter_type] !== undefined) counts[r.meter_type]++ })

  const filtered = (readings || [])
    .filter(r => {
      if (typeFilter !== 'all' && r.meter_type !== typeFilter) return false
      if (sourceFilter !== 'all' && r.submitted_by !== sourceFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.tenant_name?.toLowerCase().includes(q) ||
          r.property?.toLowerCase().includes(q) ||
          r.unit?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          r.meter_type?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      const av = sortVal(a, sortCol), bv = sortVal(b, sortCol)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  return (
    <div>
      {showModal && (
        <LogReadingModal
          tenants={tenants}
          onClose={() => setShowModal(false)}
          onSaved={r => setReadings(prev => [r, ...(prev || [])])}
        />
      )}
      <PageHeader title="Meter Readings" subtitle="Submitted by tenants or logged by agents">
        <button onClick={() => setShowModal(true)}
          className="cursor-pointer bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
          + Log Reading
        </button>
      </PageHeader>

      {/* Type filter tiles */}
      {readings && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {Object.entries(counts).map(([type, count]) => {
            const active = typeFilter === type
            const colors = TYPE_COLORS[type]
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`cursor-pointer text-left rounded-xl border-2 p-4 transition-all duration-150 ${
                  active ? colors.active : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{TYPE_ICONS[type]}</span>
                  <p className={`text-xs uppercase tracking-wide font-semibold ${active ? colors.text : 'text-gray-500'}`}>
                    {type}
                  </p>
                  {active && (
                    <span className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.active} ${colors.text}`}>
                      filtered
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold ${active ? colors.count : 'text-gray-900'}`}>{count}</p>
                <p className="text-xs text-gray-400 mt-0.5">readings submitted</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Search + source filter row */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tenant, property, notes…"
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-72"
        />
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="cursor-pointer border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All sources</option>
          <option value="agent">Agent</option>
          <option value="tenant">Tenant</option>
        </select>
        {(typeFilter !== 'all' || sourceFilter !== 'all' || search) && (
          <button
            onClick={() => { setTypeFilter('all'); setSourceFilter('all'); setSearch('') }}
            className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {(readings || []).length} readings
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {readings === null ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {readings.length === 0 ? 'No meter readings submitted yet.' : 'No readings match your filters.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-6 py-3 cursor-pointer select-none hover:bg-gray-100 transition-colors ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.label}
                    <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{r.tenant_name}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {r.property}
                    {r.unit && r.unit !== '—' && <span className="text-gray-400"> · {r.unit}</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      r.meter_type === 'electricity' ? 'bg-yellow-100 text-yellow-700' :
                      r.meter_type === 'gas' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {TYPE_ICONS[r.meter_type] || ''} {r.meter_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-medium text-gray-900">
                    {Number(r.reading).toLocaleString()} <span className="text-gray-400 font-normal text-xs">{TYPE_UNITS[r.meter_type] || ''}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{fmtDate(r.reading_date)}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{r.notes || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.submitted_by === 'agent' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {r.submitted_by === 'agent' ? 'Agent' : 'Tenant'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
