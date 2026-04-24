import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'

function LandlordChat({ landlordId, landlordName }) {
  const [msgs, setMsgs] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get(`/landlord/messages/${landlordId}`).then(r => setMsgs(r.data)).catch(() => setMsgs([]))
    const iv = setInterval(() => {
      api.get(`/landlord/messages/${landlordId}`).then(r => setMsgs(r.data)).catch(() => {})
    }, 6000)
    return () => clearInterval(iv)
  }, [landlordId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    try {
      const r = await api.post(`/landlord/messages/${landlordId}`, { body: input.trim() })
      setMsgs(prev => [...(prev || []), r.data])
      setInput('')
    } catch (_) {}
    setSending(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: 420 }}>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Messages with {landlordName}</p>
        <p className="text-xs text-gray-400">Messages appear in the landlord portal if enabled</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs === null && <p className="text-xs text-gray-400 text-center mt-8">Loading…</p>}
        {msgs?.length === 0 && <p className="text-xs text-gray-400 text-center mt-8">No messages yet.</p>}
        {msgs?.map(m => {
          const isMe = m.sender_type === 'agent'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{m.sender_name}</p>}
                <p>{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
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
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        <button type="submit" disabled={sending || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-full">
          Send
        </button>
      </form>
    </div>
  )
}

const PEXELS_AVATARS = [
  'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
  'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
]

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, editing, name, type = 'text', onChange, placeholder }) {
  if (editing) {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1">{label}</label>
        <input type={type} value={value || ''} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder || label}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  )
}

