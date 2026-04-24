import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
}

function Badge({ value }) {
  if (!value) return null
  const cls = STATUS_COLORS[value] || 'bg-gray-100 text-gray-600'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{value.replace(/_/g, ' ')}</span>
}

function Stars({ rating, count }) {
  if (rating == null) return <span className="text-xs text-gray-400">No reviews yet</span>
  const full = Math.round(rating)
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <span key={n} className={`text-lg ${n <= full ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
        ))}
      </span>
      <span className="font-semibold text-gray-800">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({count} review{count !== 1 ? 's' : ''})</span>
    </div>
  )
}

// Mini chat thread with the contractor
function ContractorChat({ contractorId, contractorName }) {
  const [msgs, setMsgs] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get(`/contractors/${contractorId}/messages`).then(r => setMsgs(r.data)).catch(() => setMsgs([]))
    const iv = setInterval(() => {
      api.get(`/contractors/${contractorId}/messages`).then(r => setMsgs(r.data)).catch(() => {})
    }, 6000)
    return () => clearInterval(iv)
  }, [contractorId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    try {
      const r = await api.post(`/contractors/${contractorId}/messages`, { body: input.trim() })
      setMsgs(prev => [...(prev || []), r.data])
      setInput('')
    } catch (_) {}
    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: 400 }}>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Messages with {contractorName}</p>
        <p className="text-xs text-gray-400">Messages appear in the contractor portal if enabled</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs === null && <p className="text-xs text-gray-400 text-center mt-6">Loading…</p>}
        {msgs?.length === 0 && <p className="text-xs text-gray-400 text-center mt-6">No messages yet.</p>}
        {msgs?.map(m => {
          const isMe = m.sender_type === 'agent'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-orange-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{m.sender_name}</p>}
                <p>{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-orange-200' : 'text-gray-400'}`}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 px-4 py-3 border-t border-gray-100">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button type="submit" disabled={sending || !input.trim()}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
          Send
        </button>
      </form>
    </div>
  )
}

