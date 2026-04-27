import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/Illustration'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import Badge from '../components/Badge'

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoWrench = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
)
const IcoChat = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
)
const IcoCalendar = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)
const IcoUser = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)
const IcoPencil = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)
const IcoTrash = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)
const IcoX = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const IcoChevronRight = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)
const IcoPaperclip = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
  </svg>
)
const IcoSearch = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const PRIORITY_DOT = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-400', low: 'bg-gray-300' }

// ── Star Picker ───────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
          className={`text-xl transition-transform hover:scale-110 cursor-pointer ${n <= (hovered || value) ? 'text-yellow-400' : 'text-gray-300'}`}>
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-gray-500">
          {['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][value]}
        </span>
      )}
    </div>
  )
}

// ── Attachment Preview ────────────────────────────────────────────────────────
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
      {isVideo && <video src={file.url} controls className="w-full max-h-40" />}
      {isAudio && (
        <div className="px-3 py-3">
          <p className="text-xs text-gray-500 mb-1 truncate">{file.original_name}</p>
          <audio src={file.url} controls className="w-full h-8" />
        </div>
      )}
      {!isImage && !isVideo && !isAudio && (
        <a href={file.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-3 py-3 text-xs text-indigo-600 hover:underline">
          <IcoPaperclip className="w-3 h-3" /> {file.original_name}
        </a>
      )}
      {onDelete && (
        <button onClick={() => onDelete(file.id)}
          className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
          <IcoX className="w-3 h-3" />
        </button>
      )}
      {isImage && <p className="text-xs text-gray-400 px-2 py-1 truncate">{file.original_name}</p>}
    </div>
  )
}

