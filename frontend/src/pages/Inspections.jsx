import { PageHeader } from '../components/Illustration'
import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [mediaModal, setMediaModal] = useState(null) // { inspection, files }
  const [photoUploading, setPhotoUploading] = useState(false)
  const [editModal, setEditModal] = useState(null) // inspection to edit
  const [compareModal, setCompareModal] = useState(null) // { unit_id, unit_name }
  const [sortCol, setSortCol] = useState('scheduled_date')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [inspRes, propRes] = await Promise.all([
        api.get('/inspections'),
        api.get('/properties'),
      ])
      setInspections(inspRes.data)
      const allUnits = propRes.data.flatMap(p =>
        (p.units || []).map(u => ({ ...u, property_name: p.name }))
      )
      setUnits(allUnits)
    } finally {
      setLoading(false)
    }
  }

  const upcoming = inspections.filter(i => i.status === 'scheduled')
  const completed = inspections.filter(i => i.status === 'completed')
  const cancelled = inspections.filter(i => i.status === 'cancelled')
  const base = tab === 'upcoming' ? upcoming : tab === 'completed' ? completed : cancelled
  const displayed = [...base].sort((a, b) => {
    let av, bv
    if      (sortCol === 'property')   { av = a.property || '';          bv = b.property || '' }
    else if (sortCol === 'type')       { av = a.type || '';              bv = b.type || '' }
    else if (sortCol === 'inspector')  { av = a.inspector_name || '';    bv = b.inspector_name || '' }
    else if (sortCol === 'condition')  { av = a.overall_condition || ''; bv = b.overall_condition || '' }
    else                               { av = a[sortCol] || '';          bv = b[sortCol] || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  async function handleCancel(id) {
    await api.put(`/inspections/${id}`, { status: 'cancelled' })
    load()
  }

  async function openMediaModal(inspection) {
    const r = await api.get('/uploads', { params: { entity_type: 'inspection', entity_id: inspection.id } })
    setMediaModal({ inspection, files: r.data })
  }

  async function handlePhotoUpload(inspectionId, file, roomTag) {
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('entity_type', 'inspection')
      fd.append('entity_id', inspectionId)
      fd.append('category', 'photo')
      fd.append('description', roomTag || 'overall')
      fd.append('file', file)
      await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const r = await api.get('/uploads', { params: { entity_type: 'inspection', entity_id: inspectionId } })
      setMediaModal(prev => prev ? { ...prev, files: r.data } : null)
    } finally {
      setPhotoUploading(false)
    }
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
      <PageHeader title="Inspections" subtitle="Schedule and record property inspections">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + Schedule Inspection
        </button>
      </PageHeader>

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
                <SortTh col="property" label="Property / Unit" />
                <SortTh col="type" label="Type" />
                <SortTh col="scheduled_date" label="Date" />
                <SortTh col="inspector" label="Inspector" />
                <SortTh col="condition" label="Condition" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
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
                        <>
                          <button onClick={() => setEditModal(i)} className="text-xs text-gray-500 font-medium hover:underline">Edit</button>
                          <button onClick={() => setShowComplete(i)} className="text-xs text-indigo-600 font-medium hover:underline">Complete</button>
                        </>
                      )}
                      {i.status === 'scheduled' && (
                        <button
                          onClick={() => openMediaModal(i)}
                          className="text-xs text-gray-500 font-medium hover:underline"
                        >Photos</button>
                      )}
                      {i.status === 'completed' && (
                        <>
                          <button
                            onClick={() => downloadReport(i.id, i.scheduled_date)}
                            className="text-xs text-indigo-600 font-medium hover:underline"
                          >PDF</button>
                          <button
                            onClick={() => openMediaModal(i)}
                            className="text-xs text-indigo-600 font-medium hover:underline"
                          >Photos</button>
                          {(i.type === 'check_in' || i.type === 'check_out') && (
                            <button
                              onClick={() => setCompareModal({ unit_id: i.unit_id, unit_name: `${i.property} · ${i.unit}` })}
                              className="text-xs text-purple-600 font-medium hover:underline"
                            >Compare</button>
                          )}
                        </>
                      )}
                      {i.status === 'scheduled' && (
                        <button onClick={() => handleCancel(i.id)} className="text-xs text-red-500 font-medium hover:underline">Cancel</button>
                      )}
                      {i.status === 'cancelled' && (
                        <button onClick={() => setEditModal(i)} className="text-xs text-indigo-600 font-medium hover:underline">Reschedule</button>
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

      {editModal && (
        <EditModal
          inspection={editModal}
          units={units}
          onClose={() => setEditModal(null)}
          onSaved={() => {
            setEditModal(null)
            if (editModal.status === 'cancelled') setTab('upcoming')
            load()
          }}
        />
      )}

      {showComplete && (
        <CompleteModal
          inspection={showComplete}
          onClose={() => setShowComplete(null)}
          onSaved={() => { setShowComplete(null); load() }}
        />
      )}

      {compareModal && (
        <CompareModal
          unitId={compareModal.unit_id}
          unitName={compareModal.unit_name}
          onClose={() => setCompareModal(null)}
        />
      )}

      {mediaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Inspection Media</h2>
                <p className="text-sm text-gray-500">{mediaModal.inspection.property} · {mediaModal.inspection.unit}</p>
              </div>
              <button onClick={() => setMediaModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
              <label className={`flex items-center gap-2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors ${photoUploading ? 'opacity-60' : ''}`}>
                {photoUploading ? 'Uploading…' : '+ Add Photo'}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  disabled={photoUploading}
                  onChange={e => e.target.files[0] && handlePhotoUpload(mediaModal.inspection.id, e.target.files[0], null)}
                />
              </label>
              <span className="text-xs text-gray-400">{mediaModal.files.length} file{mediaModal.files.length !== 1 ? 's' : ''} attached</span>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {mediaModal.files.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No photos uploaded yet. Use the button below to attach photos.</p>
              ) : (() => {
                const groups = {}
                mediaModal.files.forEach(f => {
                  const tag = f.description || 'overall'
                  if (!groups[tag]) groups[tag] = []
                  groups[tag].push(f)
                })
                return Object.entries(groups).map(([tag, files]) => (
                  <div key={tag} className="mb-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      {tag === 'overall' ? 'Overall' : tag.replace('room:', '')}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {files.map(f => (
                        <div key={f.id}>
                          {f.mime_type?.startsWith('image/') ? (
                            <a href={f.url} target="_blank" rel="noreferrer">
                              <img src={f.url} alt={f.original_name} className="w-28 h-28 object-cover rounded-xl border border-gray-200 hover:opacity-90 transition-opacity" />
                            </a>
                          ) : f.mime_type?.startsWith('video/') ? (
                            <video src={f.url} controls className="w-48 h-28 rounded-xl border border-gray-200 object-cover" />
                          ) : (
                            <a href={`/api/uploads/${f.id}/download`} className="flex items-center gap-2 text-xs text-indigo-600 hover:underline">
                              📄 {f.original_name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
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

function MediaUploader({ inspectionId, tag, label }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    api.get('/uploads', { params: { entity_type: 'inspection', entity_id: inspectionId } })
      .then(r => setFiles(r.data.filter(f => (f.description || '') === tag)))
      .catch(() => {})
  }, [inspectionId, tag])

  async function upload(fileList) {
    setUploading(true)
    for (const file of Array.from(fileList)) {
      const fd = new FormData()
      fd.append('entity_type', 'inspection')
      fd.append('entity_id', inspectionId)
      fd.append('category', file.type.startsWith('video/') ? 'other' : 'photo')
      fd.append('description', tag)
      fd.append('file', file)
      try {
        const r = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setFiles(prev => [r.data, ...prev])
      } catch (e) {
        console.error('Upload failed', e)
      }
    }
    setUploading(false)
  }

  async function remove(id) {
    await api.delete(`/uploads/${id}`)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false)
    upload(e.dataTransfer.files)
  }, [])

  return (
    <div className="mt-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            <div key={f.id} className="relative group">
              {f.mime_type?.startsWith('image/') ? (
                <a href={f.url} target="_blank" rel="noreferrer">
                  <img src={f.url} alt={f.original_name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                </a>
              ) : f.mime_type?.startsWith('video/') ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg border border-gray-200">
                  <span className="text-2xl">🎬</span>
                </a>
              ) : (
                <a href={`/api/uploads/${f.id}/download`} className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-500 p-1 text-center">{f.original_name}</a>
              )}
              <button onClick={() => remove(f.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none items-center justify-center hidden group-hover:flex">×</button>
            </div>
          ))}
        </div>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-3 py-2 text-xs text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
      >
        {uploading ? '⏳ Uploading…' : `📷 ${label} — drop or click to upload photos/videos`}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={e => upload(e.target.files)} />
    </div>
  )
}

function EditModal({ inspection, units, onClose, onSaved }) {
  const [form, setForm] = useState({
    unit_id: String(inspection.unit_id || ''),
    type: inspection.type || 'routine',
    scheduled_date: inspection.scheduled_date?.slice(0, 10) || '',
    inspector_name: inspection.inspector_name || '',
    notes: inspection.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const extra = inspection.status === 'cancelled' ? { status: 'scheduled' } : {}
      await api.put(`/inspections/${inspection.id}`, { ...form, unit_id: parseInt(form.unit_id), ...extra })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{inspection.status === 'cancelled' ? 'Reschedule Inspection' : 'Edit Inspection'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Unit</label>
            <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select unit...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.property_name} · {u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Date</label>
            <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Inspector Name</label>
            <input type="text" value={form.inspector_name} onChange={e => setForm({ ...form, inspector_name: e.target.value })}
              placeholder="e.g. John Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
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
  const [expandedMedia, setExpandedMedia] = useState({})

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

          {/* Overall media */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Overall Photos / Videos</h3>
            <MediaUploader inspectionId={inspection.id} tag="overall" label="Add overall photos/videos" />
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
                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
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
                    <div className="col-span-1 flex flex-col gap-1 items-center mt-0.5">
                      <button
                        type="button"
                        onClick={() => setExpandedMedia(m => ({ ...m, [idx]: !m[idx] }))}
                        className="text-indigo-400 hover:text-indigo-600 text-sm"
                        title="Add photos/videos"
                      >📷</button>
                      <button
                        type="button"
                        onClick={() => removeRoom(idx)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >×</button>
                    </div>
                  </div>
                  {expandedMedia[idx] && room.room_name && (
                    <MediaUploader
                      inspectionId={inspection.id}
                      tag={`room:${room.room_name}`}
                      label={room.room_name}
                    />
                  )}
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


function CompareModal({ unitId, unitName, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/inspections/compare', { params: { unit_id: unitId } })
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load comparison'))
      .finally(() => setLoading(false))
  }, [unitId])

  const condColor = c => ({ excellent: 'text-green-700 bg-green-100', good: 'text-blue-700 bg-blue-100', fair: 'text-amber-700 bg-amber-100', poor: 'text-red-700 bg-red-100' }[c] || 'text-gray-600 bg-gray-100')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Check-In vs Check-Out Comparison</h2>
            <p className="text-sm text-gray-500 mt-0.5">{unitName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading && <p className="text-center text-gray-400 py-10">Loading comparison…</p>}
          {error && <p className="text-center text-red-500 py-10">{error}</p>}
          {data && !loading && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div />
                <div className={`rounded-xl border p-4 text-center ${data.checkin ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Check-In</p>
                  {data.checkin ? (
                    <>
                      <p className="text-sm font-semibold text-gray-800">{data.checkin.completed_date || data.checkin.scheduled_date}</p>
                      {data.checkin.overall_condition && (
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${condColor(data.checkin.overall_condition)}`}>
                          {data.checkin.overall_condition}
                        </span>
                      )}
                    </>
                  ) : <p className="text-sm text-gray-400 italic">None recorded</p>}
                </div>
                <div className={`rounded-xl border p-4 text-center ${data.checkout ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Check-Out</p>
                  {data.checkout ? (
                    <>
                      <p className="text-sm font-semibold text-gray-800">{data.checkout.completed_date || data.checkout.scheduled_date}</p>
                      {data.checkout.overall_condition && (
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${condColor(data.checkout.overall_condition)}`}>
                          {data.checkout.overall_condition}
                        </span>
                      )}
                    </>
                  ) : <p className="text-sm text-gray-400 italic">None recorded</p>}
                </div>
              </div>

              {data.rooms.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">No room data recorded for either inspection.</p>
              ) : (
                <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Room</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-green-600 uppercase">Check-In</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-red-500 uppercase">Check-Out</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rooms.map(r => {
                      const inCond = r.checkin?.condition
                      const outCond = r.checkout?.condition
                      const ORDER = { excellent: 0, good: 1, fair: 2, poor: 3 }
                      const degraded = inCond && outCond && ORDER[outCond] > ORDER[inCond]
                      return (
                        <tr key={r.room_name} className={degraded ? 'bg-red-50/40' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.room_name}</td>
                          <td className="px-4 py-3">
                            {r.checkin ? (
                              <div>
                                {r.checkin.condition && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${condColor(r.checkin.condition)}`}>{r.checkin.condition}</span>}
                                {r.checkin.cleanliness && <span className="ml-1 text-xs text-gray-500">{r.checkin.cleanliness}</span>}
                                {r.checkin.notes && <p className="text-xs text-gray-400 mt-0.5">{r.checkin.notes}</p>}
                              </div>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.checkout ? (
                              <div>
                                {r.checkout.condition && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${condColor(r.checkout.condition)}`}>{r.checkout.condition}</span>}
                                {r.checkout.cleanliness && <span className="ml-1 text-xs text-gray-500">{r.checkout.cleanliness}</span>}
                                {r.checkout.notes && <p className="text-xs text-gray-400 mt-0.5">{r.checkout.notes}</p>}
                              </div>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {degraded ? (
                              <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Degraded</span>
                            ) : inCond && outCond && ORDER[outCond] < ORDER[inCond] ? (
                              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Improved</span>
                            ) : inCond && outCond ? (
                              <span className="text-xs text-gray-400">Unchanged</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  )
}

