import { useEffect, useState, Fragment, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'

function TenantChat({ tenantId, tenantName }) {
  const [msgs, setMsgs] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get(`/tenants/${tenantId}/messages`).then(r => setMsgs(r.data)).catch(() => setMsgs([]))
    const iv = setInterval(() => {
      api.get(`/tenants/${tenantId}/messages`).then(r => setMsgs(r.data)).catch(() => {})
    }, 6000)
    return () => clearInterval(iv)
  }, [tenantId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    try {
      const r = await api.post(`/tenants/${tenantId}/messages`, { body: input.trim() })
      setMsgs(prev => [...(prev || []), r.data])
      setInput('')
    } catch (_) {}
    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: 420 }}>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Messages with {tenantName}</p>
        <p className="text-xs text-gray-400">Messages appear in the tenant portal if enabled</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs === null && <p className="text-xs text-gray-400 text-center mt-8">Loading…</p>}
        {msgs?.length === 0 && <p className="text-xs text-gray-400 text-center mt-8">No messages yet.</p>}
        {msgs?.map(m => {
          const isMe = m.sender_type === 'agent'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{m.sender_name}</p>}
                <p>{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-violet-200' : 'text-gray-400'}`}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 px-4 py-3 border-t border-gray-100">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message…"
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        <button type="submit" disabled={sending || !input.trim()}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-full">
          Send
        </button>
      </form>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-100 text-gray-500',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-orange-100 text-orange-700',
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-400',
  registered: 'bg-green-100 text-green-700',
  returned: 'bg-gray-100 text-gray-500',
  disputed: 'bg-red-100 text-red-700',
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

function Badge({ value }) {
  const cls = STATUS_COLORS[value] || 'bg-gray-100 text-gray-600'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{value?.replace(/_/g, ' ')}</span>
}

const CURRENT_YEAR = new Date().getFullYear().toString()

export default function TenantDetail() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [expandedJob, setExpandedJob] = useState(null)
  const [expandedYears, setExpandedYears] = useState(() => new Set([CURRENT_YEAR]))
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [portalModal, setPortalModal] = useState(false)
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')
  const [confirmDisablePortal, setConfirmDisablePortal] = useState(false)
  const [confirmInactive, setConfirmInactive] = useState(false)
  const photoRef = useRef()

  useEffect(() => {
    api.get(`/tenants/${id}/profile`)
      .then(r => setProfile(r.data))
      .catch(() => setError('Tenant not found'))
  }, [id])

  function startEdit() {
    setEditForm({
      full_name: profile.full_name,
      email: profile.email || '',
      phone: profile.phone || '',
      whatsapp_number: profile.whatsapp_number || '',
      notes: profile.notes || '',
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSavingEdit(true)
    try {
      await api.put(`/tenants/${id}`, { ...editForm, avatar_url: profile.avatar_url })
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
      fd.append('entity_type', 'tenant')
      fd.append('entity_id', id)
      fd.append('category', 'photo')
      fd.append('file', file)
      const up = await api.post('/uploads', fd)
      const url = up.data.url
      await api.put(`/tenants/${id}`, {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        whatsapp_number: profile.whatsapp_number,
        notes: profile.notes,
        avatar_url: url,
      })
      setProfile(p => ({ ...p, avatar_url: url }))
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  async function enablePortal(e) {
    e.preventDefault()
    try {
      await api.post(`/tenant/enable/${id}`, { password: portalPw })
      setPortalMsg(`Portal enabled. ${profile.email} can log in at /tenant/login`)
      setProfile(p => ({ ...p, portal_enabled: true }))
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  async function disablePortal() {
    await api.post(`/tenant/disable/${id}`)
    setConfirmDisablePortal(false)
    setProfile(p => ({ ...p, portal_enabled: false }))
  }

  async function setActive(active) {
    await api.post(`/tenants/${id}/${active ? 'set-active' : 'set-inactive'}`)
    setConfirmInactive(false)
    setProfile(p => ({ ...p, is_active: active }))
  }

  if (error) return <div className="text-red-500 text-sm">{error}</div>
  if (!profile) return <div className="text-gray-400 text-sm">Loading…</div>

  const activeLease = profile.leases.find(l => l.status === 'active')
  const pastLeases = profile.leases.filter(l => l.status !== 'active')
  const arrears = profile.leases.flatMap(l => l.payments.filter(p => p.status === 'overdue' || p.status === 'partial'))
  const totalArrears = arrears.reduce((s, p) => s + (p.amount_due - (p.amount_paid || 0)), 0)

  const allPayments = profile.leases
    .flatMap(l => l.payments)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))

  const paymentsByYear = allPayments.reduce((acc, p) => {
    const yr = p.due_date.slice(0, 4)
    if (!acc[yr]) acc[yr] = []
    acc[yr].push(p)
    return acc
  }, {})
  const years = Object.keys(paymentsByYear).sort((a, b) => b - a)

  function toggleYear(yr) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      next.has(yr) ? next.delete(yr) : next.add(yr)
      return next
    })
  }

  return (
    <div className="max-w-4xl">
      {/* Enable portal modal */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Tenant Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a password for <span className="font-medium text-gray-800">{profile.full_name}</span>.
              They will log in at <span className="font-mono text-xs">/tenant/login</span> using {profile.email}.
            </p>
            <form onSubmit={enablePortal} className="space-y-4">
              <input type="password" placeholder="Password (min 8 characters)" value={portalPw}
                onChange={e => setPortalPw(e.target.value)} required minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {portalMsg && <p className={`text-sm ${portalMsg.includes('enabled') ? 'text-green-600' : 'text-red-500'}`}>{portalMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700">Enable</button>
                <button type="button" onClick={() => setPortalModal(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/tenants" className="hover:text-indigo-600">Tenants</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{profile.full_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0 cursor-pointer" onClick={() => photoRef.current.click()} title="Click to change photo">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.full_name} className="w-16 h-16 rounded-full object-cover" />
                : <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">{profile.full_name[0]}</div>
              }
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingPhoto ? <span className="text-white text-xs">…</span> : <span className="text-white text-lg">📷</span>}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <div className="flex-1">
              {editing ? (
                <form onSubmit={saveEdit} className="space-y-2">
                  <input value={editForm.full_name} onChange={e => setEditForm(f => ({...f, full_name: e.target.value}))}
                    placeholder="Full name" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))}
                    placeholder="Email" type="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))}
                    placeholder="Phone"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={editForm.whatsapp_number} onChange={e => setEditForm(f => ({...f, whatsapp_number: e.target.value}))}
                    placeholder="WhatsApp number (e.g. +447700900000)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                    placeholder="Notes" rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={savingEdit}
                      className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditing(false)}
                      className="border border-gray-300 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">{profile.full_name}</h2>
                    <button onClick={startEdit} title="Edit details"
                      className="text-gray-300 hover:text-indigo-500 transition-colors">
                      ✏️
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                    {profile.email && <a href={`mailto:${profile.email}`} className="hover:text-indigo-600">✉ {profile.email}</a>}
                    {profile.phone && <a href={`tel:${profile.phone}`} className="hover:text-indigo-600">📞 {profile.phone}</a>}
                    {profile.whatsapp_number && <span>💬 {profile.whatsapp_number}</span>}
                  </div>
                  {profile.notes && <p className="mt-2 text-sm text-gray-400 italic">{profile.notes}</p>}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {/* Active / Inactive */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${profile.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {profile.is_active !== false ? 'Active' : 'Inactive'}
              </span>
              {profile.is_active !== false ? (
                confirmInactive ? (
                  <>
                    <span className="text-xs text-red-600 font-medium">Mark inactive?</span>
                    <button onClick={() => setActive(false)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                    <button onClick={() => setConfirmInactive(false)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmInactive(true)} className="text-xs text-gray-400 hover:text-red-500 hover:underline">Mark inactive</button>
                )
              ) : (
                <button onClick={() => setActive(true)} className="text-xs text-green-600 hover:underline font-medium">Mark active</button>
              )}
            </div>
            {/* Portal */}
            <div className="flex items-center gap-2">
              {profile.portal_enabled ? (
                <>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Portal enabled</span>
                  {confirmDisablePortal ? (
                    <>
                      <span className="text-xs text-red-600 font-medium">Disable?</span>
                      <button onClick={disablePortal} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                      <button onClick={() => setConfirmDisablePortal(false)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">No</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDisablePortal(true)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Disable</button>
                  )}
                </>
              ) : (
                <button onClick={() => { setPortalModal(true); setPortalPw(''); setPortalMsg('') }}
                  className="text-xs bg-violet-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-violet-700">
                  Enable portal
                </button>
              )}
            </div>
          </div>
        </div>
        {totalArrears > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 font-medium">
            ⚠ £{totalArrears.toLocaleString()} in arrears — {arrears.length} payment{arrears.length !== 1 ? 's' : ''} overdue
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[
          { key: 'details', label: 'Details & Payments' },
          { key: 'maintenance', label: `Maintenance (${profile.maintenance.length})` },
          { key: 'messages', label: 'Messages' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'messages' && (
        <TenantChat tenantId={id} tenantName={profile.full_name} />
      )}

      {activeTab === 'details' && (<>

      {/* Current tenancy */}
      {activeLease && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Current Tenancy</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Property</p>
              <p className="font-medium text-gray-900 mt-0.5">{activeLease.property}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Unit</p>
              <p className="font-medium text-gray-900 mt-0.5">{activeLease.unit}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Monthly Rent</p>
              <p className="font-medium text-gray-900 mt-0.5">£{activeLease.rent_amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Lease Period</p>
              <p className="font-medium text-gray-900 mt-0.5">{fmtDate(activeLease.start_date)} → {activeLease.end_date ? fmtDate(activeLease.end_date) : 'Ongoing'}</p>
            </div>
          </div>
          {activeLease.deposit && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-400">Deposit</p>
                <p className="font-medium text-gray-900 mt-0.5">£{activeLease.deposit.amount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Scheme</p>
                <p className="font-medium text-gray-900 mt-0.5">{activeLease.deposit.scheme || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <div className="mt-0.5"><Badge value={activeLease.deposit.status} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous tenancies */}
      {pastLeases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Previous Tenancies</h3>
          <div className="divide-y divide-gray-100">
            {pastLeases.map(l => (
              <div key={l.id} className="flex justify-between items-center text-sm py-2.5">
                <span className="font-medium text-gray-700">{l.property} · {l.unit}</span>
                <span className="text-gray-400 text-xs">{fmtDate(l.start_date)} → {l.end_date ? fmtDate(l.end_date) : '—'}</span>
                <Badge value={l.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {allPayments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Payment History</h3>
            <span className="text-xs text-gray-400">{allPayments.length} total</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Year', 'Due', 'Received', 'Outstanding', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map(yr => {
                const payments = paymentsByYear[yr]
                const due = payments.reduce((s, p) => s + p.amount_due, 0)
                const paid = payments.reduce((s, p) => s + (p.amount_paid || 0), 0)
                const outstanding = due - paid
                const open = expandedYears.has(yr)
                return (
                  <Fragment key={yr}>
                    <tr
                      onClick={() => toggleYear(yr)}
                      className="cursor-pointer hover:bg-indigo-50 border-t border-gray-100 transition-colors">
                      <td className="px-5 py-3 font-bold text-gray-900">{yr}</td>
                      <td className="px-5 py-3 text-gray-700">£{due.toLocaleString()}</td>
                      <td className="px-5 py-3 text-green-600 font-medium">£{paid.toLocaleString()}</td>
                      <td className={`px-5 py-3 font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {outstanding > 0 ? `£${outstanding.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs text-right pr-5">{open ? '▲' : '▼'}</td>
                    </tr>
                    {open && payments.map(p => (
                      <tr key={p.id} className={`border-t border-gray-50 ${p.status === 'overdue' ? 'bg-red-50/40' : 'bg-gray-50/50'}`}>
                        <td className="px-5 py-2.5 text-gray-500 text-xs pl-10">{p.due_date}</td>
                        <td className="px-5 py-2.5 text-gray-600">£{p.amount_due}</td>
                        <td className="px-5 py-2.5 text-green-600">{p.amount_paid ? `£${p.amount_paid}` : '—'}</td>
                        <td className="px-5 py-2.5"><Badge value={p.status} /></td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Maintenance Requests</h3>
            <Link to={`/maintenance?tenant_id=${profile.id}`} className="text-xs text-indigo-600 font-medium hover:underline">View all →</Link>
          </div>
          {profile.maintenance.length === 0
            ? <p className="text-sm text-gray-400 p-6 text-center">No maintenance requests.</p>
            : (
              <div className="divide-y divide-gray-100">
                {profile.maintenance.map(m => (
                  <div key={m.id}>
                    <button
                      onClick={() => setExpandedJob(expandedJob === m.id ? null : m.id)}
                      className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-gray-900 text-sm truncate">{m.title}</span>
                        <Badge value={m.priority} />
                        <Badge value={m.status} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{m.created_at}</span>
                        <span className="text-gray-400 text-xs">{expandedJob === m.id ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {expandedJob === m.id && (
                      <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100 text-sm space-y-2">
                        {m.description && <p className="text-gray-700">{m.description}</p>}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 pt-1">
                          {m.assigned_to && <span>Assigned to: <span className="font-medium text-gray-700">{m.assigned_to}</span></span>}
                          {m.estimated_cost != null && <span>Est. cost: <span className="font-medium text-gray-700">£{m.estimated_cost}</span></span>}
                          {m.actual_cost != null && <span>Actual cost: <span className="font-medium text-gray-700">£{m.actual_cost}</span></span>}
                        </div>
                        <Link to={`/maintenance?tenant_id=${profile.id}`} className="inline-block text-xs text-indigo-600 font-medium hover:underline pt-1">
                          Open in Maintenance →
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
