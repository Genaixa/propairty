import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/Illustration'
import api from '../lib/api'
import Badge from '../components/Badge'

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className={`text-xl transition-transform hover:scale-110 ${n <= (hovered || value) ? 'text-yellow-400' : 'text-gray-300'}`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-gray-500">{['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][value]}</span>
      )}
    </div>
  )
}

function AttachmentPreview({ file, onDelete }) {
  const isImage = file.mime_type?.startsWith('image/')
  const isVideo = file.mime_type?.startsWith('video/')
  const isAudio = file.mime_type?.startsWith('audio/')
  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      {isImage && (
        <a href={file.url} target="_blank" rel="noreferrer">
          <img src={file.url} alt={file.original_name} className="w-full h-28 object-cover" />
        </a>
      )}
      {isVideo && (
        <video src={file.url} controls className="w-full max-h-40" />
      )}
      {isAudio && (
        <div className="px-3 py-3">
          <p className="text-xs text-gray-500 mb-1 truncate">{file.original_name}</p>
          <audio src={file.url} controls className="w-full h-8" />
        </div>
      )}
      {!isImage && !isVideo && !isAudio && (
        <a href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-3 text-xs text-indigo-600 hover:underline">
          📎 {file.original_name}
        </a>
      )}
      {onDelete && (
        <button onClick={() => onDelete(file.id)}
          className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
      )}
      {isImage && <p className="text-xs text-gray-400 px-2 py-1 truncate">{file.original_name}</p>}
    </div>
  )
}

