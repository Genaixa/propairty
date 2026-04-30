import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Badge from '../components/Badge'

const TYPE_ICON = { residential: '🏠', HMO: '🏘️', commercial: '🏢' }

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function PhotoGallery({ propertyId }) {
  const [photos, setPhotos] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  function load() {
    api.get(`/uploads?entity_type=property&entity_id=${propertyId}`)
      .then(r => setPhotos(r.data.filter(f => f.mime_type?.startsWith('image/'))))
      .catch(() => {})
  }

  useEffect(() => { load() }, [propertyId])

  async function upload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('entity_type', 'property')
    fd.append('entity_id', propertyId)
    fd.append('category', 'photo')
    fd.append('file', file)
    try {
      await api.post('/uploads', fd)
      load()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function remove(id) {
    await api.delete(`/uploads/${id}`)
    setPhotos(p => p.filter(x => x.id !== id))
    if (lightbox?.id === id) setLightbox(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Photos</h3>
        <button onClick={() => fileRef.current.click()}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Add photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center border-2 border-dashed border-gray-200 rounded-xl">
          No photos yet — click Add photo
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {photos.map(p => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer"
              onClick={() => setLightbox(p)}>
              <img src={p.url || `/api/uploads/${p.id}/download`} alt={p.original_name}
                className="w-full h-full object-cover" />
              <button onClick={ev => { ev.stopPropagation(); remove(p.id) }}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs items-center justify-center hidden group-hover:flex">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.url || `/api/uploads/${lightbox.id}/download`} alt={lightbox.original_name}
            className="max-h-full max-w-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-2xl">×</button>
        </div>
      )}
    </div>
  )
}

function FloorplanUpload({ propertyId }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [existing, setExisting] = useState(null)
  const fileRef = useRef()

  function load() {
    api.get(`/uploads?entity_type=property&entity_id=${propertyId}`)
      .then(r => {
        const fp = r.data.find(f => f.category === 'floorplan')
        setExisting(fp || null)
      }).catch(() => {})
  }
  useEffect(() => { load() }, [propertyId])

  async function upload(e) {
    const f = e.target.files[0]
    if (!f) return
    setUploading(true)
    const fd = new FormData()
    fd.append('entity_type', 'property')
    fd.append('entity_id', propertyId)
    fd.append('category', 'floorplan')
    fd.append('file', f)
    try { await api.post('/uploads', fd); load() }
    finally { setUploading(false); e.target.value = '' }
  }

  async function remove() {
    if (!existing) return
    await api.delete(`/uploads/${existing.id}`)
    setExisting(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Floorplan</h3>
        <button onClick={() => fileRef.current.click()} disabled={uploading}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {uploading ? 'Uploading…' : existing ? 'Replace floorplan' : '+ Upload floorplan'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={upload} />
      </div>
      {existing ? (
        <div className="relative inline-block">
          <img src={existing.url || `/uploads/${existing.filename}`} alt="Floorplan"
            className="max-h-48 rounded-xl border border-gray-200 object-contain" />
          <button onClick={remove}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80">×</button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4 text-center border-2 border-dashed border-gray-200 rounded-xl">
          No floorplan — upload one to display it on your public listing
        </p>
      )}
    </div>
  )
}


function PropertyDetailsEdit({ prop, onSaved }) {
  const [form, setForm] = useState({
    name: prop.name || '',
    address_line1: prop.address_line1 || '',
    address_line2: prop.address_line2 || '',
    city: prop.city || '',
    postcode: prop.postcode || '',
    property_type: prop.property_type || 'residential',
    description: prop.description || '',
    epc_rating: prop.epc_rating || '',
    epc_potential: prop.epc_potential || '',
    tenure: prop.tenure || '',
    features: prop.features || '',
    virtual_tour_url: prop.virtual_tour_url || '',
    council_tax_band: prop.council_tax_band || '',
    bills_included: prop.bills_included || false,
    reference_number: prop.reference_number || '',
    emergency_contacts: prop.emergency_contacts || '[]',
    utility_info: prop.utility_info || '{}',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/properties/${prop.id}`, { ...form, landlord_id: prop.landlord_id || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } finally { setSaving(false) }
  }

  const inp = (key, label, type='text', rows=null) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {rows
        ? <textarea rows={rows} value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"/>
        : <input type={type} value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
      }
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-5">Property details (public listing)</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {inp('name', 'Property name')}
          {inp('address_line1', 'Address line 1')}
          {inp('address_line2', 'Address line 2')}
          {inp('city', 'City')}
          {inp('postcode', 'Postcode')}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Property type</label>
            <select value={form.property_type} onChange={e => setForm(f => ({...f,property_type:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="residential">Residential</option>
              <option value="HMO">HMO</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
        </div>
        {inp('description', 'Description', 'text', 5)}
        {inp('features', 'Key features (one per line — shown as bullet points)', 'text', 5)}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tenure</label>
            <select value={form.tenure} onChange={e => setForm(f => ({...f,tenure:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Not specified</option>
              <option value="Freehold">Freehold</option>
              <option value="Leasehold">Leasehold</option>
              <option value="Share of Freehold">Share of Freehold</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">EPC current</label>
            <select value={form.epc_rating} onChange={e => setForm(f => ({...f,epc_rating:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Unknown</option>
              {['A','B','C','D','E','F','G'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">EPC potential</label>
            <select value={form.epc_potential} onChange={e => setForm(f => ({...f,epc_potential:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Unknown</option>
              {['A','B','C','D','E','F','G'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Council tax band</label>
            <select value={form.council_tax_band} onChange={e => setForm(f => ({...f,council_tax_band:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Unknown</option>
              {['A','B','C','D','E','F','G','H'].map(r => <option key={r} value={r}>Band {r}</option>)}
            </select>
          </div>
        </div>
        {inp('reference_number', 'Property reference number (e.g. NE-2024-001)')}
        {inp('virtual_tour_url', 'Virtual tour URL (YouTube embed or Matterport URL)')}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.bills_included} onChange={e => setForm(f => ({...f,bills_included:e.target.checked}))}
            className="rounded border-gray-300 text-indigo-600" />
          Bills included in rent
        </label>

        {/* Emergency Contacts */}
        <div className="pt-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">Emergency Contacts <span className="text-xs font-normal text-gray-400">(shown to tenants on portal)</span></p>
          {(() => {
            let contacts = []
            try { contacts = JSON.parse(form.emergency_contacts || '[]') } catch {}
            return (
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={c.role} placeholder="Role (e.g. Out of Hours)"
                      onChange={e => { const a = [...contacts]; a[i] = {...a[i], role: e.target.value}; setForm(f => ({...f, emergency_contacts: JSON.stringify(a)})) }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input value={c.name} placeholder="Name"
                      onChange={e => { const a = [...contacts]; a[i] = {...a[i], name: e.target.value}; setForm(f => ({...f, emergency_contacts: JSON.stringify(a)})) }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input value={c.phone} placeholder="Phone"
                      onChange={e => { const a = [...contacts]; a[i] = {...a[i], phone: e.target.value}; setForm(f => ({...f, emergency_contacts: JSON.stringify(a)})) }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button type="button" onClick={() => { const a = contacts.filter((_,j) => j !== i); setForm(f => ({...f, emergency_contacts: JSON.stringify(a)})) }}
                      className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => { const a = [...contacts, {role:'',name:'',phone:''}]; setForm(f => ({...f, emergency_contacts: JSON.stringify(a)})) }}
                  className="text-xs text-indigo-600 hover:underline">+ Add contact</button>
              </div>
            )
          })()}
        </div>

        {/* Utility Info */}
        <div className="pt-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">Utility & Move-in Info <span className="text-xs font-normal text-gray-400">(shown to tenants on portal)</span></p>
          {(() => {
            let u = {}
            try { u = JSON.parse(form.utility_info || '{}') } catch {}
            const set = (key, val) => setForm(f => ({...f, utility_info: JSON.stringify({...u, [key]: val})}))
            const field = (key, label) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                <input value={u[key] || ''} onChange={e => set(key, e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )
            return (
              <div className="space-y-2">
                {field('electricity', 'Electricity supplier')}
                {field('gas', 'Gas supplier')}
                {field('water', 'Water supplier')}
                {field('council', 'Council / local authority')}
                {field('bin_days', 'Bin collection days')}
                {field('meter_elec', 'Electricity meter location')}
                {field('meter_gas', 'Gas meter location')}
                {field('broadband', 'Broadband provider')}
              </div>
            )
          })()}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
        </div>
      </form>
    </div>
  )
}


function CfoPanel({ units }) {
  const occupied = units.filter(u => u.status === 'occupied')
  const vacant   = units.filter(u => u.status === 'vacant')
  const activeRent   = occupied.reduce((s, u) => s + (u.monthly_rent || 0), 0)
  const voidRent     = vacant.reduce((s, u) => s + (u.monthly_rent || 0), 0)
  const depositsHeld = occupied.reduce((s, u) => s + (u.lease?.deposit || 0), 0)
  const avgRent      = occupied.length > 0 ? Math.round(activeRent / occupied.length) : 0

  const today = new Date()
  const in90  = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const expiring = occupied.filter(u => {
    if (!u.lease?.end_date || u.lease?.is_periodic) return false
    const end = new Date(u.lease.end_date)
    return end >= today && end <= in90
  })

  const cols = [
    {
      label: 'Monthly rent roll',
      value: `£${activeRent.toLocaleString()}`,
      sub: `£${(activeRent * 12).toLocaleString()} per year`,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'emerald',
    },
    {
      label: 'Avg rent / unit',
      value: avgRent > 0 ? `£${avgRent.toLocaleString()}` : '—',
      sub: `across ${occupied.length} occupied unit${occupied.length !== 1 ? 's' : ''}`,
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'indigo',
    },
    {
      label: 'Deposits held',
      value: `£${depositsHeld.toLocaleString()}`,
      sub: 'tenant deposit liability',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      color: 'violet',
    },
    {
      label: 'Void cost',
      value: voidRent > 0 ? `£${voidRent.toLocaleString()}/mo` : '£0',
      sub: voidRent > 0 ? `${vacant.length} vacant — £${(voidRent * 12).toLocaleString()} lost p.a.` : 'Fully let',
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
      color: voidRent > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'Expiring ≤ 90d',
      value: expiring.length > 0 ? String(expiring.length) : '—',
      sub: expiring.length > 0 ? `lease${expiring.length > 1 ? 's' : ''} need renewal` : 'No renewals due soon',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: expiring.length > 0 ? 'rose' : 'gray',
    },
  ]

  const colorMap = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', value: 'text-emerald-700' },
    indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  value: 'text-indigo-700'  },
    violet:  { bg: 'bg-violet-50',  icon: 'text-violet-500',  value: 'text-violet-700'  },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   value: 'text-amber-700'   },
    rose:    { bg: 'bg-rose-50',    icon: 'text-rose-500',    value: 'text-rose-700'    },
    gray:    { bg: 'bg-gray-50',    icon: 'text-gray-400',    value: 'text-gray-500'    },
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-sm font-semibold text-gray-900">Financial Summary</h2>
        <span className="text-xs text-gray-400">— mini CFO view</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-gray-100">
        {cols.map(c => {
          const cl = colorMap[c.color]
          return (
            <div key={c.label} className={`px-5 py-4 ${cl.bg}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <svg className={`w-3.5 h-3.5 ${cl.icon} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                </svg>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</p>
              </div>
              <p className={`text-xl font-bold ${cl.value}`}>{c.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{c.sub}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AddUnitModal({ propertyId, onSaved, onClose }) {
  const [form, setForm] = useState({ name: '', bedrooms: 1, bathrooms: 1, monthly_rent: '', status: 'vacant' })
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/properties/${propertyId}/units`, { ...form, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms), monthly_rent: parseFloat(form.monthly_rent) })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-5">Add Unit</h3>
        <form onSubmit={save} className="space-y-4">
          <input placeholder="Unit name (e.g. Flat 1, Ground Floor)" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bedrooms</label>
              <input type="number" min="0" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bathrooms</label>
              <input type="number" min="0" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rent (£/mo)</label>
              <input type="number" min="0" value={form.monthly_rent} onChange={e => setForm({...form, monthly_rent: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
          </div>
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Unit'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddTenantModal({ unit, propertyId, onSaved, onClose }) {
  const [tenants, setTenants] = useState([])
  const [form, setForm] = useState({
    tenant_id: '', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', monthly_rent: unit.monthly_rent || '', deposit: '',
    is_periodic: false, rent_day: 1,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data)).catch(() => {})
  }, [])

  async function save(e) {
    e.preventDefault()
    if (!form.tenant_id) { setErr('Please select a tenant'); return }
    setSaving(true)
    setErr('')
    try {
      await api.post('/leases', {
        unit_id: unit.id,
        tenant_id: parseInt(form.tenant_id),
        start_date: form.start_date,
        end_date: form.end_date || null,
        monthly_rent: parseFloat(form.monthly_rent),
        deposit: form.deposit ? parseFloat(form.deposit) : null,
        is_periodic: form.is_periodic,
        rent_day: parseInt(form.rent_day),
        status: 'active',
      })
      onSaved()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-1">Add Tenant — {unit.name}</h3>
        <p className="text-sm text-gray-500 mb-5">Create a new lease for this unit</p>
        <form onSubmit={save} className="space-y-4">
          <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
            <option value="">Select tenant…</option>
            {[...tenants].sort((a, b) => (a.full_name?.split(' ').slice(-1)[0] || '').localeCompare(b.full_name?.split(' ').slice(-1)[0] || '')).map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.email}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End date (leave blank if periodic)</label>
              <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Monthly rent (£)</label>
              <input type="number" min="0" value={form.monthly_rent} onChange={e => setForm({...form, monthly_rent: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Deposit (£)</label>
              <input type="number" min="0" value={form.deposit} onChange={e => setForm({...form, deposit: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.is_periodic} onChange={e => setForm({...form, is_periodic: e.target.checked})}
              className="rounded" />
            Periodic (rolling) tenancy
          </label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Lease'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VacateModal({ unit, propertyId, onSaved, onClose }) {
  const [form, setForm] = useState({ reason: '', end_date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/properties/${propertyId}/units/${unit.id}/vacate`, form)
      onSaved()
    } finally { setSaving(false) }
  }

  const REASONS = ['Tenant left at end of lease', 'Early termination by tenant', 'Early termination by landlord', 'Eviction', 'Mutual agreement', 'Other']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-1">Mark {unit.name} as Vacant</h3>
        <p className="text-sm text-gray-500 mb-5">This will end the active lease and set the unit to vacant.</p>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reason for vacating</label>
            <select value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
              <option value="">Select reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Vacancy date</label>
            <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || !form.reason}
              className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Mark Vacant'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Property History ─────────────────────────────────────────────────────────

const HTABS = [
  { key: 'maintenance', label: 'Maintenance',      color: 'amber',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { key: 'inspections', label: 'Inspections',      color: 'violet', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { key: 'inventories', label: 'Inventories',      color: 'blue',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'leases',      label: 'Tenancy history',  color: 'emerald',icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'compliance',  label: 'Compliance',       color: 'green',  icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-2.956z' },
  { key: 'documents',   label: 'Documents',        color: 'slate',  icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
]

const HTAB_COLORS = {
  amber:   { active: 'bg-amber-500 text-white shadow-amber-200',   badge: 'bg-amber-400/30 text-amber-50',   idle: 'text-amber-600 bg-amber-50 border border-amber-200' },
  violet:  { active: 'bg-violet-500 text-white shadow-violet-200', badge: 'bg-violet-400/30 text-violet-50', idle: 'text-violet-600 bg-violet-50 border border-violet-200' },
  blue:    { active: 'bg-blue-500 text-white shadow-blue-200',     badge: 'bg-blue-400/30 text-blue-50',     idle: 'text-blue-600 bg-blue-50 border border-blue-200' },
  emerald: { active: 'bg-emerald-500 text-white shadow-emerald-200',badge:'bg-emerald-400/30 text-emerald-50',idle: 'text-emerald-600 bg-emerald-50 border border-emerald-200'},
  green:   { active: 'bg-green-600 text-white shadow-green-200',   badge: 'bg-green-400/30 text-green-50',   idle: 'text-green-700 bg-green-50 border border-green-200' },
  slate:   { active: 'bg-slate-600 text-white shadow-slate-200',   badge: 'bg-slate-400/30 text-slate-50',   idle: 'text-slate-600 bg-slate-100 border border-slate-200' },
}

const H_STATUS = {
  open:        'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  in_progress: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
  completed:   'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  cancelled:   'bg-gray-100 text-gray-400',
  scheduled:   'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200',
  active:      'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  expired:     'bg-gray-100 text-gray-400',
  terminated:  'bg-rose-100 text-rose-600 ring-1 ring-rose-200',
  draft:       'bg-yellow-100 text-yellow-700',
  confirmed:   'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
}

function HPill({ value, label }) {
  const cls = H_STATUS[value] || 'bg-gray-100 text-gray-400'
  const text = label || (value || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ${cls}`}>{text}</span>
}

function HEmpty({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function HRow({ left, meta, right, link, linkTo }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors border-b border-gray-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{left}</p>
        {meta && <p className="text-xs text-gray-400 mt-0.5 truncate">{meta}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        {link && linkTo && (
          <Link to={linkTo} className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium hover:text-indigo-700">
            Open ↗
          </Link>
        )}
        {link && !linkTo && (
          <a href={link} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium hover:text-indigo-700">
            Download ↗
          </a>
        )}
      </div>
    </div>
  )
}

function HistoryMaintenance({ rows }) {
  const PRIO = { urgent: 'bg-red-100 text-red-600', high: 'bg-orange-100 text-orange-600', medium: 'bg-yellow-100 text-yellow-600', low: 'bg-gray-100 text-gray-400' }
  if (!rows.length) return <HEmpty icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" message="No maintenance jobs on record" />
  return (
    <div>
      {rows.map(r => (
        <HRow key={r.id}
          left={r.title}
          meta={`${r.unit} · ${fmtDate(r.created_at)}`}
          right={
            <div className="flex items-center gap-2">
              {r.priority && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${PRIO[r.priority] || 'bg-gray-100 text-gray-400'}`}>{r.priority}</span>}
              <HPill value={r.status} />
            </div>
          }
          linkTo="/maintenance"
          link={true}
        />
      ))}
    </div>
  )
}

function HistoryInspections({ rows }) {
  if (!rows.length) return <HEmpty icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" message="No inspections on record" />
  return (
    <div>
      {rows.map(r => (
        <HRow key={r.id}
          left={r.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          meta={`${r.unit} · ${fmtDate(r.scheduled_date)}${r.inspector ? ` · ${r.inspector}` : ''}`}
          right={<HPill value={r.status} />}
          linkTo="/inspections"
          link={true}
        />
      ))}
    </div>
  )
}

function HistoryInventories({ rows }) {
  if (!rows.length) return <HEmpty icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" message="No inventories on record" />
  return (
    <div>
      {rows.map(r => (
        <HRow key={r.id}
          left={r.inv_type === 'check_in' ? 'Check-In Inventory' : 'Check-Out Inventory'}
          meta={`${fmtDate(r.inv_date)}${r.conducted_by ? ` · ${r.conducted_by}` : ''}`}
          right={
            <div className="flex items-center gap-2">
              <HPill value={r.status} />
              {r.tenant_acknowledged_at
                ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">Tenant signed</span>
                : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-400">Pending ack</span>
              }
            </div>
          }
          linkTo="/inventory"
          link={true}
        />
      ))}
    </div>
  )
}

function HistoryLeases({ rows }) {
  if (!rows.length) return <HEmpty icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" message="No tenancy history" />
  return (
    <div>
      {rows.map(r => (
        <HRow key={r.id}
          left={r.tenant}
          meta={`${r.unit} · ${fmtDate(r.start_date)} → ${r.end_date ? fmtDate(r.end_date) : r.is_periodic ? 'Periodic' : 'ongoing'}`}
          right={
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">£{(r.monthly_rent || 0).toLocaleString()}<span className="text-xs font-normal text-gray-400">/mo</span></span>
              <HPill value={r.status} />
            </div>
          }
          linkTo={r.tenant_id ? `/tenants/${r.tenant_id}` : null}
          link={!!r.tenant_id}
        />
      ))}
    </div>
  )
}

function HistoryCompliance({ rows }) {
  if (!rows.length) return <HEmpty icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-2.956z" message="No compliance certificates on record" />
  return (
    <div>
      {rows.map(r => (
        <HRow key={r.id}
          left={r.label}
          meta={`Issued ${fmtDate(r.issue_date)} · Expires ${fmtDate(r.expiry_date)}${r.contractor ? ` · ${r.contractor}` : ''}${r.reference ? ` · Ref: ${r.reference}` : ''}`}
          right={
            r.expired
              ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-600 ring-1 ring-rose-200">Expired</span>
              : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">Valid</span>
          }
        />
      ))}
    </div>
  )
}

function HistoryDocuments({ rows }) {
  if (!rows.length) return <HEmpty icon="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" message="No documents on record" />
  return (
    <div>
      {rows.map(r => {
        const isImg = r.mime_type?.startsWith('image/')
        const isPdf = r.mime_type === 'application/pdf'
        const Icon = () => (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImg ? 'bg-violet-100' : isPdf ? 'bg-red-100' : 'bg-gray-100'}`}>
            <svg className={`w-4 h-4 ${isImg ? 'text-violet-500' : isPdf ? 'text-red-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={isImg ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' : 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'} />
            </svg>
          </div>
        )
        return (
          <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors border-b border-gray-100 last:border-0 group">
            <Icon />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{r.category || r.entity_type} · {fmtDate(r.created_at)}</p>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium hover:text-indigo-700 shrink-0">
              Download ↗
            </a>
          </div>
        )
      })}
    </div>
  )
}

function PropertyHistory({ propertyId }) {
  const [tab, setTab] = useState('maintenance')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/properties/${propertyId}/history`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [propertyId])

  const counts = data ? {
    maintenance: data.maintenance.length,
    inspections: data.inspections.length,
    inventories: data.inventories.length,
    leases:      data.leases.length,
    compliance:  data.compliance.length,
    documents:   data.documents.length,
  } : {}

  const active = HTABS.find(t => t.key === tab)
  const cl = HTAB_COLORS[active?.color || 'slate']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Property record</h2>

        {/* Pill tabs — scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {HTABS.map(t => {
            const isActive = tab === t.key
            const c = HTAB_COLORS[t.color]
            const count = counts[t.key]
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? `${c.active} shadow-sm`
                    : `${c.idle} hover:opacity-80`
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
                {count > 0 && (
                  <span className={`px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums ${isActive ? c.badge : 'bg-gray-200 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          </div>
        )}
        {!loading && data && (
          <>
            {tab === 'maintenance'  && <HistoryMaintenance  rows={data.maintenance} />}
            {tab === 'inspections'  && <HistoryInspections  rows={data.inspections} />}
            {tab === 'inventories'  && <HistoryInventories  rows={data.inventories} />}
            {tab === 'leases'       && <HistoryLeases       rows={data.leases} />}
            {tab === 'compliance'   && <HistoryCompliance   rows={data.compliance} />}
            {tab === 'documents'    && <HistoryDocuments    rows={data.documents} />}
          </>
        )}
      </div>
    </div>
  )
}

export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prop, setProp] = useState(null)
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [addTenantUnit, setAddTenantUnit] = useState(null)
  const [vacateUnit, setVacateUnit] = useState(null)
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  function sortUnits(units) {
    return [...units].sort((a, b) => {
      let av, bv
      if (sortCol === 'name')    { av = a.name; bv = b.name }
      else if (sortCol === 'rent')   { av = a.monthly_rent; bv = b.monthly_rent }
      else if (sortCol === 'status') { av = a.status; bv = b.status }
      else if (sortCol === 'tenant') { av = a.tenant?.full_name || ''; bv = b.tenant?.full_name || '' }
      else if (sortCol === 'jobs')   { av = a.open_maintenance; bv = b.open_maintenance }
      else { av = a.name; bv = b.name }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortTh({ col, children, className = '' }) {
    const active = sortCol === col
    return (
      <th onClick={() => handleSort(col)}
        className={`py-3 font-medium cursor-pointer select-none hover:text-gray-700 ${className}`}>
        <span className="flex items-center gap-1">
          {children}
          <span className={`text-xs ${active ? 'text-indigo-500' : 'text-gray-300'}`}>
            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </span>
      </th>
    )
  }

  function load() {
    api.get(`/properties/${id}/detail`).then(r => setProp(r.data)).catch(() => navigate('/properties'))
  }

  useEffect(() => { load() }, [id])

  if (!prop) return <div className="p-8 text-gray-400">Loading…</div>

  const totalRent = prop.units.reduce((s, u) => s + (u.monthly_rent || 0), 0)
  const occupied = prop.units.filter(u => u.status === 'occupied').length
  const vacant = prop.units.filter(u => u.status === 'vacant').length
  const occupancy = prop.units.length ? Math.round((occupied / prop.units.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/properties" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600">
        ← Back to Properties
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{TYPE_ICON[prop.property_type] || '🏠'}</span>
              <h1 className="text-2xl font-bold text-gray-900">{prop.name}</h1>
              <Badge value={prop.property_type} />
            </div>
            <p className="text-gray-500">{prop.address_line1}{prop.address_line2 ? `, ${prop.address_line2}` : ''}, {prop.city}, {prop.postcode}</p>
            {prop.description && <p className="mt-2 text-sm text-gray-500 max-w-2xl leading-relaxed">{prop.description}</p>}
            {(() => {
              const feats = (prop.features || '').split('\n').map(f => f.trim()).filter(Boolean)
              if (!feats.length) return null
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {feats.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1">
                      <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => api.post(`/properties/${prop.id}/toggle-featured`).then(r => setProp(p => ({...p, featured: r.data.featured})))}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors font-medium ${prop.featured ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
              title="Toggle whether this property is featured on the public listings site"
            >
              {prop.featured ? '⭐ Featured' : '☆ Feature'}
            </button>
            <Link to={`/maintenance?property_id=${prop.id}`}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-600">
              🔧 Maintenance
            </Link>
            <button onClick={() => setShowAddUnit(true)}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              + Add Unit
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-4 pt-5 border-t border-gray-100">
          {[
            ['Units', prop.units.length, 'text-gray-700'],
            ['Occupied', occupied, 'text-green-600'],
            ['Vacant', vacant, 'text-amber-500'],
            ['Occupancy', `${occupancy}%`, occupancy >= 80 ? 'text-green-600' : 'text-amber-500'],
            ['Monthly rent', `£${totalRent.toLocaleString()}`, 'text-indigo-600'],
          ].map(([label, val, cls]) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-bold ${cls}`}>{val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mini CFO analysis */}
      <CfoPanel units={prop.units} />

      {/* Photos + Floorplan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PhotoGallery propertyId={prop.id} />
        <div className="mt-6 pt-6 border-t border-gray-100">
          <FloorplanUpload propertyId={prop.id} />
        </div>
      </div>

      {/* Property details edit */}
      <PropertyDetailsEdit prop={prop} onSaved={load} />

      {/* Units */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Units</h2>
          <button onClick={() => setShowAddUnit(true)}
            className="text-xs text-indigo-600 hover:underline">+ Add unit</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <SortTh col="name"   className="text-left px-5">Unit</SortTh>
              <SortTh col="tenant" className="text-left px-5">Tenant</SortTh>
              <th className="text-left px-5 py-3 font-medium">Lease</th>
              <SortTh col="rent"   className="text-right px-5">Rent</SortTh>
              <SortTh col="status" className="text-center px-4">Status</SortTh>
              <SortTh col="jobs"   className="text-center px-4">Open jobs</SortTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortUnits(prop.units).map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <Link to={`/properties/${prop.id}/units/${u.id}`} className="font-medium text-indigo-600 hover:underline">
                    {u.name}
                  </Link>
                  <p className="text-xs text-gray-400">{u.bedrooms}bd · {u.bathrooms}ba</p>
                </td>
                <td className="px-5 py-3">
                  {u.tenant ? (
                    <div className="flex items-center gap-2.5">
                      {u.tenant.avatar_url
                        ? <img src={u.tenant.avatar_url} alt={u.tenant.full_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">{u.tenant.full_name[0]}</div>
                      }
                      <div>
                        <Link to={`/tenants/${u.tenant.id}`} className="text-indigo-600 hover:underline font-medium">
                          {u.tenant.full_name}
                        </Link>
                        <p className="text-xs text-gray-400">{u.tenant.email}</p>
                        {u.tenant.phone && <p className="text-xs text-gray-400">{u.tenant.phone}</p>}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Vacant</span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {u.lease ? (
                    <div>
                      <p>{fmtDate(u.lease.start_date)} → {u.lease.end_date ? fmtDate(u.lease.end_date) : u.lease.is_periodic ? 'Periodic' : '—'}</p>
                      {u.lease.deposit && <p className="text-gray-400">Deposit: £{u.lease.deposit.toLocaleString()}</p>}
                    </div>
                  ) : (
                    <button onClick={() => setAddTenantUnit(u)}
                      className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium">
                      + Add Tenant
                    </button>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  £{u.monthly_rent.toLocaleString()}/mo
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <Badge value={u.status} />
                    {u.status === 'occupied' && (
                      <button onClick={() => setVacateUnit(u)}
                        className="text-xs border border-amber-200 text-amber-600 px-2 py-0.5 rounded hover:bg-amber-50">
                        Mark Vacant
                      </button>
                    )}
                    {u.status === 'vacant' && (
                      <button onClick={() => setAddTenantUnit(u)}
                        className="text-xs border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-50">
                        + Add Tenant
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.open_maintenance > 0 ? (
                    <Link to={`/maintenance`}
                      className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full hover:bg-amber-200">
                      {u.open_maintenance}
                    </Link>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {prop.units.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">No units yet.</p>
        )}
      </div>

      {/* Property History */}
      <PropertyHistory propertyId={prop.id} />

      {showAddUnit && (
        <AddUnitModal
          propertyId={prop.id}
          onSaved={() => { load(); setShowAddUnit(false) }}
          onClose={() => setShowAddUnit(false)}
        />
      )}
      {addTenantUnit && (
        <AddTenantModal
          unit={addTenantUnit}
          propertyId={prop.id}
          onSaved={() => { load(); setAddTenantUnit(null) }}
          onClose={() => setAddTenantUnit(null)}
        />
      )}
      {vacateUnit && (
        <VacateModal
          unit={vacateUnit}
          propertyId={prop.id}
          onSaved={() => { load(); setVacateUnit(null) }}
          onClose={() => setVacateUnit(null)}
        />
      )}
    </div>
  )
}
