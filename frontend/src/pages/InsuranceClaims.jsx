import { PageHeader } from '../components/Illustration'
import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

const API_BASE = ''  // uploads and PDFs served at relative paths via nginx

const CLAIM_TYPES = [
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'flood', label: 'Flood / Water Damage' },
  { value: 'fire', label: 'Fire Damage' },
  { value: 'theft', label: 'Theft / Break-in' },
  { value: 'liability', label: 'Public Liability' },
  { value: 'subsidence', label: 'Subsidence / Structural' },
  { value: 'other', label: 'Other' },
]

const STATUS_LABELS = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  settled: { label: 'Settled', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
}

export default function InsuranceClaims() {
  const [tab, setTab] = useState('new')   // 'new' | 'history'
  const [properties, setProperties] = useState([])
  const [form, setForm] = useState({
    property_id: '', unit_id: '', incident_date: '', incident_description: '', claim_type: 'property_damage',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // History
  const [claims, setClaims] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [claimPhotos, setClaimPhotos] = useState({})   // { claimId: [photo, ...] }

  // Photo upload
  const [uploadingFor, setUploadingFor] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    api.get('/properties').then(r => setProperties(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const r = await api.get('/intelligence/insurance-claims')
      setClaims(r.data)
    } catch {}
    setHistoryLoading(false)
  }

  async function loadPhotos(claimId) {
    try {
      const r = await api.get(`/intelligence/insurance-claim/${claimId}/photos`)
      setClaimPhotos(prev => ({ ...prev, [claimId]: r.data }))
    } catch {}
  }

  async function toggleExpand(claimId) {
    if (expandedId === claimId) { setExpandedId(null); return }
    setExpandedId(claimId)
    if (!claimPhotos[claimId]) loadPhotos(claimId)
  }

  const selectedProp = properties.find(p => String(p.id) === String(form.property_id))

  async function generate(e) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/intelligence/insurance-claim', {
        property_id: parseInt(form.property_id),
        unit_id: form.unit_id ? parseInt(form.unit_id) : null,
        incident_date: form.incident_date,
        incident_description: form.incident_description,
        claim_type: form.claim_type,
      })
      setResult(r.data)
      // Auto-load photos for the new claim
      setClaimPhotos(prev => ({ ...prev, [r.data.id]: [] }))
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to generate claim document')
    }
    setLoading(false)
  }

  async function uploadPhoto(claimId, file, description = '') {
    setUploadingFor(`${claimId}:${description}`)
    const fd = new FormData()
    const category = file.type?.startsWith('image/') ? 'photo' : file.type === 'application/pdf' ? 'correspondence' : 'other'
    fd.append('entity_type', 'insurance_claim')
    fd.append('entity_id', claimId)
    fd.append('category', category)
    if (description) fd.append('description', description)
    fd.append('file', file)
    try {
      await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadPhotos(claimId)
      if (tab === 'history') loadHistory()
    } catch (e) {
      alert(e.response?.data?.detail || 'Upload failed')
    }
    setUploadingFor(null)
  }

  async function deletePhoto(claimId, fileId) {
    if (!confirm('Delete this photo?')) return
    try {
      await api.delete(`/uploads/${fileId}`)
      setClaimPhotos(prev => ({
        ...prev,
        [claimId]: (prev[claimId] || []).filter(p => p.id !== fileId),
      }))
    } catch {}
  }

  async function updateStatus(claimId, status) {
    try {
      await api.patch(`/intelligence/insurance-claim/${claimId}/status`, { status })
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status } : c))
      if (result?.id === claimId) setResult(prev => ({ ...prev, status }))
    } catch {}
  }

  async function deleteClaim(claimId) {
    if (!confirm('Delete this claim permanently?')) return
    try {
      await api.delete(`/intelligence/insurance-claim/${claimId}`)
      setClaims(prev => prev.filter(c => c.id !== claimId))
      if (expandedId === claimId) setExpandedId(null)
      if (result?.id === claimId) setResult(null)
    } catch {}
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Insurance Claims" subtitle="AI-assisted claim documentation" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['new', 'New Claim'], ['history', 'Claims History']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── NEW CLAIM TAB ── */}
      {tab === 'new' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <form onSubmit={generate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Property *</label>
                  <select required value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value, unit_id: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select property…</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.postcode}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit (optional)</label>
                  <select value={form.unit_id} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!selectedProp}>
                    <option value="">Whole property</option>
                    {selectedProp?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Claim Type *</label>
                  <select required value={form.claim_type} onChange={e => setForm(f => ({ ...f, claim_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Incident Date *</label>
                  <input required type="date" value={form.incident_date} onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Incident Description *</label>
                <textarea required rows={4} value={form.incident_description}
                  onChange={e => setForm(f => ({ ...f, incident_description: e.target.value }))}
                  placeholder="Describe what happened, what was damaged, when it was discovered, and any immediate action taken…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <span className="animate-spin">⟳</span>}
                {loading ? 'Generating claim document…' : 'Generate Claim Document'}
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <ClaimCard
                claim={result}
                photos={claimPhotos[result.id] || []}
                uploadingFor={uploadingFor}
                onUpload={(file, desc) => uploadPhoto(result.id, file, desc)}
                onDeletePhoto={fileId => deletePhoto(result.id, fileId)}
                onStatusChange={status => updateStatus(result.id, status)}
                onDelete={() => deleteClaim(result.id)}
                expanded
              />
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {historyLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {!historyLoading && claims.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
              No claims yet. Generate your first claim above.
            </div>
          )}
          {claims.map(claim => (
            <div key={claim.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Summary row */}
              <button className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                onClick={() => { toggleExpand(claim.id) }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_LABELS[claim.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[claim.status]?.label || claim.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {claim.claim_reference || 'CLM-DRAFT'} — {claim.property_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {claim.claim_type?.replace(/_/g, ' ')} · {claim.incident_date}
                      {claim.photos_count > 0 && ` · ${claim.photos_count} photo${claim.photos_count !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {claim.estimated_claim_min && (
                    <span className="text-sm font-bold text-indigo-700">
                      £{claim.estimated_claim_min?.toLocaleString()}–£{claim.estimated_claim_max?.toLocaleString()}
                    </span>
                  )}
                  <span className="text-gray-400">{expandedId === claim.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === claim.id && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <ClaimCard
                    claim={claim}
                    photos={claimPhotos[claim.id] || []}
                    uploadingFor={uploadingFor}
                    onUpload={(file, desc) => uploadPhoto(claim.id, file, desc)}
                    onDeletePhoto={fileId => deletePhoto(claim.id, fileId)}
                    onStatusChange={status => updateStatus(claim.id, status)}
                    onDelete={() => deleteClaim(claim.id)}
                    expanded
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClaimCard({ claim, photos, uploadingFor, onUpload, onDeletePhoto, onStatusChange, onDelete, expanded }) {
  const fileRef = useRef()
  const API_BASE = ''  // uploads and PDFs are served at relative paths via nginx

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-mono">
                {claim.claim_reference || 'CLM-DRAFT'}
              </span>
              <span className="text-xs text-gray-400">{claim.claim_type?.replace(/_/g, ' ')}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_LABELS[claim.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[claim.status]?.label || claim.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900">{claim.property_name}</h2>
            <p className="text-xs text-gray-400">{claim.address} · Incident: {claim.incident_date}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Status changer */}
            <select value={claim.status} onChange={e => onStatusChange(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="settled">Settled</option>
              <option value="rejected">Rejected</option>
            </select>
            {claim.pdf_url && (
              <a href={`${API_BASE}${claim.pdf_url}`} target="_blank" rel="noreferrer"
                className="bg-indigo-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-indigo-700">
                ↓ PDF
              </a>
            )}
            <button onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
              Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-3 flex-wrap">
          {[
            { label: 'Photos', count: claim.photos_count ?? photos.length, icon: '📷' },
            { label: 'Invoices on file', count: claim.invoices_count, icon: '🧾' },
            { label: 'Maintenance jobs', count: claim.maintenance_jobs_count, icon: '🔧' },
          ].filter(e => e.count != null).map((e, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>{e.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-800">{e.count}</p>
                <p className="text-xs text-gray-400">{e.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Claim value */}
      {claim.estimated_claim_min != null && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Estimated claim value</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">
            £{claim.estimated_claim_min?.toLocaleString()} — £{claim.estimated_claim_max?.toLocaleString()}
          </p>
          <p className="text-xs text-indigo-500 mt-1">AI estimate. Actual settlement will vary.</p>
        </div>
      )}

      {/* Uncategorised files (no checklist description) */}
      {photos.filter(f => !f.description).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Other Attachments</p>
          <FileGrid files={photos.filter(f => !f.description)} onDelete={onDeletePhoto} />
        </div>
      )}

      {claim.summary != null && (
        <EditableBlock title="Claim Summary" content={claim.summary}
          onSave={val => api.patch(`/intelligence/insurance-claim/${claim.id}`, { summary: val })} />
      )}
      {claim.damage_description != null && (
        <EditableBlock title="Description of Damage" content={claim.damage_description}
          onSave={val => api.patch(`/intelligence/insurance-claim/${claim.id}`, { damage_description: val })} />
      )}

      {claim.timeline != null && (
        <EditableListBlock title="Timeline of Events" items={claim.timeline || []}
          renderItem={(item, i) => (
            <div className="flex items-start gap-3 text-sm text-gray-700">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              {item}
            </div>
          )}
          onSave={items => api.patch(`/intelligence/insurance-claim/${claim.id}`, { timeline: items })} />
      )}

      {claim.supporting_documents_checklist != null && (
        <EditableChecklistBlock
          items={claim.supporting_documents_checklist || []}
          photos={photos}
          claimId={claim.id}
          uploadingFor={uploadingFor}
          onUpload={onUpload}
          onDeletePhoto={onDeletePhoto}
          onSave={items => api.patch(`/intelligence/insurance-claim/${claim.id}`, { supporting_documents_checklist: items })} />
      )}

      {claim.next_steps != null && (
        <EditableListBlock title="Next Steps" items={claim.next_steps || []}
          renderItem={(item, i) => (
            <div className="flex items-start gap-3 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {item}
            </div>
          )}
          onSave={items => api.patch(`/intelligence/insurance-claim/${claim.id}`, { next_steps: items })} />
      )}
    </div>
  )
}

function FileGrid({ files, onDelete }) {
  const API_BASE = ''
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map(file => {
        const isImage = file.mime_type?.startsWith('image/')
        const isPdf = file.mime_type === 'application/pdf'
        return (
          <div key={file.id} className="relative group border border-gray-200 rounded-lg overflow-hidden w-24">
            {isImage ? (
              <a href={`${API_BASE}${file.url}`} target="_blank" rel="noreferrer">
                <img src={`${API_BASE}${file.url}`} alt={file.original_name} className="w-24 h-20 object-cover" />
              </a>
            ) : (
              <a href={`${API_BASE}${file.url}`} target="_blank" rel="noreferrer"
                className="flex flex-col items-center justify-center h-20 bg-gray-50 hover:bg-gray-100 gap-1 px-1 transition-colors">
                <span className="text-xl">{isPdf ? '📄' : '📎'}</span>
                <span className="text-xs text-gray-500 text-center break-all line-clamp-2">{file.original_name}</span>
              </a>
            )}
            <button onClick={() => onDelete(file.id)}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs items-center justify-center hidden group-hover:flex">
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ChecklistItem({ label, files, uploading, onUpload, onDelete }) {
  const fileRef = useRef()
  const done = files.length > 0
  return (
    <div className={`rounded-lg border p-3 transition-colors ${done ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs ${done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>
            {done && '✓'}
          </span>
          <p className="text-sm text-gray-700">{label}</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="text-xs bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-600 px-2.5 py-1 rounded-lg transition-colors shrink-0 disabled:opacity-50">
          {uploading ? 'Uploading…' : '+ Attach'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden"
          onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = '' } }} />
      </div>
      {files.length > 0 && <FileGrid files={files} onDelete={onDelete} />}
    </div>
  )
}

function EditableListBlock({ title, items, renderItem, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(items.join('\n'))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const updated = value.split('\n').map(s => s.trim()).filter(Boolean)
    try { await onSave(updated) } catch { alert('Failed to save') }
    setSaving(false)
    setEditing(false)
  }

  const current = editing ? value.split('\n').map(s => s.trim()).filter(Boolean) : items

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {!editing ? (
          <button onClick={() => { setValue(items.join('\n')); setEditing(true) }}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">✏️ Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:text-gray-700">Cancel</button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 mb-1">One item per line</p>
          <textarea rows={Math.max(4, items.length + 2)} value={value} onChange={e => setValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      ) : (
        <div className="space-y-2">
          {current.map((item, i) => renderItem(item, i))}
        </div>
      )}
    </div>
  )
}

function EditableChecklistBlock({ items, photos, claimId, uploadingFor, onUpload, onDeletePhoto, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(items.join('\n'))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const updated = value.split('\n').map(s => s.trim()).filter(Boolean)
    try { await onSave(updated) } catch { alert('Failed to save') }
    setSaving(false)
    setEditing(false)
  }

  const current = editing ? value.split('\n').map(s => s.trim()).filter(Boolean) : items

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">Supporting Documents Checklist</p>
        {!editing ? (
          <button onClick={() => { setValue(items.join('\n')); setEditing(true) }}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">✏️ Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:text-gray-700">Cancel</button>
          </div>
        )}
      </div>
      {editing ? (
        <div>
          <p className="text-xs text-gray-400 mb-1">One item per line</p>
          <textarea rows={Math.max(4, items.length + 2)} value={value} onChange={e => setValue(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      ) : (
        <div className="space-y-4">
          {current.map((item, i) => {
            const itemFiles = photos.filter(f => f.description === item)
            const uploading = uploadingFor === `${claimId}:${item}`
            return (
              <ChecklistItem key={i} label={item} files={itemFiles} uploading={uploading}
                onUpload={file => onUpload(file, item)} onDelete={onDeletePhoto} />
            )
          })}
        </div>
      )}
    </div>
  )
}

function InfoBlock({ title, content }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
    </div>
  )
}

function EditableBlock({ title, content, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSave(value)
    } catch {
      alert('Failed to save')
    }
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
            ✏️ Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setValue(content); setEditing(false) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200">
              Cancel
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea rows={6} value={value} onChange={e => setValue(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed" />
      ) : (
        <p className="text-sm text-gray-600 leading-relaxed">{value}</p>
      )}
    </div>
  )
}
