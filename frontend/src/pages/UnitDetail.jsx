import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Badge from '../components/Badge'

function PhotoGallery({ unitId }) {
  const [photos, setPhotos] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  function load() {
    api.get(`/uploads?entity_type=unit&entity_id=${unitId}`)
      .then(r => setPhotos(r.data.filter(f => f.mime_type?.startsWith('image/'))))
      .catch(() => {})
  }

  useEffect(() => { load() }, [unitId])

  async function upload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('entity_type', 'unit')
    fd.append('entity_id', unitId)
    fd.append('category', 'photo')
    fd.append('file', file)
    try { await api.post('/uploads', fd); load() }
    finally { setUploading(false); e.target.value = '' }
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
              <img src={p.url} alt={p.original_name} className="w-full h-full object-cover" />
              <button onClick={ev => { ev.stopPropagation(); remove(p.id) }}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs items-center justify-center hidden group-hover:flex">×</button>
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.original_name}
            className="max-h-full max-w-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-2xl">×</button>
        </div>
      )}
    </div>
  )
}

const OCCUPANCY_TYPES = [
  { value: 'single',    icon: '👤', label: 'Single occupant' },
  { value: 'couple',    icon: '👫', label: 'Couple' },
  { value: 'family',    icon: '👨‍👩‍👧‍👦', label: 'Family' },
  { value: 'sharers',   icon: '👥', label: 'Sharers / HMO' },
  { value: 'students',  icon: '🎓', label: 'Students' },
  { value: 'corporate', icon: '💼', label: 'Corporate let' },
]
const OCC_ICON  = Object.fromEntries(OCCUPANCY_TYPES.map(o => [o.value, o.icon]))
const OCC_LABEL = Object.fromEntries(OCCUPANCY_TYPES.map(o => [o.value, o.label]))