function NotesThread({ job }) {
  const jobId = job.id
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useState(null)
  const [agentReview, setAgentReview] = useState(undefined) // undefined=loading, null=none, obj=exists
  const [reviewStars, setReviewStars] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const scrollRef = useRef(null)

  function loadAttachments() {
    api.get(`/uploads?entity_type=maintenance&entity_id=${jobId}`)
      .then(r => setAttachments(r.data)).catch(() => {})
  }

  function fetchNotes() {
    api.get(`/maintenance/${jobId}/notes`).then(r => {
      setNotes(prev => {
        if (!prev || r.data.length !== prev.length) return r.data
        return prev
      })
    }).catch(() => {})
  }

  useEffect(() => {
    api.get(`/maintenance/${jobId}/notes`).then(r => setNotes(r.data)).catch(() => setNotes([]))
    loadAttachments()
    if (job.contractor_id && job.status === 'completed') {
      api.get(`/maintenance/${jobId}/review`)
        .then(r => { setAgentReview(r.data); if (r.data) { setReviewStars(r.data.stars); setReviewComment(r.data.comment || '') } })
        .catch(() => setAgentReview(null))
    }
    const interval = setInterval(fetchNotes, 4000)
    return () => clearInterval(interval)
  }, [jobId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [notes])

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('entity_type', 'maintenance')
        fd.append('entity_id', jobId)
        fd.append('category', 'photo')
        fd.append('file', file)
        await api.post('/uploads', fd)
      }
      loadAttachments()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function deleteAttachment(fileId) {
    await api.delete(`/uploads/${fileId}`)
    setAttachments(prev => prev.filter(f => f.id !== fileId))
  }

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      const r = await api.post(`/maintenance/${jobId}/notes`, { body: body.trim() })
      setNotes(prev => [...(prev || []), r.data])
      setBody('')
    } finally {
      setSaving(false)
    }
  }

  async function submitReview(e) {
    e.preventDefault()
    if (!reviewStars) return
    setSavingReview(true)
    try {
      await api.post(`/maintenance/${jobId}/review`, { stars: reviewStars, comment: reviewComment.trim() || null })
      setAgentReview({ stars: reviewStars, comment: reviewComment.trim() || null })
    } finally {
      setSavingReview(false)
    }
  }

  if (notes === null) return <p className="text-xs text-gray-400 py-2">Loading notes…</p>

  return (
    <div className="space-y-3">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map(f => (
            <AttachmentPreview key={f.id} file={f} onDelete={deleteAttachment} />
          ))}
        </div>
      )}
      <div ref={scrollRef} className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {notes.length === 0 && (
        <p className="text-xs text-gray-400">No notes yet.</p>
      )}
      {notes.map(n => (
        <div key={n.id} className={`flex gap-3 ${n.author_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
            n.author_type === 'agent'
              ? 'bg-indigo-600 text-white'
              : n.author_type === 'contractor'
                ? 'bg-orange-50 border border-orange-200 text-gray-800'
                : 'bg-violet-50 border border-violet-200 text-gray-800'
          }`}>
            <p className="font-medium text-xs mb-0.5 opacity-75">
              {n.author_type === 'contractor' ? '🔧 ' : n.author_type === 'tenant' ? '🏠 ' : ''}{n.author_name}
            </p>
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className={`text-xs mt-1 opacity-60`}>
              {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <label className={`cursor-pointer flex items-center gap-1 border border-gray-300 text-gray-500 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          title="Attach photo, video or voice note">
          {uploading ? '⏳' : '📎'}
          <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFileChange} />
        </label>
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? '…' : 'Send'}
        </button>
      </form>

      {/* Agent rating — completed jobs with a contractor */}
      {job.contractor_id && job.status === 'completed' && agentReview !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {agentReview ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Your rating for this contractor</p>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={`text-lg ${n <= agentReview.stars ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
                <button onClick={() => setAgentReview(null)} className="ml-2 text-xs text-gray-400 hover:underline">edit</button>
              </div>
              {agentReview.comment && <p className="text-xs text-gray-500 italic">"{agentReview.comment}"</p>}
            </div>
          ) : (
            <form onSubmit={submitReview} className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Rate this contractor</p>
              <StarPicker value={reviewStars} onChange={setReviewStars} />
              <input
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Optional comment…"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={savingReview || !reviewStars}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                {savingReview ? 'Saving…' : 'Save rating'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

const PRIORITY_BANDS = [
  { key: 'urgent', label: 'Urgent', icon: '🚨', header: 'bg-red-600' },
  { key: 'high',   label: 'High',   icon: '🔴', header: 'bg-orange-500' },
  { key: 'medium', label: 'Medium', icon: '🟡', header: 'bg-yellow-500' },
  { key: 'low',    label: 'Low',    icon: '🟢', header: 'bg-gray-400' },
]

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function TriageRow({ req, contractors, onAction, onChat }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [contractorId, setContractorId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scheduleDateOpen, setScheduleDateOpen] = useState(false)

  async function handleAssign() {
    if (!contractorId) return
    setAssigning(true)
    try {
      await api.put(`/contractors/assign/${req.id}`, { contractor_id: parseInt(contractorId) })
      onAction()
    } finally { setAssigning(false); setAssignOpen(false) }
  }

  return (
    <>
      <tr className="hover:bg-gray-50 border-b border-gray-100">
        <td className="px-4 py-2.5">
          <p className="text-sm font-medium text-gray-900 leading-tight">{req.title}</p>
          {req.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{req.description}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{req.unit_name}</p>
        </td>
        <td className="px-4 py-2.5"><Badge value={req.status} /></td>
        <td className="px-4 py-2.5 text-xs">
          {req.contractor_id
            ? <div className="space-y-0.5">
                <Link to={`/contractors?id=${req.contractor_id}`} className="text-indigo-600 hover:underline">🔧 {req.contractor_name}</Link>
                {req.contractor_accepted === null && <p className="text-amber-500">⏳ Awaiting acceptance</p>}
                {req.contractor_accepted === false && <p className="text-red-500 font-medium">✗ Declined — reassign</p>}
                {req.contractor_accepted === true && <p className="text-green-600">✓ Accepted</p>}
                {req.contractor_viewed_at && !req.contractor_accepted
                  ? <p className="text-gray-400" title={new Date(req.contractor_viewed_at).toLocaleString('en-GB')}>👁 Viewed</p>
                  : null}
                {req.contractor_quote != null && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className="text-amber-600 font-medium">💰 Quote: £{req.contractor_quote}</span>
                    {req.quote_status === 'pending' && (
                      <>
                        <button onClick={async () => { await api.post(`/maintenance/${req.id}/quote-decision`, { decision: 'approved' }); onAction() }}
                          className="border border-green-400 text-green-700 px-1.5 py-0.5 rounded text-[11px] hover:bg-green-50">✓ Approve</button>
                        <button onClick={async () => { await api.post(`/maintenance/${req.id}/quote-decision`, { decision: 'rejected' }); onAction() }}
                          className="border border-red-300 text-red-600 px-1.5 py-0.5 rounded text-[11px] hover:bg-red-50">✗ Reject</button>
                      </>
                    )}
                    {req.quote_status === 'approved' && <span className="text-green-600 text-[11px]">✓ approved</span>}
                    {req.quote_status === 'rejected' && <span className="text-red-500 text-[11px]">✗ rejected</span>}
                  </div>
                )}
              </div>
            : <span className="text-amber-500">Unassigned</span>}
        </td>
        <td className="px-4 py-2.5 text-xs">
          {req.reported_by_tenant_id
            ? <Link to={`/tenants/${req.reported_by_tenant_id}`} className="text-indigo-600 hover:underline">{req.reported_by}</Link>
            : <span className="text-gray-400">{req.reported_by || '—'}</span>}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-400">{daysSince(req.created_at)}d</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {req.status === 'open' && (
              <button onClick={async () => { await api.put(`/maintenance/${req.id}`, { ...req, status: 'in_progress' }); onAction() }}
                className="text-xs border border-amber-300 text-amber-700 px-2 py-0.5 rounded hover:bg-amber-50">Start</button>
            )}
            {req.status === 'in_progress' && (
              <button onClick={async () => { await api.put(`/maintenance/${req.id}`, { ...req, status: 'completed' }); onAction() }}
                className="text-xs border border-green-300 text-green-700 px-2 py-0.5 rounded hover:bg-green-50">Complete</button>
            )}
            <button onClick={() => setAssignOpen(v => !v)}
              className="text-xs border border-indigo-300 text-indigo-700 px-2 py-0.5 rounded hover:bg-indigo-50">
              {req.contractor_id ? 'Reassign' : 'Assign'}
            </button>
            <button onClick={() => onChat(req)}
              className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${req.has_tenant_note ? 'border border-violet-400 text-violet-700 bg-violet-50 hover:bg-violet-100 font-semibold' : 'border border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
              💬 chat
              {req.notes_count > 0 && <span className={`px-1 rounded-full text-xs ${req.has_tenant_note ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{req.notes_count}</span>}
            </button>
            {/* Scheduled date */}
            {!scheduleDateOpen
              ? <button onClick={() => setScheduleDateOpen(true)} className="text-xs border border-blue-200 text-blue-500 px-2 py-0.5 rounded hover:bg-blue-50">
                  {req.scheduled_date ? `📅 ${req.scheduled_date}` : '📅 Schedule'}
                </button>
              : <span className="flex items-center gap-1">
                  <input type="date" defaultValue={req.scheduled_date || ''} id={`sched-${req.id}`}
                    className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={async () => {
                    const val = document.getElementById(`sched-${req.id}`).value
                    await api.post(`/maintenance/${req.id}/scheduled-date`, { scheduled_date: val || null })
                    onAction(); setScheduleDateOpen(false)
                  }} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600">Set</button>
                  <button onClick={() => setScheduleDateOpen(false)} className="text-xs text-gray-400">✕</button>
                </span>
            }
            {/* Contractor proposed date */}
            {req.proposed_date && req.proposed_date_status === 'pending' && (
              <span className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-amber-600 font-medium">📅 Contractor proposes {req.proposed_date}</span>
                <button onClick={async () => { await api.post(`/maintenance/${req.id}/proposed-date-decision`, { decision: 'accepted' }); onAction() }}
                  className="border border-green-400 text-green-700 px-1.5 py-0.5 rounded text-[11px] hover:bg-green-50">✓ Accept</button>
                <button onClick={async () => { await api.post(`/maintenance/${req.id}/proposed-date-decision`, { decision: 'rejected' }); onAction() }}
                  className="border border-red-300 text-red-600 px-1.5 py-0.5 rounded text-[11px] hover:bg-red-50">✗ Decline</button>
              </span>
            )}
            {/* Mark invoice paid */}
            {req.invoice_ref && (
              <button onClick={async () => { await api.post(`/maintenance/${req.id}/mark-paid`); onAction() }}
                className={`text-xs px-2 py-0.5 rounded border ${req.invoice_paid ? 'border-green-400 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                {req.invoice_paid ? '✓ paid' : '£ mark paid'}
              </button>
            )}
            {!confirmDelete
              ? <button onClick={() => setConfirmDelete(true)} className="text-xs border border-red-200 text-red-400 px-2 py-0.5 rounded hover:bg-red-50">Delete</button>
              : <>
                  <span className="text-xs text-red-600 font-medium">Sure?</span>
                  <button onClick={async () => { await api.delete(`/maintenance/${req.id}`); onAction() }} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">No</button>
                </>
            }
          </div>
        </td>
      </tr>
      {assignOpen && (
        <tr className="bg-indigo-50 border-b border-indigo-100">
          <td colSpan="6" className="px-4 py-2">
            <div className="flex gap-2">
              <select value={contractorId} onChange={e => setContractorId(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select contractor…</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}{c.trade ? ` — ${c.trade}` : ''}{c.avg_rating ? ` ★${c.avg_rating}` : ''}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={assigning || !contractorId}
                className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50">
                {assigning ? '…' : 'Confirm'}
              </button>
              <button onClick={() => setAssignOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AllRequestRow({ r, onAction, onChat }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await api.delete(`/maintenance/${r.id}`)
    onAction()
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2.5">
        <p className="font-medium text-gray-900">{r.title}</p>
        <p className="text-xs text-gray-400">{r.unit_name}</p>
        {r.tenant_satisfied === true && <span className="text-xs text-violet-600">tenant confirmed ✓</span>}
        {r.tenant_satisfied === false && <span className="text-xs text-red-500">tenant not satisfied ⚠</span>}
      </td>
      <td className="px-4 py-2.5"><Badge value={r.priority} /></td>
      <td className="px-4 py-2.5"><Badge value={r.status} /></td>
      <td className="px-4 py-2.5 text-xs">
        {r.contractor_id
          ? <div className="space-y-0.5">
              <Link to={`/contractors?id=${r.contractor_id}`} className="text-indigo-600 hover:underline">{r.contractor_name}</Link>
              {r.contractor_accepted === null && <p className="text-amber-500">⏳ pending</p>}
              {r.contractor_accepted === false && <p className="text-red-500 font-medium">✗ declined</p>}
              {r.contractor_accepted === true && <p className="text-green-600">✓ accepted</p>}
              {r.contractor_quote != null && (
                <span className={`text-[11px] font-medium ${r.quote_status === 'approved' ? 'text-green-600' : r.quote_status === 'rejected' ? 'text-red-500' : 'text-amber-600'}`}>
                  💰 £{r.contractor_quote}{r.quote_status === 'approved' ? ' ✓' : r.quote_status === 'rejected' ? ' ✗' : ' (pending)'}
                </span>
              )}
            </div>
          : <span className="text-gray-400">None</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">
        {r.reported_by_tenant_id
          ? <Link to={`/tenants/${r.reported_by_tenant_id}`} className="text-indigo-600 hover:underline">{r.reported_by || '—'}</Link>
          : r.reported_by || '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400">
        {r.created_at}
        {r.scheduled_date && <p className="text-blue-500 font-medium mt-0.5">📅 {r.scheduled_date}</p>}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-600">
        {r.actual_cost != null
          ? <span className="font-medium">£{r.actual_cost.toLocaleString()}{r.invoice_paid ? <span className="text-green-600 ml-1">✓ paid</span> : ''}</span>
          : r.estimated_cost != null ? <span className="text-gray-400">est £{r.estimated_cost.toLocaleString()}</span> : '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {r.status === 'open' && (
            <button onClick={() => onAction('start', r.id)}
              className="text-xs border border-amber-300 text-amber-700 px-2 py-0.5 rounded hover:bg-amber-50">Start</button>
          )}
          {r.status === 'in_progress' && (
            <button onClick={() => onAction('complete', r.id)}
              className="text-xs border border-green-300 text-green-700 px-2 py-0.5 rounded hover:bg-green-50">Complete</button>
          )}
          <button onClick={() => onChat(r)}
            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${r.has_tenant_note ? 'border border-violet-400 text-violet-700 bg-violet-50 hover:bg-violet-100 font-semibold' : 'border border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
            💬 chat
            {r.notes_count > 0 && <span className={`px-1 rounded-full text-xs ${r.has_tenant_note ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{r.notes_count}</span>}
          </button>
          {!confirmDelete
            ? <button onClick={() => setConfirmDelete(true)} className="text-xs border border-red-200 text-red-400 px-2 py-0.5 rounded hover:bg-red-50">Delete</button>
            : <>
                <span className="text-xs text-red-600 font-medium">Sure?</span>
                <button onClick={handleDelete} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">No</button>
              </>
          }
        </div>
      </td>
    </tr>
  )
}

export default function Maintenance() {
  const [requests, setRequests] = useState([])
  const [properties, setProperties] = useState([])
  const [contractors, setContractors] = useState([])
  const [chatJob, setChatJob] = useState(null)
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tenant_id') ? 'all' : 'triage'
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ unit_id: '', title: '', description: '', priority: 'medium', contractor_id: '' })
  const [formFiles, setFormFiles] = useState([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [tenantUnit, setTenantUnit] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tenantIdFilter = searchParams.get('tenant_id') ? parseInt(searchParams.get('tenant_id')) : null
  const unitIdFilter = searchParams.get('unit_id') ? parseInt(searchParams.get('unit_id')) : null
  const [tenantNameFilter, setTenantNameFilter] = useState('')
  const [unitNameFilter, setUnitNameFilter] = useState('')
  const [triageSort, setTriageSort] = useState({ col: 'created_at', dir: 'desc' })
  const [allSort, setAllSort] = useState({ col: 'created_at', dir: 'desc' })
  const [statusFilter, setStatusFilter] = useState('open')

  function makeToggleSort(sort, setSort) {
    return col => setSort(s => ({ col, dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  }

  function sortRows(rows, { col, dir }) {
    const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }
    return [...rows].sort((a, b) => {
      let av, bv
      if      (col === 'title')       { av = a.title;            bv = b.title }
      else if (col === 'priority')    { av = PRIORITY_ORDER[a.priority] ?? 4; bv = PRIORITY_ORDER[b.priority] ?? 4 }
      else if (col === 'status')      { av = a.status;           bv = b.status }
      else if (col === 'contractor')  { av = a.contractor_name || ''; bv = b.contractor_name || '' }
      else if (col === 'reported_by') { av = a.reported_by || ''; bv = b.reported_by || '' }
      else if (col === 'cost')        { av = a.actual_cost ?? a.estimated_cost ?? -1; bv = b.actual_cost ?? b.estimated_cost ?? -1 }
      else                            { av = a[col] || '';        bv = b[col] || '' }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }

  function SortTh({ col, label, sort, toggle }) {
    return (
      <th onClick={() => toggle(col)}
        className="text-left px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
        {label} {sort.col === col ? (sort.dir === 'asc' ? '▲' : '▼') : <span className="text-gray-200">↕</span>}
      </th>
    )
  }

  function loadRequests() {
    api.get('/maintenance').then(r => setRequests(r.data))
  }

  useEffect(() => {
    loadRequests()
    api.get('/properties').then(r => {
      setProperties(r.data)
      if (unitIdFilter) {
        for (const p of r.data) {
          const u = p.units.find(u => u.id === unitIdFilter)
          if (u) { setUnitNameFilter(`${p.name} · ${u.name}`); break }
        }
      }
    })
    api.get('/contractors').then(r => setContractors(r.data)).catch(() => {})
    api.get('/auth/me').then(r => setCurrentUser(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (tenantIdFilter) {
      api.get(`/tenants/${tenantIdFilter}/profile`)
        .then(r => {
          setTenantNameFilter(r.data.full_name)
          const active = r.data.leases?.find(l => l.status === 'active') || r.data.leases?.[0]
          if (active?.unit_id) {
            setTenantUnit({ unit_id: active.unit_id, label: `${active.property} · ${active.unit}` })
          }
        })
        .catch(() => {})
    } else {
      setTenantNameFilter('')
      setTenantUnit(null)
    }
  }, [tenantIdFilter])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name })))

  function openForm() {
    setForm({
      unit_id: tenantUnit?.unit_id || '',
      title: '',
      description: '',
      priority: 'medium',
      contractor_id: '',
    })
    setFormFiles([])
    setFormError('')
    setShowForm(true)
  }

  const save = async e => {
    e.preventDefault()
    const uid = parseInt(form.unit_id)
    if (!uid) { setFormError('Please select a unit.'); return }
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      const res = await api.post('/maintenance', {
        unit_id: uid,
        title: form.title,
        description: form.description,
        priority: form.priority,
        reported_by: currentUser?.full_name || '',
        reported_by_tenant_id: tenantIdFilter || null,
      })
      if (form.contractor_id) {
        await api.put(`/contractors/assign/${res.data.id}`, { contractor_id: parseInt(form.contractor_id) })
      }
      for (const file of formFiles) {
        const fd = new FormData()
        fd.append('entity_type', 'maintenance')
        fd.append('entity_id', res.data.id)
        fd.append('category', 'photo')
        fd.append('file', file)
        await api.post('/uploads', fd)
      }
      loadRequests()
      setShowForm(false)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id, status) => {
    const req = requests.find(r => r.id === id)
    await api.put(`/maintenance/${id}`, { ...req, status })
    loadRequests()
  }

  const statusCounts = {
    all: requests.length,
    open: requests.filter(r => r.status === 'open').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  }

  const activeRequests = requests
    .filter(r => statusFilter === 'all' ? (r.status !== 'completed' && r.status !== 'cancelled') : r.status === statusFilter)
    .filter(r => !tenantIdFilter || r.reported_by_tenant_id === tenantIdFilter)
    .filter(r => !unitIdFilter || r.unit_id === unitIdFilter)

  // Summary counts
  const counts = Object.fromEntries(PRIORITY_BANDS.map(b => [b.key, activeRequests.filter(r => r.priority === b.key).length]))

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Track and resolve property issues" />
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['triage', 'Triage'], ['all', 'All Requests']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${statusFilter === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'}`}>
              {label}
              <span className={`ml-1 ${statusFilter === key ? 'text-indigo-200' : 'text-gray-400'}`}>
                {statusCounts[key]}
              </span>
            </button>
          ))}
        </div>
        <button onClick={openForm} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Request
        </button>
      </div>

      {/* ── CHAT SLIDE-OVER ── */}
      {chatJob && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => setChatJob(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{chatJob.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{chatJob.unit_name}</p>
                <div className="flex gap-2 mt-1.5">
                  <Badge value={chatJob.priority} />
                  <Badge value={chatJob.status} />
                </div>
                {chatJob.description && <p className="text-xs text-gray-400 mt-1.5 italic">{chatJob.description}</p>}
                {chatJob.tenant_satisfied === false && chatJob.tenant_feedback && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600">
                    <strong>Complaint:</strong> "{chatJob.tenant_feedback}"
                  </div>
                )}
              </div>
              <button onClick={() => setChatJob(null)} className="ml-4 text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <NotesThread job={chatJob} />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">New Maintenance Request</h3>
            <form onSubmit={save} className="space-y-4">
              {/* Unit — hidden if pre-filled from tenant context */}
              {tenantUnit ? (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-700 font-medium">
                  {tenantUnit.label}
                </div>
              ) : (
                <select value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                  <option value="">Select unit…</option>
                  {allUnits.map(u => <option key={u.id} value={u.id}>{u.propertyName} · {u.name}</option>)}
                </select>
              )}
              <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24" />
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select value={form.contractor_id} onChange={e => setForm({...form, contractor_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Assign contractor (optional)</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.company_name ? ` · ${c.company_name}` : ''}{c.trade ? ` — ${c.trade}` : ''}{c.avg_rating ? ` ★${c.avg_rating}` : ''}
                  </option>
                ))}
              </select>
              {/* Attachments */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Photos / videos / voice notes (optional)</label>
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                  <span className="text-xl">📎</span>
                  <span>{formFiles.length > 0 ? `${formFiles.length} file${formFiles.length > 1 ? 's' : ''} selected` : 'Attach files…'}</span>
                  <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden"
                    onChange={e => setFormFiles(Array.from(e.target.files))} />
                </label>
                {formFiles.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {formFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">{f.name}</span>
                        <button type="button" onClick={() => setFormFiles(prev => prev.filter((_, j) => j !== i))}
                          className="ml-2 text-gray-300 hover:text-red-400">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {currentUser && (
                <p className="text-xs text-gray-400">Reporting as <strong>{currentUser.full_name}</strong></p>
              )}
              {formError && <p className="text-sm text-red-500">{formError}</p>}
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

      {(tenantIdFilter || unitIdFilter) && (
        <div className="mb-4 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-700">
          <span>
            {tenantIdFilter && <>Showing jobs for <strong>{tenantNameFilter}</strong></>}
            {unitIdFilter && <>Showing jobs for <strong>{unitNameFilter}</strong></>}
          </span>
          <button onClick={() => setSearchParams({})} className="ml-auto text-xs text-indigo-500 hover:underline">Clear filter</button>
        </div>
      )}

      {/* ── TRIAGE VIEW ── */}
      {tab === 'triage' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {activeRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-3xl mb-3">✅</p>
              <p className="font-medium">No open requests</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <SortTh col="title" label="Job" sort={triageSort} toggle={makeToggleSort(triageSort, setTriageSort)} />
                  <SortTh col="status" label="Status" sort={triageSort} toggle={makeToggleSort(triageSort, setTriageSort)} />
                  <SortTh col="contractor" label="Contractor" sort={triageSort} toggle={makeToggleSort(triageSort, setTriageSort)} />
                  <SortTh col="reported_by" label="Reported by" sort={triageSort} toggle={makeToggleSort(triageSort, setTriageSort)} />
                  <SortTh col="created_at" label="Age" sort={triageSort} toggle={makeToggleSort(triageSort, setTriageSort)} />
                  <th className="text-left px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {PRIORITY_BANDS.map(band => {
                  const jobs = sortRows(activeRequests.filter(r => r.priority === band.key), triageSort)
                  if (jobs.length === 0) return null
                  return [
                    <tr key={`band-${band.key}`} className={`${band.header}`}>
                      <td colSpan="6" className="px-4 py-1.5">
                        <span className="text-white font-bold text-xs">{band.icon} {band.label}</span>
                        <span className="ml-2 bg-white/30 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{jobs.length}</span>
                        {jobs.filter(j => !j.contractor_id).length > 0 && (
                          <span className="ml-auto float-right text-white/70 text-xs">{jobs.filter(j => !j.contractor_id).length} unassigned</span>
                        )}
                      </td>
                    </tr>,
                    ...jobs.map(req => (
                      <TriageRow key={req.id} req={req} contractors={contractors} onAction={loadRequests}
                        onChat={setChatJob} />
                    ))
                  ]
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ALL REQUESTS VIEW ── */}
      {tab === 'all' && (() => {
        const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }
        const filtered = requests
          .filter(r => !tenantIdFilter || r.reported_by_tenant_id === tenantIdFilter)
          .filter(r => !unitIdFilter || r.unit_id === unitIdFilter)
          .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
        const inProgress = sortRows(
          filtered.filter(r => r.status !== 'completed' && r.status !== 'cancelled'),
          allSort
        )
        const completed = sortRows(
          filtered.filter(r => r.status === 'completed' || r.status === 'cancelled'),
          allSort
        )

        const tableHeaders = (
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
            <SortTh col="title" label="Job" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="priority" label="Priority" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="status" label="Status" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="contractor" label="Contractor" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="reported_by" label="Reported" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="created_at" label="Date" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <SortTh col="cost" label="Cost" sort={allSort} toggle={makeToggleSort(allSort, setAllSort)} />
            <th className="text-left px-4 py-2.5 font-medium">Actions</th>
          </tr>
        )

        const rowProps = r => ({
          key: r.id, r,
          onAction: (action, id) => {
            if (action === 'start') updateStatus(id, 'in_progress')
            else if (action === 'complete') updateStatus(id, 'completed')
            else loadRequests()
          },
          onChat: setChatJob,
        })

        if (filtered.length === 0) return (
          <p className="text-gray-400 text-sm p-8 text-center bg-white rounded-xl border border-gray-200">
            No maintenance requests{tenantNameFilter ? ` for ${tenantNameFilter}` : ''}.
          </p>
        )

        return (
          <div className="space-y-6">
            {/* In Progress */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">In Progress <span className="text-gray-400 font-normal">({inProgress.length})</span></h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {inProgress.length === 0
                  ? <p className="text-gray-400 text-sm p-6 text-center">No active jobs.</p>
                  : <table className="w-full text-sm"><thead>{tableHeaders}</thead><tbody>{inProgress.map(r => <AllRequestRow {...rowProps(r)} />)}</tbody></table>
                }
              </div>
            </div>
            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Completed <span className="text-gray-400 font-normal">({completed.length})</span></h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm"><thead>{tableHeaders}</thead><tbody>{completed.map(r => <AllRequestRow {...rowProps(r)} />)}</tbody></table>
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
