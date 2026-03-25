import { useEffect, useState } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'

export default function Maintenance() {
  const [requests, setRequests] = useState([])
  const [properties, setProperties] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ unit_id: '', title: '', description: '', priority: 'medium', reported_by: '' })

  useEffect(() => {
    api.get('/maintenance').then(r => setRequests(r.data))
    api.get('/properties').then(r => setProperties(r.data))
  }, [])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name })))
  const unitName = id => { const u = allUnits.find(u => u.id === id); return u ? `${u.propertyName} · ${u.name}` : '—' }

  const save = async e => {
    e.preventDefault()
    await api.post('/maintenance', { ...form, unit_id: parseInt(form.unit_id) })
    api.get('/maintenance').then(r => setRequests(r.data))
    setShowForm(false)
    setForm({ unit_id: '', title: '', description: '', priority: 'medium', reported_by: '' })
  }

  const updateStatus = async (id, status) => {
    const req = requests.find(r => r.id === id)
    await api.put(`/maintenance/${id}`, { ...req, status })
    api.get('/maintenance').then(r => setRequests(r.data))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Maintenance</h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Request
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">New Maintenance Request</h3>
            <form onSubmit={save} className="space-y-4">
              <select value={form.unit_id} onChange={e => setForm({...form,unit_id:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select unit…</option>
                {allUnits.map(u => <option key={u.id} value={u.id}>{u.propertyName} · {u.name}</option>)}
              </select>
              <input placeholder="Title" value={form.title} onChange={e => setForm({...form,title:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form,description:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input placeholder="Reported by" value={form.reported_by} onChange={e => setForm({...form,reported_by:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{r.title}</span>
                <Badge value={r.priority} />
                <Badge value={r.status} />
              </div>
              <p className="text-sm text-gray-500">{unitName(r.unit_id)}</p>
              {r.description && <p className="text-sm text-gray-400 mt-1">{r.description}</p>}
              {r.reported_by && <p className="text-xs text-gray-400 mt-1">Reported by: {r.reported_by}</p>}
            </div>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              {r.status === 'open' && (
                <button onClick={() => updateStatus(r.id, 'in_progress')}
                  className="text-xs border border-amber-300 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                  Start
                </button>
              )}
              {r.status === 'in_progress' && (
                <button onClick={() => updateStatus(r.id, 'completed')}
                  className="text-xs border border-green-300 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50">
                  Complete
                </button>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-gray-400 text-sm">No maintenance requests.</p>}
      </div>
    </div>
  )
}