function OccupancyModal({ unit, propertyId, onSaved, onClose }) {
  const [form, setForm] = useState({
    occupancy_type: unit.occupancy_type || '',
    max_occupants:  unit.max_occupants  || '',
    occupancy_notes: unit.occupancy_notes || '',
  })
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/properties/${propertyId}/units/${unit.id}`, {
        occupancy_type:  form.occupancy_type  || null,
        max_occupants:   form.max_occupants ? parseInt(form.max_occupants) : null,
        occupancy_notes: form.occupancy_notes || null,
      })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold">Occupancy</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={save} className="px-6 py-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">Tenancy type</label>
            <div className="grid grid-cols-2 gap-2">
              {OCCUPANCY_TYPES.map(o => {
                const on = form.occupancy_type === o.value
                return (
                  <button key={o.value} type="button" onClick={() => setForm(f => ({...f, occupancy_type: o.value}))}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
                      on ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <span className="text-lg">{o.icon}</span>
                    <span>{o.label}</span>
                    {on && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Max permitted occupants</label>
            <input type="number" min="1" max="20" value={form.max_occupants}
              onChange={e => setForm(f => ({...f, max_occupants: e.target.value}))}
              placeholder="e.g. 4"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes (pets, restrictions, etc.)</label>
            <textarea value={form.occupancy_notes} onChange={e => setForm(f => ({...f, occupancy_notes: e.target.value}))}
              placeholder="e.g. No pets. 2 adults + 1 child."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ROOM_TYPES = [
  { value: 'master_bedroom',  label: 'Master Bedroom',    icon: '🛏️' },
  { value: 'bedroom',         label: 'Bedroom',           icon: '🛏️' },
  { value: 'living_room',     label: 'Living Room',       icon: '🛋️' },
  { value: 'kitchen',         label: 'Kitchen',           icon: '🍳' },
  { value: 'kitchen_diner',   label: 'Kitchen / Diner',   icon: '🍽️' },
  { value: 'dining_room',     label: 'Dining Room',       icon: '🪑' },
  { value: 'bathroom',        label: 'Bathroom',          icon: '🛁' },
  { value: 'ensuite',         label: 'En-suite',          icon: '🚿' },
  { value: 'wc',              label: 'WC / Toilet',       icon: '🚽' },
  { value: 'study',           label: 'Study / Office',    icon: '🖥️' },
  { value: 'utility',         label: 'Utility Room',      icon: '🫧' },
  { value: 'hallway',         label: 'Hallway',           icon: '🚪' },
  { value: 'storage',         label: 'Storage Room',      icon: '📦' },
  { value: 'conservatory',    label: 'Conservatory',      icon: '🌿' },
  { value: 'garage',          label: 'Garage',            icon: '🚗' },
  { value: 'garden',          label: 'Garden',            icon: '🌳' },
  { value: 'balcony',         label: 'Balcony',           icon: '🏙️' },
  { value: 'other',           label: 'Other',             icon: '🔲' },
]

const ROOM_ICON = Object.fromEntries(ROOM_TYPES.map(r => [r.value, r.icon]))
const ROOM_LABEL = Object.fromEntries(ROOM_TYPES.map(r => [r.value, r.label]))

function RoomsModal({ unit, propertyId, onSaved, onClose }) {
  const [rooms, setRooms] = useState(() => {
    try { return JSON.parse(unit.rooms || '[]') } catch { return [] }
  })
  const [saving, setSaving] = useState(false)

  function addRoom() {
    setRooms(prev => [...prev, { type: 'bedroom', label: '', size_sqm: '' }])
  }

  function removeRoom(i) {
    setRooms(prev => prev.filter((_, j) => j !== i))
  }

  function update(i, field, value) {
    setRooms(prev => prev.map((r, j) => j === i ? { ...r, [field]: value } : r))
  }

  async function save() {
    setSaving(true)
    const cleaned = rooms.map(r => ({
      type: r.type,
      label: r.label || ROOM_LABEL[r.type] || r.type,
      size_sqm: r.size_sqm ? parseFloat(r.size_sqm) : null,
    }))
    try {
      await api.put(`/properties/${propertyId}/units/${unit.id}`, {
        rooms: JSON.stringify(cleaned)
      })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Room layout</h3>
            <p className="text-sm text-gray-500">{unit.name} — add every room in this unit</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-2">
          {rooms.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No rooms added yet — click + Add Room below</p>
          )}
          {rooms.map((room, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-lg">{ROOM_ICON[room.type] || '🔲'}</span>
              <select value={room.type} onChange={e => update(i, 'type', e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {ROOM_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
              <input value={room.label} onChange={e => update(i, 'label', e.target.value)}
                placeholder="Custom name (optional)"
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input value={room.size_sqm} onChange={e => update(i, 'size_sqm', e.target.value)}
                placeholder="m²" type="number" min="0" step="0.1"
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={() => removeRoom(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">✕</button>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          <button onClick={addRoom}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            + Add Room
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save rooms'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AMENITY_GROUPS = [
  { label: 'Basics', items: [
    { key: 'wifi', icon: '📶', label: 'WiFi' },
    { key: 'parking', icon: '🚗', label: 'Parking' },
    { key: 'washing_machine', icon: '🫧', label: 'Washing machine' },
    { key: 'tumble_dryer', icon: '♻️', label: 'Tumble dryer' },
    { key: 'dishwasher', icon: '🍽️', label: 'Dishwasher' },
    { key: 'tv', icon: '📺', label: 'TV' },
    { key: 'central_heating', icon: '🌡️', label: 'Central heating' },
    { key: 'air_conditioning', icon: '❄️', label: 'Air conditioning' },
    { key: 'garden', icon: '🌿', label: 'Garden / outdoor space' },
    { key: 'balcony', icon: '🏙️', label: 'Balcony' },
    { key: 'storage', icon: '📦', label: 'Storage' },
    { key: 'fireplace', icon: '🔥', label: 'Fireplace' },
  ]},
  { label: 'Kitchen', items: [
    { key: 'full_kitchen', icon: '🍳', label: 'Fully equipped kitchen' },
    { key: 'microwave', icon: '📻', label: 'Microwave' },
    { key: 'oven', icon: '🔲', label: 'Oven' },
    { key: 'hob', icon: '🟠', label: 'Hob' },
    { key: 'fridge_freezer', icon: '🧊', label: 'Fridge / freezer' },
    { key: 'kettle_toaster', icon: '☕', label: 'Kettle & toaster' },
  ]},
  { label: 'Bathroom', items: [
    { key: 'shower', icon: '🚿', label: 'Shower' },
    { key: 'bath', icon: '🛁', label: 'Bath' },
    { key: 'ensuite', icon: '🚪', label: 'En-suite' },
    { key: 'electric_shower', icon: '⚡', label: 'Electric shower' },
  ]},
  { label: 'Building', items: [
    { key: 'lift', icon: '🛗', label: 'Lift / elevator' },
    { key: 'concierge', icon: '🏨', label: 'Porter / concierge' },
    { key: 'intercom', icon: '📞', label: 'Intercom / video doorbell' },
    { key: 'bike_storage', icon: '🚲', label: 'Bike storage' },
    { key: 'communal_garden', icon: '🌳', label: 'Communal garden' },
    { key: 'ev_charging', icon: '🔌', label: 'EV charging' },
  ]},
  { label: 'Bills included', items: [
    { key: 'gas_incl', icon: '💨', label: 'Gas included' },
    { key: 'electric_incl', icon: '💡', label: 'Electricity included' },
    { key: 'water_incl', icon: '💧', label: 'Water included' },
    { key: 'broadband_incl', icon: '🌐', label: 'Broadband included' },
    { key: 'council_tax_incl', icon: '📋', label: 'Council tax included' },
  ]},
  { label: 'Furnishing', items: [
    { key: 'furnished', icon: '🛋️', label: 'Furnished' },
    { key: 'part_furnished', icon: '🪑', label: 'Part furnished' },
    { key: 'unfurnished', icon: '🏚️', label: 'Unfurnished' },
    { key: 'beds_incl', icon: '🛏️', label: 'Bed(s) included' },
    { key: 'desk', icon: '🖥️', label: 'Desk / workspace' },
  ]},
]

const ALL_AMENITIES = AMENITY_GROUPS.flatMap(g => g.items)

function AmenitiesModal({ unit, propertyId, onSaved, onClose }) {
  const [selected, setSelected] = useState(() => {
    try { return new Set(JSON.parse(unit.amenities || '[]')) } catch { return new Set() }
  })
  const [saving, setSaving] = useState(false)

  function toggle(key) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      await api.put(`/properties/${propertyId}/units/${unit.id}`, {
        amenities: JSON.stringify(Array.from(selected))
      })
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-7 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Features & amenities</h3>
            <p className="text-sm text-gray-500">{unit.name} — tick everything that applies</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto px-7 py-5 space-y-6 flex-1">
          {AMENITY_GROUPS.map(group => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{group.label}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {group.items.map(item => {
                  const on = selected.has(item.key)
                  return (
                    <button key={item.key} type="button" onClick={() => toggle(item.key)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                        on ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      <span className="text-base">{item.icon}</span>
                      <span className="leading-tight">{item.label}</span>
                      {on && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-400">{selected.size} selected</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="border border-gray-300 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

function AddTenantModal({ unit, propertyId, onSaved, onClose }) {
  const [tenants, setTenants] = useState([])
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [tenantForm, setTenantForm] = useState({ full_name: '', email: '', phone: '' })
  const [form, setForm] = useState({
    tenant_id: '', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', monthly_rent: unit.monthly_rent || '', deposit: '',
    is_periodic: false, rent_day: 1,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { api.get('/tenants').then(r => setTenants(r.data)).catch(() => {}) }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      let tenantId = form.tenant_id ? parseInt(form.tenant_id) : null

      if (mode === 'new') {
        if (!tenantForm.full_name) { setErr('Full name is required'); setSaving(false); return }
        const res = await api.post('/tenants', tenantForm)
        tenantId = res.data.id
      }

      if (!tenantId) { setErr('Please select or create a tenant'); setSaving(false); return }

      await api.post('/leases', {
        unit_id: unit.id,
        tenant_id: tenantId,
        start_date: form.start_date,
        end_date: form.end_date || null,
        monthly_rent: parseFloat(form.monthly_rent),
        deposit: form.deposit ? parseFloat(form.deposit) : null,
        is_periodic: form.is_periodic,
        rent_day: parseInt(form.rent_day),
        status: 'active',
      })
      onSaved()
    } catch (e) { setErr(e.response?.data?.detail || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl">
        <h3 className="text-lg font-bold mb-1">Add Tenant — {unit.name}</h3>
        <p className="text-sm text-gray-500 mb-4">Create a new lease for this unit</p>

        {/* Toggle existing / new */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          {[['existing','Existing tenant'],['new','New tenant']].map(([k,l]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={save} className="space-y-4">
          {mode === 'existing' ? (
            <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
              <option value="">Select tenant…</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}{t.email ? ` — ${t.email}` : ''}</option>)}
            </select>
          ) : (
            <div className="space-y-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide">New tenant details</p>
              <input placeholder="Full name *" value={tenantForm.full_name} onChange={e => setTenantForm({...tenantForm, full_name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Email" type="email" value={tenantForm.email} onChange={e => setTenantForm({...tenantForm, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input placeholder="Phone" value={tenantForm.phone} onChange={e => setTenantForm({...tenantForm, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End date (blank = periodic)</label>
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
            <input type="checkbox" checked={form.is_periodic} onChange={e => setForm({...form, is_periodic: e.target.checked})} className="rounded" />
            Periodic (rolling) tenancy
          </label>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Lease'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VacateModal({ unit, propertyId, onSaved, onClose }) {
  const REASONS = ['Tenant left at end of lease', 'Early termination by tenant', 'Early termination by landlord', 'Eviction', 'Mutual agreement', 'Other']
  const [form, setForm] = useState({ reason: '', end_date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try { await api.post(`/properties/${propertyId}/units/${unit.id}/vacate`, form); onSaved() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold mb-1">Mark {unit.name} as Vacant</h3>
        <p className="text-sm text-gray-500 mb-5">This will end the active lease and set the unit to vacant.</p>
        <form onSubmit={save} className="space-y-4">
          <select value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
            <option value="">Select reason…</option>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
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
              className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PRIORITY_COLOUR = { urgent: 'text-red-600', high: 'text-orange-500', medium: 'text-yellow-600', low: 'text-gray-400' }

export default function UnitDetail() {
  const { propertyId, unitId } = useParams()
  const navigate = useNavigate()
  const [unit, setUnit] = useState(null)
  const [showAddTenant, setShowAddTenant] = useState(false)
  const [showVacate, setShowVacate] = useState(false)
  const [showAmenities, setShowAmenities] = useState(false)
  const [showRooms, setShowRooms] = useState(false)
  const [showOccupancy, setShowOccupancy] = useState(false)

  function load() {
    api.get(`/properties/${propertyId}/units/${unitId}/detail`)
      .then(r => setUnit(r.data))
      .catch(() => navigate(`/properties/${propertyId}`))
  }

  useEffect(() => { load() }, [propertyId, unitId])

  if (!unit) return <div className="p-8 text-gray-400">Loading…</div>

  const activeLeases = unit.leases.filter(l => l.status === 'active')
  const pastLeases = unit.leases.filter(l => l.status !== 'active')
  const openJobs = unit.maintenance.filter(j => j.status !== 'completed' && j.status !== 'cancelled')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/properties" className="hover:text-indigo-600">Properties</Link>
        <span>/</span>
        <Link to={`/properties/${propertyId}`} className="hover:text-indigo-600">{unit.property_name}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{unit.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{unit.name}</h1>
            <p className="text-gray-500 text-sm">{unit.property_address}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge value={unit.status} />
              <span className="text-sm font-semibold text-indigo-600">£{unit.monthly_rent?.toLocaleString()}/mo</span>
            </div>
            {/* Room breakdown */}
            {(() => {
              let roomList = []
              try { roomList = JSON.parse(unit.rooms || '[]') } catch {}
              return (
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  {roomList.length === 0
                    ? <span className="text-sm text-gray-400">{unit.bedrooms} bed · {unit.bathrooms} bath</span>
                    : roomList.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                          {ROOM_ICON[r.type] || '🔲'} {r.label || ROOM_LABEL[r.type]}
                          {r.size_sqm ? <span className="text-gray-400 ml-0.5">{r.size_sqm}m²</span> : null}
                        </span>
                      ))
                  }
                  <button onClick={() => setShowRooms(true)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50">
                    ✏️ {roomList.length === 0 ? 'Add rooms' : 'Edit rooms'}
                  </button>
                </div>
              )
            })()}
            {/* Occupancy */}
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {unit.occupancy_type && (
                <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-xs px-2.5 py-1 rounded-full border border-violet-200">
                  {OCC_ICON[unit.occupancy_type]} {OCC_LABEL[unit.occupancy_type]}
                </span>
              )}
              {unit.max_occupants && (
                <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-xs px-2.5 py-1 rounded-full border border-violet-200">
                  👥 Max {unit.max_occupants} {unit.max_occupants === 1 ? 'person' : 'people'}
                </span>
              )}
              {unit.occupancy_notes && (
                <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-2.5 py-1 rounded-full border border-gray-200" title={unit.occupancy_notes}>
                  📝 {unit.occupancy_notes.length > 40 ? unit.occupancy_notes.slice(0, 40) + '…' : unit.occupancy_notes}
                </span>
              )}
              <button onClick={() => setShowOccupancy(true)}
                className="inline-flex items-center gap-1 text-xs text-violet-600 border border-violet-200 px-2.5 py-1 rounded-full hover:bg-violet-50">
                ✏️ {unit.occupancy_type ? 'Edit occupancy' : 'Set occupancy'}
              </button>
            </div>

            {/* Amenities chips */}
            {(() => {
              let keys = []
              try { keys = JSON.parse(unit.amenities || '[]') } catch {}
              const items = keys.map(k => ALL_AMENITIES.find(a => a.key === k)).filter(Boolean)
              return (
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  {items.map(a => (
                    <span key={a.key} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                      {a.icon} {a.label}
                    </span>
                  ))}
                  <button onClick={() => setShowAmenities(true)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50">
                    ✏️ {items.length === 0 ? 'Add features' : 'Edit'}
                  </button>
                </div>
              )
            })()}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to={`/maintenance?unit_id=${unit.id}`}
              className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-600">
              🔧 Maintenance {openJobs.length > 0 && <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{openJobs.length}</span>}
            </Link>
            {unit.status === 'vacant' && (
              <button onClick={() => setShowAddTenant(true)}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                + Add Tenant
              </button>
            )}
            {unit.status === 'occupied' && (
              <button onClick={() => setShowVacate(true)}
                className="text-sm border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50">
                Mark Vacant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current tenant */}
      {unit.active_tenant && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Current Tenant</h2>
          <div className="flex items-center gap-4">
            {unit.active_tenant.avatar_url
              ? <img src={unit.active_tenant.avatar_url} alt={unit.active_tenant.full_name} className="w-14 h-14 rounded-full object-cover" />
              : <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-600">{unit.active_tenant.full_name[0]}</div>
            }
            <div>
              <Link to={`/tenants/${unit.active_tenant.id}`} className="text-lg font-semibold text-indigo-600 hover:underline">
                {unit.active_tenant.full_name}
              </Link>
              {unit.active_tenant.email && <p className="text-sm text-gray-500">{unit.active_tenant.email}</p>}
              {unit.active_tenant.phone && <p className="text-sm text-gray-500">{unit.active_tenant.phone}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PhotoGallery unitId={unit.id} />
      </div>

      {/* Leases */}
      {unit.leases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Lease History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Tenant</th>
                <th className="text-left px-5 py-3 font-medium">Start</th>
                <th className="text-left px-5 py-3 font-medium">End</th>
                <th className="text-right px-5 py-3 font-medium">Rent</th>
                <th className="text-right px-5 py-3 font-medium">Deposit</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unit.leases.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    {l.tenant
                      ? <Link to={`/tenants/${l.tenant.id}`} className="text-indigo-600 hover:underline font-medium">{l.tenant.full_name}</Link>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{fmtDate(String(l.start_date).slice(0,10))}</td>
                  <td className="px-5 py-3 text-gray-600">{l.end_date ? fmtDate(String(l.end_date).slice(0,10)) : l.is_periodic ? 'Periodic' : '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">£{l.monthly_rent?.toLocaleString()}/mo</td>
                  <td className="px-5 py-3 text-right text-gray-500">{l.deposit ? `£${l.deposit.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-center"><Badge value={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Maintenance */}
      {unit.maintenance.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Maintenance History</h2>
            <Link to={`/maintenance`} className="text-xs text-indigo-600 hover:underline">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Job</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unit.maintenance.map(j => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{j.title}</td>
                  <td className="px-4 py-3"><Badge value={j.priority} /></td>
                  <td className="px-4 py-3"><Badge value={j.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{j.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddTenant && (
        <AddTenantModal unit={unit} propertyId={propertyId}
          onSaved={() => { load(); setShowAddTenant(false) }}
          onClose={() => setShowAddTenant(false)} />
      )}
      {showVacate && (
        <VacateModal unit={unit} propertyId={propertyId}
          onSaved={() => { load(); setShowVacate(false) }}
          onClose={() => setShowVacate(false)} />
      )}
      {showAmenities && (
        <AmenitiesModal unit={unit} propertyId={propertyId}
          onSaved={() => { load(); setShowAmenities(false) }}
          onClose={() => setShowAmenities(false)} />
      )}
      {showRooms && (
        <RoomsModal unit={unit} propertyId={propertyId}
          onSaved={() => { load(); setShowRooms(false) }}
          onClose={() => setShowRooms(false)} />
      )}
      {showOccupancy && (
        <OccupancyModal unit={unit} propertyId={propertyId}
          onSaved={() => { load(); setShowOccupancy(false) }}
          onClose={() => setShowOccupancy(false)} />
      )}
    </div>
  )
}
