import { useState, useEffect } from 'react'
import api from '../lib/api'

const TYPE_LABELS = {
  routine: 'Routine',
  check_in: 'Check-In',
  check_out: 'Check-Out',
  inventory: 'Inventory',
}

const TYPE_COLORS = {
  routine: 'bg-blue-100 text-blue-700',
  check_in: 'bg-green-100 text-green-700',
  check_out: 'bg-red-100 text-red-700',
  inventory: 'bg-purple-100 text-purple-700',
}

const STATUS_COLORS = {
  scheduled: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const CONDITION_COLORS = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-yellow-100 text-yellow-700',
  poor: 'bg-red-100 text-red-700',
}

const DEFAULT_ROOMS = [
  'Entrance Hall', 'Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2',
  'Bathroom', 'WC', 'Garden / Outdoor Area', 'Garage / Storage',
]

const CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor']
const CLEANLINESS_OPTIONS = ['clean', 'satisfactory', 'dirty']

export default function Inspections() {
  const [inspections, setInspections] = useState([])
  const [units, setUnits] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null) // inspection being edited/viewed
  const [showComplete, setShowComplete] = useState(null) // inspection being completed

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [inspRes, propRes] = await Promise.all([
        api.get('/inspections'),
        api.get('/properties'),
      ])
      setInspections(inspRes.data)
      // flatten units from properties
      const allUnits = []
      for (const prop of propRes.data) {
        const unitRes = await api.get(`/properties/${prop.id}/units`)
        for (const u of unitRes.data) {
          allUnits.push({ ...u, property_name: prop.name })
        }
      }
      setUnits(allUnits)
    } finally {
      setLoading(false)
    }
  }

  const upcoming = inspections.filter(i => i.status === 'scheduled')
  const completed = inspections.filter(i => i.status === 'completed')
  const cancelled = inspections.filter(i => i.status === 'cancelled')
  const displayed = tab === 'upcoming' ? upcoming : tab === 'completed' ? completed : cancelled

  async function handleCancel(id) {
    await api.put(`/inspections/${id}`, { status: 'cancelled' })
    load()
  }

  async function downloadReport(id, date) {
    const res = await api.get(`/inspections/${id}/report`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspection-${id}-${date}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and record property inspections</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + Schedule Inspection
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Upcoming</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{upcoming.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completed.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">This month</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">
            {inspections.filter(i => {
              if (!i.scheduled_date) return false
              const d = new Date(i.scheduled_date)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No {tab} inspections.
            {tab === 'upcoming' && (
              <button onClick={() => setShowCreate(true)} className="ml-2 text-indigo-600 font-medium hover:underline">
                Schedule one
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Property / Unit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Inspector</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.property}</p>
                    <p className="text-xs text-gray-500">{i.unit}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[i.type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[i.type] || i.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {i.scheduled_date ? new Date(i.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.inspector_name || '—'}</td>
                  <td className="px-4 py-3">
                    {i.overall_condition ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONDITION_COLORS[i.overall_condition] || 'bg-gray-100'}`}>
                        {i.overall_condition.charAt(0).toUpperCase() + i.overall_condition.slice(1)}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[i.status] || 'bg-gray-100'}`}>
                      {i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {i.status === 'scheduled' && (
                        <button
                          onClick={() => setShowComplete(i)}
                          className="text-xs text-indigo-600 font-medium hover:underline"
                        >
                          Complete
                        </button>
                      )}
                      {i.status === 'completed' && (
                        <button
                          onClick={() => downloadReport(i.id, i.scheduled_date)}
                          className="text-xs text-indigo-600 font-medium hover:underline"
                        >
                          PDF
                        </button>
                      )}
                      {i.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancel(i.id)}
                          className="text-xs text-red-500 font-medium hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateModal
          units={units}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}

      {showComplete && (
        <CompleteModal
          inspection={showComplete}
          onClose={() => setShowComplete(null)}
          onSaved={() => { setShowComplete(null); load() }}
        />
      )}
    </div>
  )
}

function CreateModal({ units, onClose, onSaved }) {
  const [form, setForm] = useState({
    unit_id: '',
    type: 'routine',
    scheduled_date: '',
    inspector_name: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.unit_id || !form.scheduled_date) { setError('Please select a unit and date.'); return }
    setSaving(true)
    try {
      await api.post('/inspections', { ...form, unit_id: parseInt(form.unit_id) })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to schedule inspection')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Schedule Inspection</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Unit</label>
            <select
              value={form.unit_id}
              onChange={e => setForm({ ...form, unit_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Select unit...</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.property_name} · {u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={form.scheduled_date}
              onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Inspector Name</label>
            <input
              type="text"
              value={form.inspector_name}
              onChange={e => setForm({ ...form, inspector_name: e.target.value })}
              placeholder="e.g. John Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any notes for this inspection..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CompleteModal({ inspection, onClose, onSaved }) {
  const [form, setForm] = useState({
    completed_date: new Date().toISOString().split('T')[0],
    overall_condition: 'good',
    inspector_name: inspection.inspector_name || '',
    notes: inspection.notes || '',
  })
  const [rooms, setRooms] = useState(
    inspection.rooms.length > 0
      ? inspection.rooms
      : DEFAULT_ROOMS.map(name => ({ room_name: name, condition: 'good', cleanliness: 'clean', notes: '' }))
  )
  const [saving, setSaving] = useState(false)

  function updateRoom(idx, field, value) {
    setRooms(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addRoom() {
    setRooms(prev => [...prev, { room_name: '', condition: 'good', cleanliness: 'clean', notes: '' }])
  }

  function removeRoom(idx) {
    setRooms(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/inspections/${inspection.id}`, {
        ...form,
        status: 'completed',
        rooms: rooms.filter(r => r.room_name.trim()),
      })
      onSaved()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Complete Inspection</h2>
            <p className="text-sm text-gray-500">{inspection.property} · {inspection.unit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date Completed</label>
              <input
                type="date"
                value={form.completed_date}
                onChange={e => setForm({ ...form, completed_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Overall Condition</label>
              <select
                value={form.overall_condition}
                onChange={e => setForm({ ...form, overall_condition: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CONDITION_OPTIONS.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Inspector</label>
              <input
                type="text"
                value={form.inspector_name}
                onChange={e => setForm({ ...form, inspector_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Overall comments..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Room checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Room Checklist</h3>
              <button type="button" onClick={addRoom} className="text-xs text-indigo-600 font-medium hover:underline">
                + Add room
              </button>
            </div>
            <div className="space-y-2">
              {rooms.map((room, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 grid grid-cols-12 gap-2 items-start">
                  <input
                    type="text"
                    value={room.room_name}
                    onChange={e => updateRoom(idx, 'room_name', e.target.value)}
                    placeholder="Room name"
                    className="col-span-3 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={room.condition || 'good'}
                    onChange={e => updateRoom(idx, 'condition', e.target.value)}
                    className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CONDITION_OPTIONS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <select
                    value={room.cleanliness || 'clean'}
                    onChange={e => updateRoom(idx, 'cleanliness', e.target.value)}
                    className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CLEANLINESS_OPTIONS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={room.notes || ''}
                    onChange={e => updateRoom(idx, 'notes', e.target.value)}
                    placeholder="Notes..."
                    className="col-span-4 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeRoom(idx)}
                    className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none mt-1"
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Mark Complete & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