// ── Notes Thread ──────────────────────────────────────────────────────────────
function NotesThread({ job, fill = false }) {
  const jobId = job.id
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [agentReview, setAgentReview] = useState(undefined)
  const [reviewStars, setReviewStars] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const scrollRef = useRef(null)

  function loadAttachments() {
    api.get(`/uploads?entity_type=maintenance&entity_id=${jobId}`).then(r => setAttachments(r.data)).catch(() => {})
  }

  function fetchNotes() {
    api.get(`/maintenance/${jobId}/notes`).then(r => {
      setNotes(prev => (!prev || r.data.length !== prev.length) ? r.data : prev)
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
        fd.append('entity_type', 'maintenance'); fd.append('entity_id', jobId)
        fd.append('category', 'photo'); fd.append('file', file)
        await api.post('/uploads', fd)
      }
      loadAttachments()
    } finally { setUploading(false); e.target.value = '' }
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
    } finally { setSaving(false) }
  }

  async function submitReview(e) {
    e.preventDefault()
    if (!reviewStars) return
    setSavingReview(true)
    try {
      await api.post(`/maintenance/${jobId}/review`, { stars: reviewStars, comment: reviewComment.trim() || null })
      setAgentReview({ stars: reviewStars, comment: reviewComment.trim() || null })
    } finally { setSavingReview(false) }
  }

  if (notes === null) return <p className="text-xs text-gray-400 py-2">Loading…</p>

  return (
    <div className={fill ? 'flex flex-col h-full space-y-3' : 'space-y-3'}>
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map(f => <AttachmentPreview key={f.id} file={f} onDelete={deleteAttachment} />)}
        </div>
      )}
      <div ref={scrollRef} className={`space-y-3 pr-1 ${fill ? 'flex-1 overflow-y-auto' : 'max-h-72 overflow-y-auto'}`}>
        {notes.length === 0 && <p className="text-xs text-gray-400">No messages yet.</p>}
        {notes.map(n => (
          <div key={n.id} className={`flex gap-3 ${n.author_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
              n.author_type === 'agent' ? 'bg-indigo-600 text-white'
              : n.author_type === 'contractor' ? 'bg-orange-50 border border-orange-200 text-gray-800'
              : 'bg-violet-50 border border-violet-200 text-gray-800'
            }`}>
              <p className="font-medium text-xs mb-0.5 opacity-75">
                {n.author_type === 'contractor' ? '🔧 ' : n.author_type === 'tenant' ? '🏠 ' : ''}{n.author_name}
              </p>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs mt-1 opacity-60">
                {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input value={body} onChange={e => setBody(e.target.value)} placeholder="Add a message…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <label className={`cursor-pointer flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          title="Attach file">
          {uploading ? <span className="text-xs text-gray-400">…</span> : <IcoPaperclip className="w-4 h-4" />}
          <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFileChange} />
        </label>
        <button type="submit" disabled={saving || !body.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 cursor-pointer">
          Send
        </button>
      </form>
      {job.contractor_id && job.status === 'completed' && agentReview !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {agentReview ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Your rating</p>
              <div className="flex gap-0.5 items-center">
                {[1,2,3,4,5].map(n => <span key={n} className={`text-lg ${n <= agentReview.stars ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                <button onClick={() => setAgentReview(null)} className="ml-2 text-xs text-gray-400 hover:underline cursor-pointer">edit</button>
              </div>
              {agentReview.comment && <p className="text-xs text-gray-500 italic">"{agentReview.comment}"</p>}
            </div>
          ) : (
            <form onSubmit={submitReview} className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Rate this contractor</p>
              <StarPicker value={reviewStars} onChange={setReviewStars} />
              <input value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Optional comment…"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={savingReview || !reviewStars}
                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 cursor-pointer">
                {savingReview ? 'Saving…' : 'Save rating'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ── Maintenance Summary (CFO strip + status donut) ───────────────────────────
const STATUS_COLORS = { open: '#6366f1', in_progress: '#f59e0b', completed: '#22c55e', cancelled: '#9ca3af' }

function MaintenanceSummary({ requests }) {
  const totalJobs     = requests.length
  const totalInvoiced = requests.reduce((s, r) => s + (r.actual_cost || 0), 0)
  const totalPaid     = requests.reduce((s, r) => s + (r.total_paid || 0), 0)
  const totalOutstanding = totalInvoiced - totalPaid
  const totalQuoted   = requests.reduce((s, r) => s + (r.contractor_quote || 0), 0)

  const statusCounts = {
    open:        requests.filter(r => r.status === 'open').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed:   requests.filter(r => r.status === 'completed').length,
    cancelled:   requests.filter(r => r.status === 'cancelled').length,
  }
  const pieData = [
    { name: 'Open',        value: statusCounts.open },
    { name: 'In Progress', value: statusCounts.in_progress },
    { name: 'Completed',   value: statusCounts.completed },
    { name: 'Cancelled',   value: statusCounts.cancelled },
  ].filter(d => d.value > 0)
  const pieColors = pieData.map(d => STATUS_COLORS[d.name.toLowerCase().replace(' ', '_')])

  const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-5 flex flex-col sm:flex-row overflow-hidden">
      {/* CFO numbers */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 divide-y sm:divide-y-0">
        {[
          { label: 'Total jobs', value: totalJobs, mono: false },
          { label: 'Total quoted', value: `£${fmt(totalQuoted)}`, mono: true },
          { label: 'Total invoiced', value: `£${fmt(totalInvoiced)}`, mono: true },
          { label: 'Outstanding', value: `£${fmt(totalOutstanding)}`, mono: true, warn: totalOutstanding > 0 },
        ].map(({ label, value, mono, warn }) => (
          <div key={label} className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
            <p className={`text-lg font-bold ${warn ? 'text-amber-600' : 'text-gray-800'} ${mono ? 'font-mono' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Status donut */}
      <div className="flex items-center gap-4 px-6 py-4 border-t sm:border-t-0 sm:border-l border-gray-100">
        <ResponsiveContainer width={90} height={90}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
              {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1.5 min-w-[110px]">
          {[
            { key: 'open',        label: 'Open' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'completed',   label: 'Completed' },
            { key: 'cancelled',   label: 'Cancelled' },
          ].map(({ key, label }) => statusCounts[key] > 0 && (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[key] }} />
              <span>{label}</span>
              <span className="ml-auto font-semibold text-gray-800">{statusCounts[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── KPI Bar ───────────────────────────────────────────────────────────────────
function KpiBar({ requests, activeFilter, onFilter }) {
  const active = r => r.status !== 'completed' && r.status !== 'cancelled'
  const tiles = [
    {
      key: 'urgent',
      label: 'High priority',
      value: requests.filter(r => active(r) && (r.priority === 'urgent' || r.priority === 'high')).length,
      dot: 'bg-red-400', ring: 'border-red-300 bg-red-50 text-red-700',
    },
    {
      key: 'unassigned',
      label: 'Unassigned',
      value: requests.filter(r => active(r) && !r.contractor_id).length,
      dot: 'bg-amber-400', ring: 'border-amber-300 bg-amber-50 text-amber-700',
    },
    {
      key: 'quote_pending',
      label: 'Awaiting quote',
      value: requests.filter(r => r.quote_status === 'pending').length,
      dot: 'bg-orange-400', ring: 'border-orange-300 bg-orange-50 text-orange-700',
    },
    {
      key: 'overdue',
      label: 'Open > 14 days',
      value: requests.filter(r => active(r) && daysSince(r.created_at) > 14).length,
      dot: 'bg-rose-400', ring: 'border-rose-300 bg-rose-50 text-rose-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {tiles.map(t => (
        <button key={t.key} onClick={() => onFilter(activeFilter === t.key ? null : t.key)}
          className={`text-left rounded-xl border px-4 py-3 transition-all duration-200 cursor-pointer hover:shadow-sm ${
            activeFilter === t.key ? `${t.ring} shadow-sm` : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.dot}`} />
            <span className="text-xs text-gray-500 font-medium">{t.label}</span>
          </div>
          <p className={`text-2xl font-bold ${activeFilter === t.key ? '' : 'text-gray-900'}`}>{t.value}</p>
        </button>
      ))}
    </div>
  )
}

// ── Job Row ───────────────────────────────────────────────────────────────────
function JobRow({ req, onOpen }) {
  const days = daysSince(req.created_at)
  const isActive = req.status !== 'completed' && req.status !== 'cancelled'
  const stale = isActive && (req.priority === 'urgent' || req.priority === 'high') && days > 7
  const veryStale = isActive && (req.priority === 'urgent' || req.priority === 'high') && days > 14

  return (
    <tr onClick={() => onOpen(req)}
      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group ${req.has_tenant_note ? 'border-l-2 border-l-violet-400' : ''}`}>
      {/* Job */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[req.priority] || 'bg-gray-300'}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-tight">{req.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{req.unit_name}</p>
          </div>
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Badge value={req.status} />
      </td>
      {/* Contractor */}
      <td className="px-4 py-3 text-xs">
        {req.contractor_id ? (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              req.contractor_accepted === true ? 'bg-green-500'
              : req.contractor_accepted === false ? 'bg-red-500'
              : 'bg-amber-400'
            }`} />
            <span className="text-gray-700 truncate max-w-[140px]">{req.contractor_name}</span>
          </div>
        ) : (
          <span className="text-amber-600 font-medium">Unassigned</span>
        )}
      </td>
      {/* Quote */}
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {req.contractor_quote != null ? (
          <span className={`font-medium ${
            req.quote_status === 'approved' ? 'text-green-600'
            : req.quote_status === 'rejected' ? 'text-red-500'
            : 'text-amber-600'
          }`}>
            £{req.contractor_quote}
            {req.quote_status === 'pending' && (
              <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">review</span>
            )}
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      {/* Invoice */}
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {req.actual_cost != null ? (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-700">£{req.actual_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {req.invoice_paid
              ? <span className="text-green-600 font-semibold">✓</span>
              : req.total_paid > 0
                ? <span className="text-amber-600 text-[10px] font-medium">part</span>
                : <span className="text-amber-500 text-[10px]">unpaid</span>
            }
          </div>
        ) : <span className="text-gray-300">—</span>}
      </td>
      {/* Age */}
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        <span className={veryStale ? 'text-red-600 font-semibold' : stale ? 'text-amber-600 font-medium' : 'text-gray-400'}>
          {days}d
        </span>
      </td>
      {/* Unread indicator + chevron */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {req.has_tenant_note && (
            <span className="flex items-center gap-1 text-xs text-violet-600 font-semibold bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              <IcoChat className="w-3 h-3" />
              {req.notes_count > 0 ? req.notes_count : ''}
            </span>
          )}
          <IcoChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </td>
    </tr>
  )
}

// ── Job Drawer ────────────────────────────────────────────────────────────────
function PaymentsBlock({ job, onAction }) {
  const [payments, setPayments] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payRef, setPayRef] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get(`/maintenance/${job.id}/payments`).then(r => setPayments(r.data)).catch(() => setPayments([]))
  }, [job.id])

  useEffect(() => { load() }, [load])

  const totalPaid = payments ? payments.reduce((s, p) => s + p.amount, 0) : (job.total_paid || 0)
  const balance = Math.max(0, (job.actual_cost || 0) - totalPaid)
  const paidFull = job.actual_cost != null && balance <= 0.005

  async function addPayment(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/maintenance/${job.id}/payments`, { amount: parseFloat(payAmount), paid_date: payDate, ref: payRef || null })
      setShowForm(false); setPayAmount(''); setPayRef('')
      load(); onAction()
    } finally { setSaving(false) }
  }

  async function deletePayment(pid) {
    await api.delete(`/maintenance/${job.id}/payments/${pid}`)
    load(); onAction()
  }

  if (!job.actual_cost) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Invoice amount</span>
        <span className="text-sm font-semibold text-gray-800">£{job.actual_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      {job.invoice_file_url && (
        <a href={job.invoice_file_url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
          <IcoPaperclip className="w-3 h-3" />
          {job.invoice_file_name || 'View invoice'}
        </a>
      )}

      {payments !== null && payments.length > 0 && (
        <div className="space-y-1 pt-1">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="font-medium text-gray-700">£{p.amount.toFixed(2)}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span>{new Date(p.paid_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {p.ref && <><span className="text-gray-400 mx-1">·</span><span className="text-gray-500">{p.ref}</span></>}
              <button onClick={() => deletePayment(p.id)} className="ml-auto pl-2 text-gray-300 hover:text-red-500 cursor-pointer transition-colors">
                <IcoX className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {paidFull ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          ✓ Paid in full
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
            Balance: £{balance.toFixed(2)}
          </span>
          {!showForm && (
            <button onClick={() => { setPayAmount(balance.toFixed(2)); setShowForm(true) }}
              className="text-xs text-indigo-600 hover:underline cursor-pointer font-medium">
              + Add payment
            </button>
          )}
        </div>
      )}

      {showForm && !paidFull && (
        <form onSubmit={addPayment} className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2 mt-1">
          <p className="text-xs font-semibold text-indigo-800">Record payment</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Amount (£)</label>
              <input type="number" step="0.01" min="0.01" required value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Date</label>
              <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Ref (optional)</label>
            <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Bank ref / cheque no."
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-2 pt-0.5">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving…' : 'Record payment'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function JobDrawer({ job, contractors, onClose, onAction }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [contractorId, setContractorId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [scheduleEdit, setScheduleEdit] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(job.scheduled_date || '')
  const [showDiffDate, setShowDiffDate] = useState(false)
  const [diffDate, setDiffDate] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: job.title || '', description: job.description || '', priority: job.priority || 'medium' })
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  useEffect(() => {
    setEditForm({ title: job.title || '', description: job.description || '', priority: job.priority || 'medium' })
    setScheduledDate(job.scheduled_date || '')
    setAssignOpen(false)
    setScheduleEdit(false)
    setShowDiffDate(false)
    setDiffDate('')
    setEditOpen(false)
    setConfirmDelete(false)
  }, [job.id])

  async function changeStatus(newStatus) {
    setStatusChanging(true)
    try { await api.put(`/maintenance/${job.id}`, { ...job, status: newStatus }); onAction() }
    finally { setStatusChanging(false) }
  }

  async function handleAssign() {
    if (!contractorId) return
    setAssigning(true)
    try { await api.put(`/contractors/assign/${job.id}`, { contractor_id: parseInt(contractorId) }); onAction(); setAssignOpen(false) }
    finally { setAssigning(false) }
  }

  async function saveEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    try {
      await api.put(`/maintenance/${job.id}`, {
        unit_id: job.unit_id, title: editForm.title, description: editForm.description,
        priority: editForm.priority, status: job.status, reported_by: job.reported_by,
        assigned_to: job.assigned_to, contractor_id: job.contractor_id,
        estimated_cost: job.estimated_cost, actual_cost: job.actual_cost, invoice_ref: job.invoice_ref,
      })
      onAction(); setEditOpen(false)
    } finally { setEditSaving(false) }
  }

  async function saveScheduledDate() {
    await api.post(`/maintenance/${job.id}/scheduled-date`, { scheduled_date: scheduledDate || null })
    onAction(); setScheduleEdit(false)
  }

  async function quoteDecision(decision) {
    await api.post(`/maintenance/${job.id}/quote-decision`, { decision }); onAction()
  }

  async function proposedDateDecision(decision) {
    await api.post(`/maintenance/${job.id}/proposed-date-decision`, { decision }); onAction()
  }

  async function proposeDifferentDate() {
    if (!diffDate) return
    await api.post(`/maintenance/${job.id}/propose-date`, { proposed_date: diffDate })
    onAction(); setShowDiffDate(false); setDiffDate('')
  }

  async function handleDelete() {
    await api.delete(`/maintenance/${job.id}`); onClose(); onAction()
  }

  const NEXT_STATUS = { open: 'in_progress', in_progress: 'completed' }
  const NEXT_LABEL = { open: 'Mark in progress', in_progress: 'Mark complete' }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[job.priority] || 'bg-gray-300'}`} />
                <Badge value={job.priority} />
                <Badge value={job.status} />
              </div>
              <h3 className="font-semibold text-gray-900 text-base leading-snug">{job.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{job.unit_name}</p>
            </div>
            <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer p-1 -mr-1 -mt-1">
              <IcoX className="w-5 h-5" />
            </button>
          </div>
          {job.tenant_satisfied === false && job.tenant_feedback && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <strong>Tenant complaint:</strong> "{job.tenant_feedback}"
            </div>
          )}
          {NEXT_STATUS[job.status] && (
            <button onClick={() => changeStatus(NEXT_STATUS[job.status])} disabled={statusChanging}
              className="mt-3 w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
              {statusChanging ? '…' : NEXT_LABEL[job.status]}
            </button>
          )}
          {(job.status === 'completed' || job.status === 'cancelled') && (
            <button onClick={() => changeStatus('open')} disabled={statusChanging}
              className="mt-3 w-full text-xs font-semibold bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
              {statusChanging ? '…' : 'Reopen job'}
            </button>
          )}
        </div>

        {/* Two-column body */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left column: Details, Contractor, Financials, Delete */}
          <div className="w-[45%] border-r border-gray-100 overflow-y-auto divide-y divide-gray-100 flex-shrink-0">

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>
              {!editOpen && (
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors">
                  <IcoPencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {editOpen ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={editSaving}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditOpen(false)}
                    className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {job.description && <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div>
                    <p className="text-gray-400 mb-0.5">Reported by</p>
                    {job.reported_by_tenant_id
                      ? <Link to={`/tenants/${job.reported_by_tenant_id}`} onClick={onClose}
                          className="text-indigo-600 hover:underline font-medium">{job.reported_by || '—'}</Link>
                      : <p className="text-gray-700 font-medium">{job.reported_by || '—'}</p>}
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Opened</p>
                    <p className="text-gray-700 font-medium">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  {job.tenant_satisfied === true && (
                    <div className="col-span-2 text-green-600 font-medium">Tenant confirmed resolved</div>
                  )}
                </div>
                {/* Scheduled date — hide while agent is deciding on the date in step 2 */}
                {(job.scheduled_date || !job.contractor_id || job.quote_status === 'approved') &&
                  !(job.quote_status === 'approved' && job.proposed_date && job.proposed_date_status === 'pending') && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Scheduled date</p>
                    {scheduleEdit ? (
                      <div className="flex items-center gap-2">
                        <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={saveScheduledDate}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 cursor-pointer">Set</button>
                        <button onClick={() => setScheduleEdit(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setScheduleEdit(true)}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline cursor-pointer">
                        <IcoCalendar className="w-3.5 h-3.5" />
                        {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set date…'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Contractor */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contractor</p>
            {job.contractor_id ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <IcoWrench className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <Link to={`/contractors?id=${job.contractor_id}`} onClick={onClose}
                    className="text-sm font-medium text-indigo-600 hover:underline">{job.contractor_name}</Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    job.contractor_accepted === true ? 'bg-green-50 text-green-700'
                    : job.contractor_accepted === false ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                  }`}>
                    {job.contractor_accepted === true ? 'Accepted' : job.contractor_accepted === false ? 'Declined' : 'Awaiting response'}
                  </span>
                  {job.contractor_viewed_at && job.contractor_accepted === null && (
                    <span className="text-xs text-gray-400">Viewed</span>
                  )}
                </div>
                {/* Quote + Date accordion */}
                {job.contractor_quote != null && (
                  <div className="space-y-2">
                    {/* Step 1 — Quote */}
                    <div className={`rounded-xl border overflow-hidden ${
                      job.quote_status === 'approved' ? 'border-green-200 bg-green-50'
                      : job.quote_status === 'rejected' ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0 ${
                          job.quote_status === 'approved' ? 'bg-green-500 text-white'
                          : job.quote_status === 'rejected' ? 'bg-red-400 text-white'
                          : 'bg-indigo-600 text-white'
                        }`}>
                          {job.quote_status === 'approved' ? '✓' : job.quote_status === 'rejected' ? '✗' : '1'}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 flex-1">
                          Quote — <span className="font-bold">£{job.contractor_quote}</span>
                        </span>
                        <span className={`text-xs font-medium ${
                          job.quote_status === 'approved' ? 'text-green-700'
                          : job.quote_status === 'rejected' ? 'text-red-600'
                          : 'text-amber-600'
                        }`}>
                          {job.quote_status === 'approved' ? 'Approved' : job.quote_status === 'rejected' ? 'Rejected' : 'Awaiting decision'}
                        </span>
                      </div>
                      {job.quote_status === 'pending' && (
                        <div className="px-4 pb-3 space-y-2.5 border-t border-gray-100">
                          {job.quote_file_url && (
                            <a href={job.quote_file_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:underline font-medium mt-2.5">
                              <IcoPaperclip className="w-3 h-3" /> {job.quote_file_name || 'View quote document'}
                            </a>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => quoteDecision('approved')}
                              className="flex-1 text-xs bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold cursor-pointer">
                              Approve quote
                            </button>
                            <button onClick={() => quoteDecision('rejected')}
                              className="flex-1 text-xs bg-white border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50 font-semibold cursor-pointer">
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2 — Date (opens after quote approved, when proposed date pending) */}
                    {job.quote_status === 'approved' && job.proposed_date && job.proposed_date_status === 'pending' && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0 bg-indigo-600 text-white">2</span>
                          <span className="text-xs font-semibold text-gray-700 flex-1">{job.scheduled_date ? 'Reschedule request' : 'Confirm date'}</span>
                          <span className="text-xs text-amber-700 font-medium">
                            {new Date(job.proposed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="px-4 pb-3 border-t border-amber-100 space-y-2.5">
                          <p className="text-xs text-gray-500 pt-2.5">
                            Contractor {job.scheduled_date ? 'requests reschedule to' : 'proposes'} <strong>{new Date(job.proposed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                          </p>
                          {!showDiffDate ? (
                            <div className="flex gap-2">
                              <button onClick={() => proposedDateDecision('accepted')}
                                className="flex-1 text-xs bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold cursor-pointer">
                                Accept this date
                              </button>
                              <button onClick={() => setShowDiffDate(true)}
                                className="flex-1 text-xs bg-white border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50 font-semibold cursor-pointer">
                                Propose different
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input type="date" value={diffDate} onChange={e => setDiffDate(e.target.value)}
                                min={new Date().toISOString().slice(0, 10)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <div className="flex gap-2">
                                <button onClick={proposeDifferentDate} disabled={!diffDate}
                                  className="flex-1 text-xs bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-semibold cursor-pointer disabled:opacity-50">
                                  Send to contractor
                                </button>
                                <button onClick={() => { setShowDiffDate(false); setDiffDate('') }}
                                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-600 font-medium">No contractor assigned</p>
            )}
            {/* Assign / Reassign — hidden once quote is approved */}
            {!assignOpen && job.quote_status !== 'approved' ? (
              <button onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline cursor-pointer">
                <IcoUser className="w-3.5 h-3.5" />
                {job.contractor_id ? 'Reassign contractor' : 'Assign contractor'}
              </button>
            ) : (
              <div className="flex gap-2">
                <select value={contractorId} onChange={e => setContractorId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                  <option value="">Select contractor…</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}{c.trade ? ` — ${c.trade}` : ''}{c.avg_rating ? ` ★${c.avg_rating}` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={handleAssign} disabled={assigning || !contractorId}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {assigning ? '…' : 'Assign'}
                </button>
                <button onClick={() => setAssignOpen(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
              </div>
            )}
          </div>

          {/* Financials */}
          {(job.estimated_cost != null || job.actual_cost != null || job.invoice_ref || job.contractor_quote != null) && (
            <div className="px-5 py-4 space-y-2.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Financials</p>
              {job.contractor_quote != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Quoted by contractor</span>
                  <span className={`font-semibold ${
                    job.quote_status === 'approved' ? 'text-green-700'
                    : job.quote_status === 'rejected' ? 'text-red-500'
                    : 'text-amber-700'
                  }`}>
                    £{job.contractor_quote.toLocaleString()}
                    <span className="ml-1.5 text-xs font-normal">
                      {job.quote_status === 'approved' ? '✓ approved' : job.quote_status === 'rejected' ? '✗ rejected' : '— awaiting your approval'}
                    </span>
                  </span>
                </div>
              )}
              {job.estimated_cost != null && job.actual_cost == null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Estimated cost</span>
                  <span className="font-semibold text-gray-800">£{job.estimated_cost.toLocaleString()}</span>
                </div>
              )}
              {job.invoice_ref && (
                <p className="text-xs text-gray-400">Invoice ref: {job.invoice_ref}</p>
              )}
              <PaymentsBlock job={job} onAction={onAction} />
            </div>
          )}

          {/* Delete */}
          <div className="px-5 py-4">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 cursor-pointer">
                <IcoTrash className="w-3.5 h-3.5" /> Delete this job
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-xs text-red-600 font-medium">Delete permanently?</p>
                <button onClick={handleDelete}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 cursor-pointer">Delete</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
              </div>
            )}
          </div>

          </div>{/* end left column */}

          {/* Right column: Messages */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <IcoChat className="w-3.5 h-3.5" /> Messages
                {job.notes_count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${job.has_tenant_note ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                    {job.notes_count}
                  </span>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col">
              <NotesThread job={job} fill />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── New Request Modal ─────────────────────────────────────────────────────────
function NewRequestModal({ properties, contractors, currentUser, tenantUnit, tenantIdFilter, onClose, onSaved }) {
  const [form, setForm] = useState({ unit_id: tenantUnit?.unit_id || '', title: '', description: '', priority: 'medium', contractor_id: '' })
  const [formFiles, setFormFiles] = useState([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async e => {
    e.preventDefault()
    const uid = parseInt(form.unit_id)
    if (!uid) { setFormError('Please select a unit.'); return }
    if (saving) return
    setSaving(true); setFormError('')
    try {
      const res = await api.post('/maintenance', {
        unit_id: uid, title: form.title, description: form.description,
        priority: form.priority, reported_by: currentUser?.full_name || '',
        reported_by_tenant_id: tenantIdFilter || null,
      })
      if (form.contractor_id) {
        await api.put(`/contractors/assign/${res.data.id}`, { contractor_id: parseInt(form.contractor_id) })
      }
      for (const file of formFiles) {
        const fd = new FormData()
        fd.append('entity_type', 'maintenance'); fd.append('entity_id', res.data.id)
        fd.append('category', 'photo'); fd.append('file', file)
        await api.post('/uploads', fd)
      }
      onSaved(); onClose()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">New Maintenance Request</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><IcoX className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          {tenantUnit ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-700 font-medium">{tenantUnit.label}</div>
          ) : (
            <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" required>
              <option value="">Select unit…</option>
              {properties.map(p => (
                <optgroup key={p.id} label={p.name}>
                  {[...(p.units || [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                    .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <select value={form.contractor_id} onChange={e => setForm({ ...form, contractor_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <option value="">Assign contractor (optional)</option>
              {contractors.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}{c.trade ? ` — ${c.trade}` : ''}{c.avg_rating ? ` ★${c.avg_rating}` : ''}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
            <IcoPaperclip className="w-4 h-4 flex-shrink-0" />
            <span>{formFiles.length > 0 ? `${formFiles.length} file${formFiles.length > 1 ? 's' : ''} selected` : 'Attach photos, videos or voice notes (optional)'}</span>
            <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={e => setFormFiles(Array.from(e.target.files))} />
          </label>
          {formFiles.length > 0 && (
            <ul className="space-y-0.5">
              {formFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFormFiles(prev => prev.filter((_, j) => j !== i))}
                    className="ml-2 text-gray-300 hover:text-red-400 cursor-pointer"><IcoX className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          )}
          {currentUser && <p className="text-xs text-gray-400">Reporting as <strong>{currentUser.full_name}</strong></p>}
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving…' : 'Create job'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Payments view ─────────────────────────────────────────────────────────────
function PaymentsView({ requests, onRefresh }) {
  const outstanding = requests.filter(r => r.actual_cost != null && !r.invoice_paid)
  const paid        = requests.filter(r => r.invoice_paid)
  const [selected, setSelected] = useState({})
  const [payDate, setPayDate]   = useState(new Date().toISOString().slice(0, 10))
  const [payRef,  setPayRef]    = useState('')
  const [saving,  setSaving]    = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const selectedIds  = Object.keys(selected).filter(k => selected[k]).map(Number)
  const selectedJobs = outstanding.filter(r => selectedIds.includes(r.id))
  const bulkTotal    = selectedJobs.reduce((s, r) => s + Math.max(0, r.actual_cost - (r.total_paid || 0)), 0)

  function toggleAll(e) {
    const next = {}
    outstanding.forEach(r => { next[r.id] = e.target.checked })
    setSelected(next)
  }

  async function paySelected() {
    if (selectedIds.length === 0) return
    setSaving(true)
    try {
      await Promise.all(selectedJobs.map(job => {
        const amount = Math.max(0, job.actual_cost - (job.total_paid || 0))
        if (amount <= 0) return Promise.resolve()
        return api.post(`/maintenance/${job.id}/payments`, { amount, paid_date: payDate, ref: payRef || null })
      }))
      setSelected({}); setShowBulk(false); onRefresh()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Outstanding */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Outstanding invoices <span className="ml-1.5 text-xs text-gray-400 font-normal">{outstanding.length}</span></p>
          {selectedIds.length > 0 && !showBulk && (
            <button onClick={() => setShowBulk(true)}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 cursor-pointer">
              Pay {selectedIds.length} selected — £{bulkTotal.toFixed(2)}
            </button>
          )}
        </div>

        {showBulk && (
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-200 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Payment date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Reference (optional)</label>
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="BACS ref, cheque no."
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
            </div>
            <button onClick={paySelected} disabled={saving}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Paying…' : `Confirm — £${bulkTotal.toFixed(2)}`}
            </button>
            <button onClick={() => setShowBulk(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
          </div>
        )}

        {outstanding.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No outstanding invoices</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5 w-8">
                  <input type="checkbox" onChange={toggleAll}
                    checked={selectedIds.length === outstanding.length && outstanding.length > 0}
                    className="cursor-pointer" />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Job</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Contractor</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.map(r => {
                const tp = r.total_paid || 0
                const bal = Math.max(0, r.actual_cost - tp)
                return (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected[r.id] ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={!!selected[r.id]} onChange={e => setSelected(s => ({ ...s, [r.id]: e.target.checked }))}
                        className="cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800 text-xs">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.unit_name}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{r.contractor_name || '—'}</td>
                    <td className="px-3 py-3 text-right text-xs font-medium text-gray-800">£{r.actual_cost.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-xs text-green-700">{tp > 0 ? `£${tp.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        £{bal.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paid */}
      {paid.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Paid <span className="ml-1.5 text-xs text-gray-400 font-normal">{paid.length}</span></p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {paid.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-gray-700">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.unit_name}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.contractor_name || '—'}</td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-700">{r.actual_cost != null ? `£${r.actual_cost.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-xs text-green-700 font-medium">✓ Paid</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }

export default function Maintenance() {
  const [requests, setRequests] = useState([])
  const [properties, setProperties] = useState([])
  const [contractors, setContractors] = useState([])
  const [drawerJob, setDrawerJob] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [tenantUnit, setTenantUnit] = useState(null)
  const [mainView, setMainView] = useState('jobs') // 'jobs' | 'payments'
  const [searchParams, setSearchParams] = useSearchParams()
  const tenantIdFilter = searchParams.get('tenant_id') ? parseInt(searchParams.get('tenant_id')) : null
  const unitIdFilter = searchParams.get('unit_id') ? parseInt(searchParams.get('unit_id')) : null
  const [tenantNameFilter, setTenantNameFilter] = useState('')
  const [unitNameFilter, setUnitNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [kpiFilter, setKpiFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ col: 'age', dir: 'desc' })
  const drawerJobRef = useRef(null)
  drawerJobRef.current = drawerJob

  function loadRequests() {
    api.get('/maintenance').then(r => {
      setRequests(r.data)
      if (drawerJobRef.current) {
        const updated = r.data.find(x => x.id === drawerJobRef.current.id)
        setDrawerJob(updated || null)
      }
    })
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
      api.get(`/tenants/${tenantIdFilter}/profile`).then(r => {
        setTenantNameFilter(r.data.full_name)
        const active = r.data.leases?.find(l => l.status === 'active') || r.data.leases?.[0]
        if (active?.unit_id) setTenantUnit({ unit_id: active.unit_id, label: `${active.property} · ${active.unit}` })
      }).catch(() => {})
    } else { setTenantNameFilter(''); setTenantUnit(null) }
  }, [tenantIdFilter])

  // Reset kpiFilter when switching statusFilter so there are no confusing empty states
  function handleStatusFilter(key) {
    setStatusFilter(key)
    setKpiFilter(null)
  }

  function handleKpiFilter(key) {
    setKpiFilter(key)
    if (key) setStatusFilter('all')
  }

  function toggleSort(col) {
    setSort(s => ({ col, dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  }

  function sortRows(rows) {
    return [...rows].sort((a, b) => {
      let av, bv
      if (sort.col === 'priority') { av = PRIORITY_ORDER[a.priority] ?? 4; bv = PRIORITY_ORDER[b.priority] ?? 4 }
      else if (sort.col === 'age') { av = a.created_at || ''; bv = b.created_at || '' }
      else { av = a[sort.col] || ''; bv = b[sort.col] || '' }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }

  const isActive = r => r.status !== 'completed' && r.status !== 'cancelled'

  const statusCounts = {
    all: requests.length,
    open: requests.filter(r => r.status === 'open').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  }

  const filtered = sortRows(
    requests
      .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
      .filter(r => !tenantIdFilter || r.reported_by_tenant_id === tenantIdFilter)
      .filter(r => !unitIdFilter || r.unit_id === unitIdFilter)
      .filter(r => {
        if (!search) return true
        const q = search.toLowerCase()
        return r.title?.toLowerCase().includes(q) || r.unit_name?.toLowerCase().includes(q) || r.reported_by?.toLowerCase().includes(q)
      })
      .filter(r => {
        if (!kpiFilter) return true
        if (kpiFilter === 'urgent') return isActive(r) && (r.priority === 'urgent' || r.priority === 'high')
        if (kpiFilter === 'unassigned') return isActive(r) && !r.contractor_id
        if (kpiFilter === 'quote_pending') return r.quote_status === 'pending'
        if (kpiFilter === 'overdue') return isActive(r) && daysSince(r.created_at) > 14
        return true
      })
  )

  function SortTh({ col, label }) {
    return (
      <th onClick={() => toggleSort(col)}
        className="text-left px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-800 whitespace-nowrap text-xs uppercase tracking-wide text-gray-500">
        {label} {sort.col === col ? (sort.dir === 'asc' ? '▲' : '▼') : <span className="text-gray-200">↕</span>}
      </th>
    )
  }

  const outstandingCount = requests.filter(r => r.actual_cost != null && !r.invoice_paid).length

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Track and resolve property issues" />

      <KpiBar requests={requests} activeFilter={kpiFilter} onFilter={handleKpiFilter} />

      <MaintenanceSummary requests={requests} />

      {/* View toggle + controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* View tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          <button onClick={() => setMainView('jobs')}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${mainView === 'jobs' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Jobs
          </button>
          <button onClick={() => setMainView('payments')}
            className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${mainView === 'payments' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Payments
            {outstandingCount > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${mainView === 'payments' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                {outstandingCount}
              </span>
            )}
          </button>
        </div>

        {mainView === 'jobs' && <>
        <div className="relative flex-1 min-w-[180px]">
          <IcoSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, units, tenants…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => handleStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                statusFilter === key && !kpiFilter
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
              }`}>
              {label}
              <span className={`ml-1 ${statusFilter === key && !kpiFilter ? 'text-indigo-200' : 'text-gray-400'}`}>
                {statusCounts[key]}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap">
          + New Request
        </button>
        </>}
      </div>

      {mainView === 'payments' ? (
        <PaymentsView requests={requests} onRefresh={loadRequests} />
      ) : (
        <>
        {/* Context filter banner */}
        {(tenantIdFilter || unitIdFilter) && (
          <div className="mb-4 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5 text-sm text-indigo-700">
            <span>
              {tenantIdFilter && <>Jobs for <strong>{tenantNameFilter}</strong></>}
              {unitIdFilter && <>Jobs for <strong>{unitNameFilter}</strong></>}
            </span>
            <button onClick={() => setSearchParams({})} className="ml-auto text-xs text-indigo-500 hover:underline cursor-pointer">
              Clear filter
            </button>
          </div>
        )}

        {/* Active KPI filter indicator */}
        {kpiFilter && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-400">Filtered by KPI:</span>
            <span className="font-medium">
              {kpiFilter === 'urgent' ? 'High priority' : kpiFilter === 'unassigned' ? 'Unassigned' : kpiFilter === 'quote_pending' ? 'Awaiting quote' : 'Open > 14 days'}
            </span>
            <button onClick={() => setKpiFilter(null)} className="ml-1 text-xs text-indigo-500 hover:underline cursor-pointer">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <IcoWrench className="w-6 h-6 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">No jobs found</p>
              <p className="text-sm mt-1">{search ? 'Try a different search term' : 'All clear!'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[580px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <SortTh col="title" label="Job" />
                    <SortTh col="status" label="Status" />
                    <SortTh col="contractor_name" label="Contractor" />
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Quote</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Invoice</th>
                    <SortTh col="age" label="Age" />
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(req => (
                    <JobRow key={req.id} req={req} onOpen={setDrawerJob} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}

      {drawerJob && (
        <JobDrawer job={drawerJob} contractors={contractors} onClose={() => setDrawerJob(null)} onAction={loadRequests} />
      )}

      {showForm && (
        <NewRequestModal
          properties={properties} contractors={contractors} currentUser={currentUser}
          tenantUnit={tenantUnit} tenantIdFilter={tenantIdFilter}
          onClose={() => setShowForm(false)} onSaved={loadRequests}
        />
      )}
    </div>
  )
}
