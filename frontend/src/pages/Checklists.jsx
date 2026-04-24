import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const TYPE_LABELS = {
  pre_showing: 'Pre-Showing',
  pre_move_in: 'Pre-Move-In',
  inspection: 'Inspection',
  custom: 'Custom',
}

const TYPE_COLOURS = {
  pre_showing: 'bg-blue-100 text-blue-700',
  pre_move_in: 'bg-green-100 text-green-700',
  inspection: 'bg-amber-100 text-amber-700',
  custom: 'bg-gray-100 text-gray-600',
}

function ProgressBar({ progress }) {
  const [done, total] = progress.split('/').map(Number)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const colour = pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-indigo-500' : 'bg-gray-200'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{progress}</span>
    </div>
  )
}

function CreateModal({ properties, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('pre_showing')
  const [propertyId, setPropertyId] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const r = await api.post('/checklists', {
        name: name.trim(),
        checklist_type: type,
        property_id: propertyId ? Number(propertyId) : null,
      })
      onCreate(r.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Checklist</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. 14 Park Street — pre-showing"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Default items will be pre-filled for standard types.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-gray-400">(optional)</span></label>
            <select
              value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Not linked to a property —</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddItemInput({ onAdd }) {
  const [label, setLabel] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!label.trim()) return
    onAdd(label.trim())
    setLabel('')
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-3">
      <input
        value={label} onChange={e => setLabel(e.target.value)}
        placeholder="Add a custom item…"
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button type="submit"
        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
        Add
      </button>
    </form>
  )
}

function ChecklistDetail({ checklist: initial, onClose, onDeleted }) {
  const [checklist, setChecklist] = useState(initial)
  const [deleting, setDeleting] = useState(false)

  async function toggleItem(item) {
    const r = await api.patch(`/checklists/${checklist.id}/items/${item.id}`, {
      checked: !item.checked,
      checked_by: null,
    })
    setChecklist(c => ({
      ...c,
      items: c.items.map(i => i.id === item.id ? r.data : i),
      progress: (() => {
        const updated = c.items.map(i => i.id === item.id ? r.data : i)
        return `${updated.filter(i => i.checked).length}/${updated.length}`
      })(),
    }))
  }

  async function addItem(label) {
    const r = await api.post(`/checklists/${checklist.id}/items`, { label })
    setChecklist(c => {
      const items = [...c.items, r.data]
      return { ...c, items, progress: `${items.filter(i => i.checked).length}/${items.length}` }
    })
  }

  async function removeItem(itemId) {
    await api.delete(`/checklists/${checklist.id}/items/${itemId}`)
    setChecklist(c => {
      const items = c.items.filter(i => i.id !== itemId)
      return { ...c, items, progress: `${items.filter(i => i.checked).length}/${items.length}` }
    })
  }

  async function deleteChecklist() {
    if (!window.confirm('Delete this checklist?')) return
    setDeleting(true)
    await api.delete(`/checklists/${checklist.id}`)
    onDeleted(checklist.id)
  }

  const [done, total] = checklist.progress.split('/').map(Number)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = pct === 100 && total > 0

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[checklist.checklist_type]}`}>
                {TYPE_LABELS[checklist.checklist_type]}
              </span>
              {checklist.property_name && (
                <span className="text-xs text-gray-400 truncate">📍 {checklist.property_name}</span>
              )}
            </div>
            <h2 className="font-semibold text-gray-900 truncate">{checklist.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">×</button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">{done} of {total} complete</span>
            <span className={`text-xs font-semibold ${allDone ? 'text-green-600' : 'text-indigo-600'}`}>
              {allDone ? '✓ All done' : `${pct}%`}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <ul className="space-y-2">
            {checklist.items.map(item => (
              <li key={item.id} className="flex items-center gap-3 group">
                <button
                  onClick={() => toggleItem(item)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.checked
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {item.checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {item.label}
                </span>
                {item.checked_at && (
                  <span className="text-xs text-gray-300 shrink-0">
                    {new Date(item.checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-200 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Remove item"
                >✕</button>
              </li>
            ))}
          </ul>

          <AddItemInput onAdd={addItem} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center shrink-0">
          <button
            onClick={deleteChecklist}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete checklist'}
          </button>
          <button onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Checklists() {
  const [checklists, setChecklists] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/checklists'),
      api.get('/properties'),
    ]).then(([cl, pr]) => {
      setChecklists(cl.data)
      setProperties(pr.data)
    }).finally(() => setLoading(false))
  }, [])

  const visible = checklists.filter(c => {
    if (typeFilter !== 'all' && c.checklist_type !== typeFilter) return false
    if (propertyFilter && c.property_id !== Number(propertyFilter)) return false
    return true
  })

  function handleCreated(c) {
    setChecklists(prev => [c, ...prev])
    setCreating(false)
    setSelected(c)
  }

  function handleDeleted(id) {
    setChecklists(prev => prev.filter(c => c.id !== id))
    setSelected(null)
  }

  const counts = {
    all: checklists.length,
    pre_showing: checklists.filter(c => c.checklist_type === 'pre_showing').length,
    pre_move_in: checklists.filter(c => c.checklist_type === 'pre_move_in').length,
    inspection: checklists.filter(c => c.checklist_type === 'inspection').length,
    custom: checklists.filter(c => c.checklist_type === 'custom').length,
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading checklists…</div>

  return (
    <div>
      <PageHeader title="Checklists" subtitle="Pre-showing, move-in, inspection and custom checklists">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + New Checklist
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'pre_showing', label: 'Pre-Showing' },
            { key: 'pre_move_in', label: 'Pre-Move-In' },
            { key: 'inspection', label: 'Inspection' },
            { key: 'custom', label: 'Custom' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">({counts[t.key]})</span>
              )}
            </button>
          ))}
        </div>

        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">☑️</div>
          <p className="text-gray-500 text-sm mb-4">
            {checklists.length === 0
              ? 'No checklists yet. Create your first one to get started.'
              : 'No checklists match this filter.'}
          </p>
          {checklists.length === 0 && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Create first checklist
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {visible.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map(c => {
            const [done, total] = c.progress.split('/').map(Number)
            const allDone = total > 0 && done === total
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[c.checklist_type]}`}>
                    {TYPE_LABELS[c.checklist_type]}
                  </span>
                  {allDone && (
                    <span className="text-xs font-semibold text-green-600">✓ Complete</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1 truncate">{c.name}</p>
                {c.property_name && (
                  <p className="text-xs text-gray-400 mb-3 truncate">📍 {c.property_name}</p>
                )}
                <ProgressBar progress={c.progress} />
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {creating && (
        <CreateModal
          properties={properties}
          onClose={() => setCreating(false)}
          onCreate={handleCreated}
        />
      )}

      {selected && (
        <ChecklistDetail
          checklist={selected}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
