import { useState, useEffect } from 'react'
import api from '../lib/api'

// Templates offered for creation
const TYPES = [
  { key: 'pre_showing', label: 'Pre-Showing', color: 'blue'    },
  { key: 'pre_move_in', label: 'Pre-Move-In', color: 'emerald' },
  { key: 'custom',      label: 'Custom',       color: 'slate'   },
]

// All possible types for filtering/display (includes inspection for legacy records)
const ALL_TYPES = [
  { key: 'pre_showing', label: 'Pre-Showing', color: 'blue'    },
  { key: 'pre_move_in', label: 'Pre-Move-In', color: 'emerald' },
  { key: 'inspection',  label: 'Inspection',  color: 'amber'   },
  { key: 'custom',      label: 'Custom',       color: 'slate'   },
]

const TYPE_STYLE = {
  blue:    { pill: 'bg-blue-100 text-blue-700',       border: 'border-l-blue-400',    active: 'bg-blue-600 text-white' },
  emerald: { pill: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-400', active: 'bg-emerald-600 text-white' },
  amber:   { pill: 'bg-amber-100 text-amber-700',     border: 'border-l-amber-400',   active: 'bg-amber-500 text-white' },
  slate:   { pill: 'bg-gray-100 text-gray-600',       border: 'border-l-gray-300',    active: 'bg-slate-600 text-white' },
}

function typeStyle(key) {
  return TYPE_STYLE[ALL_TYPES.find(t => t.key === key)?.color || 'slate']
}

function ProgressRing({ done, total }) {
  const pct = total > 0 ? done / total : 0
  const r = 14, circ = 2 * Math.PI * r
  const allDone = total > 0 && done === total
  const color = allDone ? '#10b981' : pct > 0 ? '#6366f1' : '#e5e7eb'
  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg viewBox="0 0 32 32" className="w-9 h-9 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.4s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-600">
        {allDone ? '✓' : total > 0 ? `${Math.round(pct * 100)}%` : '—'}
      </span>
    </div>
  )
}