export default function LandlordDetail() {
  const { id } = useParams()
  const [landlord, setLandlord] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [portalModal, setPortalModal] = useState(false)
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(false)
  const photoRef = useRef()

  useEffect(() => { load() }, [id])

  function load() {
    api.get(`/landlord/landlords/${id}`)
      .then(r => setLandlord(r.data))
      .catch(() => {})
  }

  function startEdit() {
    setForm({ ...landlord })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/landlord/landlords/${id}`, form)
      setLandlord(l => ({ ...l, ...form }))
      setEditing(false)
    } finally { setSaving(false) }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('entity_type', 'landlord')
      fd.append('entity_id', id)
      fd.append('category', 'photo')
      fd.append('file', file)
      const up = await api.post('/uploads', fd)
      await api.put(`/landlord/landlords/${id}`, { avatar_url: up.data.url })
      setLandlord(l => ({ ...l, avatar_url: up.data.url }))
    } finally { setUploadingPhoto(false); e.target.value = '' }
  }

  async function enablePortal(e) {
    e.preventDefault()
    try {
      await api.post(`/landlord/landlords/${id}/enable-portal`, { password: portalPw })
      setLandlord(l => ({ ...l, portal_enabled: true }))
      setPortalModal(false)
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  async function disablePortal() {
    await api.post(`/landlord/landlords/${id}/disable-portal`)
    setConfirmDisable(false)
    setLandlord(l => ({ ...l, portal_enabled: false }))
  }

  if (!landlord) return <div className="text-gray-400 text-sm p-8">Loading…</div>

  const displayForm = editing ? form : landlord

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/landlords" className="hover:text-indigo-600">Landlords</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{landlord.full_name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0 cursor-pointer" onClick={() => photoRef.current.click()} title="Click to change photo">
              {landlord.avatar_url
                ? <img src={landlord.avatar_url} alt={landlord.full_name} className="w-16 h-16 rounded-full object-cover" />
                : <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">{landlord.full_name[0]}</div>
              }
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingPhoto ? <span className="text-white text-xs">…</span> : <span className="text-white text-lg">📷</span>}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{landlord.full_name}</h2>
                {!editing && <button onClick={startEdit} className="text-gray-300 hover:text-indigo-500 transition-colors">✏️</button>}
              </div>
              {landlord.company_name && <p className="text-sm text-gray-500 mt-0.5">{landlord.company_name}</p>}
              <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                {landlord.email && <a href={`mailto:${landlord.email}`} className="hover:text-indigo-600">✉ {landlord.email}</a>}
                {landlord.phone && <a href={`tel:${landlord.phone}`} className="hover:text-indigo-600">📞 {landlord.phone}</a>}
              </div>
            </div>
          </div>

          {/* Portal controls */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {landlord.portal_enabled ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Portal enabled</span>
                {confirmDisable ? (
                  <>
                    <span className="text-xs text-red-600 font-medium">Disable?</span>
                    <button onClick={disablePortal} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                    <button onClick={() => setConfirmDisable(false)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded">No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDisable(true)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Disable</button>
                )}
              </div>
            ) : (
              <button onClick={() => { setPortalModal(true); setPortalPw(''); setPortalMsg('') }}
                className="text-xs bg-violet-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-violet-700">
                Enable portal
              </button>
            )}
          </div>
        </div>
        {landlord.notes && !editing && <p className="mt-4 text-sm text-gray-400 italic">{landlord.notes}</p>}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[
          { key: 'details', label: 'Details' },
          { key: 'messages', label: 'Messages' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'messages' && (
        <LandlordChat landlordId={id} landlordName={landlord.full_name} />
      )}

      {activeTab === 'details' && (<>

      {/* Edit form */}
      {editing && (
        <form onSubmit={saveEdit} className="mb-5 space-y-5">
          <Section title="Contact Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" name="full_name" value={form.full_name} editing onChange={set} />
              <Field label="Email" name="email" type="email" value={form.email} editing onChange={set} />
              <Field label="Phone" name="phone" value={form.phone} editing onChange={set} />
            </div>
          </Section>
          <Section title="Address">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address Line 1" name="address_line1" value={form.address_line1} editing onChange={set} />
              <Field label="Address Line 2" name="address_line2" value={form.address_line2} editing onChange={set} />
              <Field label="City" name="city" value={form.city} editing onChange={set} />
              <Field label="Postcode" name="postcode" value={form.postcode} editing onChange={set} />
            </div>
          </Section>
          <Section title="Company">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Company Name" name="company_name" value={form.company_name} editing onChange={set} />
              <Field label="Companies House No." name="company_number" value={form.company_number} editing onChange={set} placeholder="e.g. 12345678" />
              <Field label="VAT Number" name="vat_number" value={form.vat_number} editing onChange={set} placeholder="e.g. GB123456789" />
            </div>
          </Section>
          <Section title="Bank Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name" name="bank_name" value={form.bank_name} editing onChange={set} placeholder="e.g. Barclays" />
              <Field label="Account Name" name="account_name" value={form.account_name} editing onChange={set} />
              <Field label="Sort Code" name="sort_code" value={form.sort_code} editing onChange={set} placeholder="00-00-00" />
              <Field label="Account Number" name="account_number" value={form.account_number} editing onChange={set} placeholder="8 digits" />
            </div>
          </Section>
          <Section title="Management Fee">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fee % <span className="text-gray-400 font-normal">(leave blank for org default 10%)</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="0.5"
                    value={form.management_fee_pct ?? ''} onChange={e => set('management_fee_pct', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="10"
                    step="0.01"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Used in CFO dashboard per-property margin calculation.</p>
              </div>
            </div>
          </Section>
          <Section title="Notes">
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any notes about this landlord…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </Section>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="border border-gray-300 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* View mode sections */}
      {!editing && (
        <>
          <div className="grid grid-cols-2 gap-5 mb-5">
            <Section title="Address">
              <div className="space-y-3">
                <Field label="Address Line 1" value={landlord.address_line1} />
                <Field label="Address Line 2" value={landlord.address_line2} />
                <Field label="City" value={landlord.city} />
                <Field label="Postcode" value={landlord.postcode} />
              </div>
            </Section>
            <Section title="Company">
              <div className="space-y-3">
                <Field label="Company Name" value={landlord.company_name} />
                <Field label="Companies House No." value={landlord.company_number} />
                <Field label="VAT Number" value={landlord.vat_number} />
              </div>
            </Section>
          </div>

          <Section title="Bank Details">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Bank" value={landlord.bank_name} />
              <Field label="Account Name" value={landlord.account_name} />
              <Field label="Sort Code" value={landlord.sort_code} />
              <Field label="Account Number" value={landlord.account_number ? '••••' + landlord.account_number.slice(-4) : null} />
              <Field label="Management Fee" value={landlord.management_fee_pct != null ? `${landlord.management_fee_pct}%` : 'Default (10%)'} />
            </div>
          </Section>

          {/* Assigned properties */}
          {landlord.properties?.length > 0 && (
            <Section title="Properties">
              <div className="divide-y divide-gray-100">
                {landlord.properties.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link to={`/properties/${p.id}`} className="font-medium text-indigo-600 hover:underline">{p.name}</Link>
                    <span className="text-gray-400 text-xs">{p.address}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      </>)}

      {/* Enable portal modal */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Landlord Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a password for <span className="font-medium text-gray-800">{landlord.full_name}</span>.
              They will log in at <span className="font-mono text-xs">/landlord/login</span> using {landlord.email}.
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
    </div>
  )
}