export default function ContractorDetail() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [portalModal, setPortalModal] = useState(false)
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')
  const [jobFilter, setJobFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('jobs')
  const photoRef = useRef()

  useEffect(() => {
    api.get(`/contractors/${id}/profile`)
      .then(r => setProfile(r.data))
      .catch(() => setError('Contractor not found'))
  }, [id])

  function startEdit() {
    setEditForm({
      full_name: profile.full_name,
      company_name: profile.company_name || '',
      contact_name: profile.contact_name || '',
      trade: profile.trade || '',
      email: profile.email || '',
      phone: profile.phone || '',
      notes: profile.notes || '',
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSavingEdit(true)
    try {
      await api.put(`/contractors/${id}`, { ...editForm, avatar_url: profile.avatar_url })
      setProfile(p => ({ ...p, ...editForm }))
      setEditing(false)
    } finally { setSavingEdit(false) }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('entity_type', 'contractor')
      fd.append('entity_id', id)
      fd.append('category', 'photo')
      fd.append('file', file)
      const up = await api.post('/uploads', fd)
      const url = up.data.url
      await api.put(`/contractors/${id}`, { ...profile, avatar_url: url })
      setProfile(p => ({ ...p, avatar_url: url }))
    } finally { setUploadingPhoto(false); e.target.value = '' }
  }

  async function enablePortal(e) {
    e.preventDefault()
    try {
      await api.post(`/contractor/enable/${id}`, { password: portalPw })
      setPortalMsg(`Portal enabled. ${profile.email} can log in at /contractor/login`)
      setProfile(p => ({ ...p, portal_enabled: true }))
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  async function disablePortal() {
    await api.post(`/contractor/disable/${id}`)
    setPortalModal(false)
    setProfile(p => ({ ...p, portal_enabled: false }))
  }

  if (error) return (
    <div className="p-8">
      <p className="text-red-500">{error}</p>
      <Link to="/contractors" className="text-indigo-600 text-sm hover:underline mt-2 block">← Back to Contractors</Link>
    </div>
  )
  if (!profile) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  const jobs = profile.jobs || []
  const filteredJobs = jobFilter === 'all' ? jobs
    : jobFilter === 'active' ? jobs.filter(j => j.status === 'open' || j.status === 'in_progress')
    : jobs.filter(j => j.status === jobFilter)

  const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length
  const completedJobs = jobs.filter(j => j.status === 'completed').length
  const totalRevenue = jobs.filter(j => j.actual_cost).reduce((s, j) => s + (j.actual_cost || 0), 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back link */}
      <Link to="/contractors" className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mb-6">
        ← Back to Contractors
      </Link>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="relative shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              : <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-2xl border-2 border-gray-200">
                  {profile.full_name?.[0]}
                </div>
            }
            <button onClick={() => photoRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 text-sm">
              {uploadingPhoto ? '…' : '📷'}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
              {profile.company_name && <span className="text-gray-500 text-sm">· {profile.company_name}</span>}
              {profile.trade && (
                <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{profile.trade}</span>
              )}
              {profile.portal_enabled && (
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Portal Active</span>
              )}
            </div>
            <Stars rating={profile.avg_rating} count={profile.review_count} />
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
              {profile.email && <span>✉️ {profile.email}</span>}
              {profile.phone && <span>📞 {profile.phone}</span>}
              {profile.contact_name && <span>👤 Contact: {profile.contact_name}</span>}
              {profile.created_at && <span className="text-gray-400 text-xs">Member since {fmtDate(profile.created_at)}</span>}
            </div>
            {profile.notes && <p className="mt-2 text-sm text-gray-500 italic">{profile.notes}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap shrink-0">
            <button onClick={startEdit}
              className="border border-gray-200 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600">
              Edit
            </button>
            <button onClick={() => { setPortalModal(true); setPortalPw(''); setPortalMsg('') }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium ${profile.portal_enabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
              {profile.portal_enabled ? 'Disable Portal' : 'Enable Portal'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'text-gray-900' },
          { label: 'Active', value: activeJobs, color: 'text-blue-600' },
          { label: 'Completed', value: completedJobs, color: 'text-green-600' },
          { label: 'Total Revenue', value: `£${totalRevenue.toLocaleString()}`, color: 'text-indigo-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'jobs', label: `Jobs (${jobs.length})` },
          { key: 'reviews', label: `Reviews (${profile.reviews?.length || 0})` },
          { key: 'messages', label: 'Messages' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Jobs tab */}
      {activeTab === 'jobs' && (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([val, label]) => (
              <button key={val} onClick={() => setJobFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${jobFilter === val ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
              No jobs found.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Job</th>
                    <th className="px-5 py-3 text-left">Property / Unit</th>
                    <th className="px-5 py-3 text-center">Priority</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Est. Cost</th>
                    <th className="px-5 py-3 text-right">Actual Cost</th>
                    <th className="px-5 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredJobs.map(j => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{j.title}</p>
                        {j.invoice_ref && <p className="text-xs text-gray-400">Ref: {j.invoice_ref}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {j.property}
                        {j.unit && j.unit !== '—' && <span className="text-gray-400"> · {j.unit}</span>}
                      </td>
                      <td className="px-5 py-3 text-center"><Badge value={j.priority} /></td>
                      <td className="px-5 py-3 text-center"><Badge value={j.status} /></td>
                      <td className="px-5 py-3 text-right text-gray-600">{j.estimated_cost ? `£${j.estimated_cost.toLocaleString()}` : '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{j.actual_cost ? `£${j.actual_cost.toLocaleString()}` : '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(j.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reviews tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {(profile.reviews || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
              No reviews yet.
            </div>
          ) : (profile.reviews || []).map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`text-lg ${n <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
              </div>
              {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Messages tab */}
      {activeTab === 'messages' && (
        <ContractorChat contractorId={id} contractorName={profile.full_name} />
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Edit Contractor</h3>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={saveEdit} className="px-6 py-5 space-y-3">
              {[
                ['full_name', 'Full Name', 'text'],
                ['company_name', 'Company Name', 'text'],
                ['contact_name', 'Contact Name', 'text'],
                ['trade', 'Trade', 'text'],
                ['email', 'Email', 'email'],
                ['phone', 'Phone', 'tel'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={editForm[field] || ''} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300">Cancel</button>
                <button type="submit" disabled={savingEdit} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portal modal */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {profile.portal_enabled ? 'Disable Contractor Portal' : 'Enable Contractor Portal'}
              </h3>
              <button onClick={() => setPortalModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5">
              {profile.portal_enabled ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">This will prevent {profile.full_name} from logging in to the contractor portal.</p>
                  {portalMsg && <p className="text-xs text-green-600 mb-3">{portalMsg}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setPortalModal(false)} className="flex-1 border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={disablePortal} className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-700">Disable</button>
                  </div>
                </>
              ) : (
                <form onSubmit={enablePortal} className="space-y-4">
                  <p className="text-sm text-gray-600">Set a password for {profile.full_name}. They can log in at <strong>/contractor/login</strong> using their email.</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <input type="password" value={portalPw} onChange={e => setPortalPw(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" required />
                  </div>
                  {portalMsg && <p className="text-xs text-green-600">{portalMsg}</p>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setPortalModal(false)} className="flex-1 border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="flex-1 bg-green-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-green-700">Enable Portal</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
