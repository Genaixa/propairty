import { PageHeader } from '../components/Illustration'
import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'

function SortIcon({ col, sortCol, sortDir }) {
  const active = sortCol === col
  return (
    <span className="inline-flex flex-col ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" style={active ? { opacity: 1 } : {}}>
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0l5 6H0z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}

function Th({ col, label, sortCol, sortDir, onSort, className = '' }) {
  return (
    <th onClick={() => onSort(col)}
      className={`group text-left py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}>
      <span className="inline-flex items-center">
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  )
}

export default function Landlords() {
  const [landlords, setLandlords] = useState([])
  const [allProperties, setAllProperties] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '',
    address_line1: '', address_line2: '', city: '', postcode: '',
    company_name: '', company_number: '', vat_number: '',
    bank_name: '', account_name: '', sort_code: '', account_number: '',
    management_fee_pct: '', notes: '',
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [portalModal, setPortalModal] = useState(null)
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [assignModal, setAssignModal] = useState(null)
  const [assignPropertyId, setAssignPropertyId] = useState('')
  const navigate = useNavigate()

  // Sort + filter state
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')
  const [tileFilter, setTileFilter] = useState('') // '' | 'portal' | 'assigned'

  useEffect(() => { load() }, [])

  async function load() {
    const [llRes, propRes] = await Promise.all([
      api.get('/landlord/landlords'),
      api.get('/properties'),
    ])
    setLandlords(llRes.data)
    setAllProperties(propRes.data)
  }

  async function addLandlord(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = { ...form, management_fee_pct: form.management_fee_pct === '' ? null : Number(form.management_fee_pct) }
      const res = await api.post('/landlord/landlords', payload)
      const extras = ['address_line1','address_line2','city','postcode','company_name','company_number',
        'vat_number','bank_name','account_name','sort_code','account_number','management_fee_pct','notes']
      const extraData = Object.fromEntries(extras.map(k => [k, payload[k]]).filter(([,v]) => v != null && v !== ''))
      if (Object.keys(extraData).length > 0) await api.put(`/landlord/landlords/${res.data.id}`, extraData)
      await load()
      setShowForm(false)
      setForm({ full_name: '', email: '', password: '', phone: '', address_line1: '', address_line2: '', city: '', postcode: '', company_name: '', company_number: '', vat_number: '', bank_name: '', account_name: '', sort_code: '', account_number: '', management_fee_pct: '', notes: '' })
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to add landlord')
    } finally { setSaving(false) }
  }

  async function enablePortal(e) {
    e.preventDefault()
    try {
      await api.post(`/landlord/landlords/${portalModal.id}/enable-portal`, { password: portalPw })
      await load()
      setPortalModal(null)
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  async function disablePortal(id) {
    await api.post(`/landlord/landlords/${id}/disable-portal`)
    setConfirmDisable(null)
    load()
  }

  async function deleteLandlord(id) {
    await api.delete(`/landlord/landlords/${id}`)
    setConfirmDelete(null)
    load()
  }

  async function assignProperty(e) {
    e.preventDefault()
    if (!assignPropertyId) return
    await api.put(`/landlord/landlords/${assignModal.id}/assign-property/${assignPropertyId}`)
    load()
    setAssignModal(null)
    setAssignPropertyId('')
  }

  async function unassignProperty(landlordId, propertyId) {
    const ll = landlords.find(l => l.id === landlordId)
    if ((ll?.properties?.length || 0) <= 1 && tileFilter === 'assigned') setTileFilter('')
    await api.put(`/landlord/landlords/${landlordId}/unassign-property/${propertyId}`)
    load()
  }

  const unassignedProps = allProperties.filter(p => !landlords.some(ll => ll.properties?.some(lp => lp.id === p.id)))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPortal = landlords.filter(l => l.portal_enabled).length
  const totalAssigned = landlords.reduce((s, l) => s + (l.properties?.length || 0), 0)

  const handleTile = key => setTileFilter(f => f === key ? '' : key)
  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const displayed = useMemo(() => {
    let list = [...landlords]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q)
      )
    }
    if (tileFilter === 'portal') list = list.filter(l => l.portal_enabled)
    if (tileFilter === 'assigned') list = list.filter(l => (l.properties?.length || 0) > 0)

    if (sortCol) {
      list.sort((a, b) => {
        let va, vb
        if (sortCol === 'name') {
          const surname = n => { const parts = n.trim().split(/\s+/); return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).toLowerCase() }
          va = surname(a.full_name); vb = surname(b.full_name)
        }
        else if (sortCol === 'contact') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase() }
        else if (sortCol === 'properties') { va = a.properties?.length || 0; vb = b.properties?.length || 0 }
        else if (sortCol === 'portal') { va = a.portal_enabled ? 0 : 1; vb = b.portal_enabled ? 0 : 1 }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [landlords, search, tileFilter, sortCol, sortDir])

  const tiles = [
    { key: null,       label: 'Landlords',           value: landlords.length, color: 'text-indigo-600',  ring: 'ring-indigo-400',  bg: 'bg-indigo-50' },
    { key: 'portal',   label: 'Portal Active',        value: totalPortal,      color: 'text-violet-600',  ring: 'ring-violet-400',  bg: 'bg-violet-50' },
    { key: 'assigned', label: 'Properties Assigned',  value: totalAssigned,    color: 'text-green-600',   ring: 'ring-green-400',   bg: 'bg-green-50' },
  ]

  return (
    <div>
      <PageHeader title="Landlords" subtitle="Manage your landlords and their portal access" />

      {/* ── Stat tiles (clickable filters) ──────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {tiles.map(t => {
          const active = t.key !== null && tileFilter === t.key
          return (
            <button key={t.label} onClick={() => t.key === null ? setTileFilter('') : handleTile(t.key)}
              className={`flex-1 min-w-32 bg-white rounded-xl border px-5 py-3 text-left cursor-pointer transition-all
                ${active ? `ring-2 ${t.ring} border-transparent ${t.bg}` : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${t.color}`}>{t.value}</p>
              {active && <p className="text-xs text-gray-400 mt-0.5">Filtered · click to clear</p>}
            </button>
          )
        })}
        <button onClick={() => { setShowForm(true); setFormError('') }}
          className="self-center ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer whitespace-nowrap">
          + Add Landlord
        </button>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        {(search || tileFilter) && (
          <button onClick={() => { setSearch(''); setTileFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{displayed.length} of {landlords.length}</span>
      </div>

      {/* ── Landlords table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <Th col="name"       label="Name"       sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="contact"    label="Contact"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="properties" label="Properties" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="portal"     label="Portal"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 && (
              <tr>
                <td colSpan="5" className="px-5 py-12 text-center">
                  {landlords.length === 0
                    ? <span className="text-gray-400">No landlords yet. Add your first landlord above.</span>
                    : <span className="text-gray-400">No landlords match your filters.
                        <button onClick={() => { setSearch(''); setTileFilter('') }} className="ml-2 text-indigo-600 hover:underline cursor-pointer">Clear filters</button>
                      </span>
                  }
                </td>
              </tr>
            )}
            {displayed.map(ll => (
              <tr key={ll.id} className="hover:bg-gray-50">
                {/* Name */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {ll.avatar_url
                      ? <img src={ll.avatar_url} alt={ll.full_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">{ll.full_name[0]}</div>
                    }
                    <Link to={`/landlords/${ll.id}`} className="font-medium text-indigo-600 hover:underline">{ll.full_name}</Link>
                  </div>
                </td>
                {/* Contact */}
                <td className="px-5 py-3.5 text-gray-500">
                  {ll.email && <p><a href={`mailto:${ll.email}`} className="hover:text-indigo-600">{ll.email}</a></p>}
                  {ll.phone && <p className="text-xs mt-0.5"><a href={`tel:${ll.phone}`} className="hover:text-indigo-600">{ll.phone}</a></p>}
                </td>
                {/* Properties */}
                <td className="px-5 py-3.5">
                  {ll.properties?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ll.properties.map(p => (
                        <span key={p.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                          {p.name}
                          <button onClick={() => unassignProperty(ll.id, p.id)}
                            className="text-gray-400 hover:text-red-500 ml-0.5 leading-none cursor-pointer">×</button>
                        </span>
                      ))}
                      <button onClick={() => { setAssignModal(ll); setAssignPropertyId('') }}
                        className="text-xs text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-50 cursor-pointer">+ assign</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAssignModal(ll); setAssignPropertyId('') }}
                      className="text-xs text-indigo-600 hover:underline cursor-pointer">+ Assign property</button>
                  )}
                </td>
                {/* Portal */}
                <td className="px-5 py-3.5">
                  {ll.portal_enabled ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Enabled</span>
                      {confirmDisable === ll.id ? (
                        <>
                          <span className="text-xs text-red-600 font-medium">Disable?</span>
                          <button onClick={() => disablePortal(ll.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer">Yes</button>
                          <button onClick={() => setConfirmDisable(null)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded cursor-pointer">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDisable(ll.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline cursor-pointer">Disable</button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setPortalModal(ll); setPortalPw(''); setPortalMsg('') }}
                      className="text-xs bg-violet-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-violet-700 cursor-pointer">
                      Enable portal
                    </button>
                  )}
                </td>
                {/* Delete */}
                <td className="px-5 py-3.5">
                  {ll.properties?.length > 0 ? (
                    confirmDelete === ll.id ? (
                      <div className="flex items-start gap-1.5 max-w-48">
                        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span className="text-xs text-amber-700 leading-snug">
                          Unassign all properties before deleting.{' '}
                          <button onClick={() => setConfirmDelete(null)} className="underline cursor-pointer">Dismiss</button>
                        </span>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(ll.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline cursor-pointer">Delete</button>
                    )
                  ) : (
                    confirmDelete === ll.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button onClick={() => deleteLandlord(ll.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer">Yes</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded cursor-pointer">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(ll.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline cursor-pointer">Delete</button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add landlord modal ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={addLandlord} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Add Landlord</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-7 py-5 space-y-6">

              {/* ── Basic info ─────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Info</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Robert Morrison" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="landlord@email.co.uk" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="+44 7700 900000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Portal Password <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} minLength={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Min 8 characters — leave blank to enable later" />
                  </div>
                </div>
              </div>

              {/* ── Address ────────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Address <span className="font-normal normal-case text-gray-300">optional</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {[['address_line1','Address Line 1','14 Jesmond Vale'],['address_line2','Address Line 2',''],
                    ['city','City','Newcastle upon Tyne'],['postcode','Postcode','NE2 1PQ']].map(([k,l,ph]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                      <input value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Company ────────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Company <span className="font-normal normal-case text-gray-300">optional</span></p>
                <div className="grid grid-cols-3 gap-3">
                  {[['company_name','Company Name','Chen Property Investments'],
                    ['company_number','Companies House No.','12345678'],
                    ['vat_number','VAT Number','GB123456789']].map(([k,l,ph]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                      <input value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Bank details ───────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Bank Details <span className="font-normal normal-case text-gray-300">optional</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {[['bank_name','Bank','Barclays'],['account_name','Account Name','R Morrison Property'],
                    ['sort_code','Sort Code','00-00-00'],['account_number','Account Number','8 digits']].map(([k,l,ph]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                      <input value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={ph} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Management Fee % <span className="text-gray-400 font-normal">(blank = org default 10%)</span></label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max="100" step="0.01" value={form.management_fee_pct}
                        onChange={e => setForm({...form, management_fee_pct: e.target.value})}
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="10" />
                      <span className="text-sm text-gray-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Notes ──────────────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes <span className="font-normal normal-case text-gray-300">optional</span></p>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                  placeholder="Any notes about this landlord…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-7 py-5 border-t border-gray-100 shrink-0">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                {saving ? 'Adding…' : 'Add Landlord'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Enable portal modal ─────────────────────────────────────────── */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Landlord Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a password for <span className="font-medium text-gray-800">{portalModal.full_name}</span>.
              They will log in at <span className="font-mono text-xs">/landlord/login</span> using {portalModal.email}.
            </p>
            <form onSubmit={enablePortal} className="space-y-4">
              <input type="password" placeholder="Password (min 8 characters)" value={portalPw}
                onChange={e => setPortalPw(e.target.value)} required minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {portalMsg && <p className={`text-sm ${portalMsg.includes('enabled') ? 'text-green-600' : 'text-red-500'}`}>{portalMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700">Enable</button>
                <button type="button" onClick={() => setPortalModal(null)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign property modal ───────────────────────────────────────── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Assign Property</h3>
            <p className="text-sm text-gray-500 mb-5">Assign a property to <span className="font-medium text-gray-800">{assignModal.full_name}</span></p>
            <form onSubmit={assignProperty} className="space-y-4">
              <select value={assignPropertyId} onChange={e => setAssignPropertyId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select a property…</option>
                {allProperties
                  .filter(p => !assignModal.properties?.some(lp => lp.id === p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.name} — {p.address_line1}</option>)
                }
              </select>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Assign</button>
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
