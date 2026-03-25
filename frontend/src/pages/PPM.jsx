import { useEffect, useState } from 'react'
import api from '../lib/api'

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'biannual', 'annual']

const freqLabel = f => ({ weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', biannual: 'Every 6 months', annual: 'Annual' }[f] || f)

const empty = {
  property_id: '',
  unit_id: '',
  title: '',
  description: '',
  frequency: 'monthly',
  next_due: '',
  contractor_id: '',
  is_active: true,
}

export default function PPM() {
  const [schedules, setSchedules] = useState([])
  const [properties, setProperties] = useState([])
  const [units, setUnits] = useState([])
  const [contractors, setContractors] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // schedule id
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.get('/ppm').then(r => setSchedules(r.data))

  useEffect(() => {
    load()
    api.get('/properties').then(r => setProperties(r.data)).catch(() => {})
    api.get('/contractors').then(r => setContractors(r.data)).catch(() => {})
  }, [])

  // Derive units from selected property (properties already have units nested)
  useEffect(() => {
    if (form.property_id) {
      const prop = properties.find(p => String(p.id) === String(form.property_id))
      setUnits(prop?.units || [])
    } else {
      setUnits([])
    }
  }, [form.property_id, properties])

  function openNew() {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowForm(true)
  }

  function openEdit(s) {
    setEditing(s.id)
    setForm({
      property_id: s.property_id,
      unit_id: s.unit_id || '',
      title: s.title,
      description: s.description || '',
      frequency: s.frequency,
      next_due: s.next_due,
      contractor_id: s.contractor_id || '',
      is_active: s.is_active,
    })
    setError('')
    setShowForm(true)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      property_id: Number(form.property_id),
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      contractor_id: form.contractor_id ? Number(form.contractor_id) : null,
    }
    try {
      if (editing) {
        await api.put(`/ppm/${editing}`, payload)
      } else {
        await api.post('/ppm', payload)
      }
      await load()
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function del(id) {
    if (!confirm('Delete this PPM schedule?')) return
    await api.delete(`/ppm/${id}`)
    await load()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planned Maintenance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Recurring tasks that auto-create maintenance jobs when due.</p>
        </div>
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Schedule
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Task', 'Property / Unit', 'Frequency', 'Next Due', 'Last Triggered', 'Contractor', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.length === 0 && (
              <tr>
                <td colSpan="8" className="px-5 py-10 text-center text-gray-400">
                  No PPM schedules yet. Add one to start automating recurring maintenance.
                </td>
              </tr>
            )}
            {schedules.map(s => {
              const overdue = s.is_active && s.next_due < today
              const dueSoon = s.is_active && !overdue && s.next_due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{s.title}</p>
                    {s.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {s.property_name}
                    {s.unit_name && <span className="text-gray-400"> · {s.unit_name}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{freqLabel(s.frequency)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-gray-700'}`}>
                      {s.next_due}
                    </span>
                    {overdue && <span className="ml-1 text-xs text-red-500">overdue</span>}
                    {dueSoon && !overdue && <span className="ml-1 text-xs text-amber-500">soon</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">{s.last_triggered || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{s.contractor_name || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(s)} className="text-xs text-indigo-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => del(s.id)} className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">{editing ? 'Edit PPM Schedule' : 'New PPM Schedule'}</h3>
            <form onSubmit={save} className="space-y-4">
              <input
                placeholder="Task title (e.g. Boiler service, Gutter cleaning)"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Description (optional)"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value, unit_id: '' })} required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {units.length > 0 && (
                <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">All units (property-wide)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {FREQUENCIES.map(f => <option key={f} value={f}>{freqLabel(f)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First due date</label>
                  <input type="date" value={form.next_due} onChange={e => setForm({ ...form, next_due: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <select value={form.contractor_id} onChange={e => setForm({ ...form, contractor_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">No contractor assigned</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded" />
                Active (will auto-trigger maintenance jobs)
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
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