// ── Use Template Modal ─────────────────────────────────────────────────────────
function UseModal({ template, onClose, onCreated }) {
  const [personId, setPersonId] = useState('')
  const [people, setPeople] = useState([])
  const [saving, setSaving] = useState(false)

  const isPreMoveIn = template.checklist_type === 'pre_move_in'
  const personLabel = isPreMoveIn ? 'Tenant' : 'Applicant'

  useEffect(() => {
    const endpoint = isPreMoveIn ? '/tenants/for-picker' : '/applicants'
    api.get(endpoint).then(r => setPeople(r.data)).catch(() => {})
  }, [isPreMoveIn])

  // both endpoints now return .property_name, .unit_name, .property_id
  function getProp(p)  { return p.property_name }
  function getUnit(p)  { return p.unit_name }
  function getPropId(p){ return p.property_id }

  const sel = people.find(p => String(p.id) === personId)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api.post(`/checklists/${template.id}/use`, {
        property_id: sel ? getPropId(sel) : null,
        unit_name:   sel ? getUnit(sel)   : null,
        tenant_name: sel ? sel.full_name  : null,
      })
      onCreated(r.data)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Use template</p>
            <h2 className="font-semibold text-gray-900">{template.name}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">{personLabel} <span className="text-gray-300">(optional)</span></label>
            <select value={personId} onChange={e => setPersonId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">No {personLabel.toLowerCase()}</option>
              {people.map(p => {
                const prop = getProp(p), unit = getUnit(p)
                return (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{prop ? ` — ${prop}${unit ? ` · ${unit}` : ''}` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {sel && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500 space-y-1">
              {getProp(sel) && (
                <p><span className="text-gray-300 mr-1">Property</span>{getProp(sel)}{getUnit(sel) ? ` · ${getUnit(sel)}` : ''}</p>
              )}
              <p><span className="text-gray-300 mr-1">{personLabel}</span>{sel.full_name}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
              {saving ? 'Creating…' : 'Create checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Instance Modal ─────────────────────────────────────────────────────────
function EditInstanceModal({ checklist, properties, onClose, onSaved }) {
  const [name, setName] = useState(checklist.name)
  const [propertyId, setPropertyId] = useState(checklist.property_id ? String(checklist.property_id) : '')
  const [unitName, setUnitName] = useState(checklist.unit_name || '')
  const [tenantName, setTenantName] = useState(checklist.tenant_name || '')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api.put(`/checklists/${checklist.id}`, {
        name: name.trim(),
        property_id: propertyId ? Number(propertyId) : null,
        unit_name: unitName.trim() || null,
        tenant_name: tenantName.trim() || null,
      })
      onSaved(r.data)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Edit Checklist</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Property</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Not linked to a property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Unit</label>
            <input value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="e.g. Flat 3"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Tenant name</label>
            <input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="e.g. Sarah Jones"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Template Editor (items only) ───────────────────────────────────────────────
function TemplateEditor({ template: initial, onClose, onUpdated }) {
  const [template, setTemplate] = useState(initial)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [newLabel, setNewLabel] = useState('')

  async function startEdit(item) {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  async function saveRename(item) {
    if (!editLabel.trim() || editLabel === item.label) { setEditingId(null); return }
    const r = await api.put(`/checklists/${template.id}/items/${item.id}`, { label: editLabel.trim() })
    const updated = { ...template, items: template.items.map(i => i.id === item.id ? r.data : i) }
    setTemplate(updated)
    onUpdated(updated)
    setEditingId(null)
  }

  async function removeItem(itemId) {
    await api.delete(`/checklists/${template.id}/items/${itemId}`)
    const updated = { ...template, items: template.items.filter(i => i.id !== itemId) }
    setTemplate(updated)
    onUpdated(updated)
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newLabel.trim()) return
    const r = await api.post(`/checklists/${template.id}/items`, { label: newLabel.trim() })
    const updated = { ...template, items: [...template.items, r.data] }
    setTemplate(updated)
    onUpdated(updated)
    setNewLabel('')
  }

  const s = typeStyle(template.checklist_type)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className={`px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 border-t-4 ${s.border.replace('border-l-', 'border-t-')} rounded-t-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md mb-1.5 ${s.pill}`}>Template</span>
              <h2 className="font-semibold text-gray-900">{template.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Edit default items — changes apply to new checklists created from this template</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <ul className="space-y-1">
            {template.items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2 group py-1.5 -mx-1 px-1 rounded-lg hover:bg-gray-50">
                <span className="text-xs text-gray-300 w-5 text-right shrink-0">{idx + 1}</span>
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onBlur={() => saveRename(item)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(item); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 text-sm border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm text-gray-700 cursor-text hover:text-indigo-600"
                    onClick={() => startEdit(item)}
                    title="Click to rename"
                  >{item.label}</span>
                )}
                <button onClick={() => removeItem(item.id)}
                  className="w-5 h-5 flex items-center justify-center text-gray-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addItem} className="flex gap-2 mt-4">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Add item…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium">Add</button>
          </form>
        </div>
        <div className="px-6 py-3.5 border-t border-gray-100 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Checklist Detail (tick items) ──────────────────────────────────────────────
function ChecklistDetail({ checklist: initial, onClose, onDeleted, onUpdated, onEditDetails }) {
  const [checklist, setChecklist] = useState(initial)
  const [deleting, setDeleting] = useState(false)
  const s = typeStyle(checklist.checklist_type)

  async function toggleItem(item) {
    const r = await api.patch(`/checklists/${checklist.id}/items/${item.id}`, { checked: !item.checked, checked_by: null })
    const items = checklist.items.map(i => i.id === item.id ? r.data : i)
    const updated = { ...checklist, items, progress: `${items.filter(i => i.checked).length}/${items.length}` }
    setChecklist(updated)
    onUpdated(updated)
  }

  async function addItem(label) {
    const r = await api.post(`/checklists/${checklist.id}/items`, { label })
    const items = [...checklist.items, r.data]
    const updated = { ...checklist, items, progress: `${items.filter(i => i.checked).length}/${items.length}` }
    setChecklist(updated)
    onUpdated(updated)
  }

  async function removeItem(itemId) {
    await api.delete(`/checklists/${checklist.id}/items/${itemId}`)
    const items = checklist.items.filter(i => i.id !== itemId)
    const updated = { ...checklist, items, progress: `${items.filter(i => i.checked).length}/${items.length}` }
    setChecklist(updated)
    onUpdated(updated)
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
        <div className={`px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 border-t-4 ${s.border.replace('border-l-', 'border-t-')} rounded-t-2xl sm:rounded-t-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md mb-2 ${s.pill}`}>
                {ALL_TYPES.find(t => t.key === checklist.checklist_type)?.label || checklist.checklist_type}
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {checklist.property_name && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {checklist.property_name}{checklist.unit_name ? ` · ${checklist.unit_name}` : ''}
                  </p>
                )}
                {checklist.tenant_name && (
                  <p className="text-xs text-gray-400">{checklist.tenant_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onEditDetails && (
                <button onClick={onEditDetails} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-indigo-500 transition-colors" title="Edit details">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              )}
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors" title="Close">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400">{done} of {total} complete</span>
              <span className={`text-xs font-semibold ${allDone ? 'text-emerald-600' : 'text-indigo-500'}`}>
                {allDone ? '✓ All done' : `${pct}%`}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <ul className="space-y-1">
            {checklist.items.map(item => (
              <li key={item.id} className="flex items-center gap-3 group py-1.5 rounded-lg hover:bg-gray-50 -mx-2 px-2 transition-colors">
                <button onClick={() => toggleItem(item)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}>
                  {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>
                <span className={`flex-1 text-sm leading-snug ${item.checked ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
                {item.checked_at && (
                  <span className="text-[11px] text-gray-300 shrink-0">
                    {new Date(item.checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <button onClick={() => removeItem(item.id)}
                  className="w-5 h-5 flex items-center justify-center text-gray-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={e => { e.preventDefault(); const v = e.target.item.value.trim(); if (v) { addItem(v); e.target.reset() } }} className="flex gap-2 mt-4">
            <input name="item" placeholder="Add item…" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium">Add</button>
          </form>
        </div>
        <div className="px-6 py-3.5 border-t border-gray-100 flex justify-between items-center shrink-0">
          <button onClick={deleteChecklist} disabled={deleting}
            className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-50 transition-colors">
            {deleting ? 'Deleting…' : 'Delete checklist'}
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Active Checklists Table ────────────────────────────────────────────────────
function ActiveTable({ checklists, allCount, onOpen, onEdit, onDelete }) {
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  function toggle(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...checklists].sort((a, b) => {
    let av, bv
    if (sortCol === 'name')       { av = a.name;           bv = b.name }
    else if (sortCol === 'type')  { av = a.checklist_type; bv = b.checklist_type }
    else if (sortCol === 'property') { av = a.property_name || ''; bv = b.property_name || '' }
    else if (sortCol === 'progress') {
      const [ad, at] = a.progress.split('/').map(Number)
      const [bd, bt] = b.progress.split('/').map(Number)
      av = at > 0 ? ad / at : 0; bv = bt > 0 ? bd / bt : 0
    } else { av = a.created_at; bv = b.created_at }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const Th = ({ col, label }) => (
    <th onClick={() => toggle(col)}
      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  if (checklists.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
        <p className="text-sm text-gray-400 mb-1">{allCount === 0 ? 'No active checklists.' : 'No checklists match this filter.'}</p>
        <p className="text-xs text-gray-300">Use a template above to create one.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <Th col="name" label="Name" />
            <Th col="type" label="Type" />
            <Th col="property" label="Property / Unit" />
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Applicant</th>
            <Th col="progress" label="Progress" />
            <Th col="created_at" label="Created" />
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(c => {
            const [done, total] = c.progress.split('/').map(Number)
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const allDone = total > 0 && done === total
            const s = typeStyle(c.checklist_type)
            return (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(c)}>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.pill}`}>
                    {TYPES.find(t => t.key === c.checklist_type)?.label || c.checklist_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {c.property_name ? <>{c.property_name}{c.unit_name ? <span className="text-gray-400"> · {c.unit_name}</span> : ''}</> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{c.tenant_name || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${allDone ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {allDone ? '✓' : `${done}/${total}`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => onOpen(c)} className="text-gray-400 hover:text-indigo-500 transition-colors" title="Open checklist">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => { if (window.confirm('Delete this checklist?')) onDelete(c.id) }} className="text-gray-400 hover:text-rose-500 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Checklists() {
  const [templates, setTemplates] = useState([])
  const [checklists, setChecklists] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [useModal, setUseModal] = useState(null)        // template to use
  const [editTemplate, setEditTemplate] = useState(null) // template to edit items
  const [editInstance, setEditInstance] = useState(null) // instance to rename/re-link
  const [selected, setSelected] = useState(null)         // instance to tick off

  useEffect(() => {
    Promise.all([
      api.get('/checklists/templates'),
      api.get('/checklists'),
      api.get('/properties'),
    ]).then(([tpl, cl, pr]) => {
      setTemplates(tpl.data)
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
    setUseModal(null)
    setSelected(c)
  }

  function handleDeleted(id) {
    setChecklists(prev => prev.filter(c => c.id !== id))
    setSelected(null)
  }

  function handleUpdated(updated) {
    setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  function handleInstanceSaved(updated) {
    handleUpdated(updated)
    setEditInstance(null)
  }

  function handleTemplateUpdated(updated) {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Checklists</h1>
          <p className="text-sm text-gray-400 mt-0.5">Use a template to create a dated checklist attached to a property and tenant</p>
        </div>
      </div>

      {/* ── Templates ── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Templates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {templates.map(t => {
            const s = typeStyle(t.checklist_type)
            return (
              <div key={t.id} className={`bg-white border border-gray-200 border-l-4 ${s.border} rounded-xl p-4`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${s.pill}`}>
                    {TYPES.find(x => x.key === t.checklist_type)?.label}
                  </span>
                  <span className="text-xs text-gray-300">{t.items.length} items</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-4">{t.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditTemplate(t)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Edit items
                  </button>
                  <button
                    onClick={() => setUseModal(t)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Use →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Active Checklists ── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Active Checklists</h2>
        {(() => {
          // Only properties that actually appear in the checklist data
          const usedProperties = [...new Map(
            checklists.filter(c => c.property_id && c.property_name)
              .map(c => [c.property_id, { id: c.property_id, name: c.property_name }])
          ).values()].sort((a, b) => a.name.localeCompare(b.name))
          const activePropertyName = usedProperties.find(p => p.id === Number(propertyFilter))?.name
          return (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Type tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {[{ key: 'all', label: 'All' }, ...ALL_TYPES].filter(t =>
                  t.key === 'all' || checklists.some(c => c.checklist_type === t.key)
                ).map(t => (
                  <button key={t.key} onClick={() => setTypeFilter(t.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${typeFilter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Property filter — only shown when properties exist in data */}
              {usedProperties.length > 0 && (
                propertyFilter ? (
                  <button onClick={() => setPropertyFilter('')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-100">
                    {activePropertyName}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                ) : (
                  <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="">Filter by property…</option>
                    {usedProperties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )
              )}
            </div>
          )
        })()}

        <ActiveTable
          checklists={visible}
          allCount={checklists.length}
          onOpen={setSelected}
          onEdit={setEditInstance}
          onDelete={id => api.delete(`/checklists/${id}`).then(() => handleDeleted(id))}
        />
      </div>

      {/* Modals */}
      {useModal && <UseModal template={useModal} onClose={() => setUseModal(null)} onCreated={handleCreated} />}
      {editTemplate && <TemplateEditor template={editTemplate} onClose={() => setEditTemplate(null)} onUpdated={handleTemplateUpdated} />}
      {editInstance && !selected && <EditInstanceModal checklist={editInstance} properties={properties} onClose={() => setEditInstance(null)} onSaved={handleInstanceSaved} />}
      {selected && <ChecklistDetail checklist={selected} onClose={() => setSelected(null)} onDeleted={handleDeleted} onUpdated={handleUpdated} onEditDetails={() => setEditInstance(selected)} />}
      {editInstance && selected?.id === editInstance.id && <EditInstanceModal checklist={editInstance} properties={properties} onClose={() => setEditInstance(null)} onSaved={c => { handleInstanceSaved(c); setSelected(c) }} />}
    </div>
  )
}
