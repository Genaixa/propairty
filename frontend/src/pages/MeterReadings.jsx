import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const TYPE_ICONS = { electricity: '⚡', gas: '🔥', water: '💧' }
const TYPE_UNITS = { electricity: 'kWh', gas: 'm³', water: 'm³' }

function fmtDate(d) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function LogReadingModal({ tenants, onClose, onSaved }) {
  const [form, setForm] = useState({
    tenant_id: '',
    meter_type: 'electricity',
    reading: '',
    reading_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!form.tenant_id || !form.reading) { setErr('Tenant and reading are required'); return }
    setSaving(true)
    setErr('')
    try {
      const r = await api.post('/tenants/meter-readings', {
        ...form,
        tenant_id: Number(form.tenant_id),
        reading: Number(form.reading),
      })
      onSaved(r.data)
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Log Meter Reading</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tenant</label>
            <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Select tenant…</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meter type</label>
              <select value={form.meter_type} onChange={e => setForm(f => ({ ...f, meter_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
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
            <button type="button" onClick={onClose} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Save Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MeterReadings() {
  const [readings, setReadings] = useState(null)
  const [tenants, setTenants] = useState([])
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    api.get('/tenants/meter-readings').then(r => setReadings(r.data)).catch(() => setReadings([]))
    api.get('/tenants').then(r => setTenants(r.data)).catch(() => {})
  }, [])

  const filtered = (readings || []).filter(r => {
    if (typeFilter !== 'all' && r.meter_type !== typeFilter) return false
    if (filter) {
      const q = filter.toLowerCase()
      return (
        r.tenant_name?.toLowerCase().includes(q) ||
        r.property?.toLowerCase().includes(q) ||
        r.unit?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = { electricity: 0, gas: 0, water: 0 }
  ;(readings || []).forEach(r => { if (counts[r.meter_type] !== undefined) counts[r.meter_type]++ })

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
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
          + Log Reading
        </button>
      </PageHeader>

      {/* Summary cards */}
      {readings && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Object.entries(counts).map(([type, count]) => (
            <div key={type} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{TYPE_ICONS[type]}</span>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{type}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400">readings submitted</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by tenant, property, or unit…"
          className="w-full max-w-sm border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {readings === null ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {readings.length === 0 ? 'No meter readings submitted yet.' : 'No readings match your filter.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Tenant</th>
                <th className="px-6 py-3 text-left">Property / Unit</th>
                <th className="px-6 py-3 text-center">Type</th>
                <th className="px-6 py-3 text-right">Reading</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Notes</th>
                <th className="px-6 py-3 text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{r.tenant_name}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {r.property}
                    {r.unit && r.unit !== '—' && <span className="text-gray-400"> · {r.unit}</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {TYPE_ICONS[r.meter_type] || '📊'} {r.meter_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-medium text-gray-900">
                    {r.reading.toLocaleString()} <span className="text-gray-400 font-normal text-xs">{TYPE_UNITS[r.meter_type] || ''}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{fmtDate(r.reading_date)}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{r.notes || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.submitted_by === 'agent' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
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
