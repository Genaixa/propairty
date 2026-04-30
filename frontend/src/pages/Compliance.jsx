import { PageHeader } from '../components/Illustration'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { dlUrl } from '../lib/api'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_STYLE = {
  valid:         { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'Valid',          cell: '' },
  expiring_soon: { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Expiring Soon',  cell: 'bg-amber-50' },
  expired:       { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Expired',        cell: 'bg-red-100' },
  missing:       { dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     label: 'No Record',      cell: 'bg-red-50' },
  incomplete:    { dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', label: 'Incomplete',     cell: '' },
}

const CERT_ORDER = ['gas_safety', 'eicr', 'epc', 'fire_risk', 'legionella', 'pat']
const CERT_SHORT = {
  gas_safety: 'Gas Safety', eicr: 'EICR', epc: 'EPC',
  fire_risk: 'Fire Risk', legionella: 'Legionella', pat: 'PAT',
}
const CERT_LABELS = {
  gas_safety: 'Gas Safety Certificate', eicr: 'EICR (Electrical)',
  epc: 'EPC (Energy Performance)', fire_risk: 'Fire Risk Assessment',
  legionella: 'Legionella Risk Assessment', pat: 'PAT Testing',
  co_alarm: 'CO Alarm Check', hmo_licence: 'HMO Licence',
  smoke_alarm: 'Smoke Alarm Check', asbestos: 'Asbestos Survey',
  deposit_protection: 'Deposit Protection (TDS/DPS)',
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.missing
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default function Compliance() {
  const [summary, setSummary] = useState([])
  const [certs, setCerts] = useState([])
  const [properties, setProperties] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [isRenewal, setIsRenewal] = useState(false)
  const [renewingId, setRenewingId] = useState(null)
  const [form, setForm] = useState({ property_id: '', unit_id: '', cert_type: 'gas_safety', issue_date: '', expiry_date: '', contractor: '', reference: '', notes: '' })
  const [formUnits, setFormUnits] = useState([])
  const [selectedCert, setSelectedCert] = useState(null) // open detail/edit modal
  const [certFiles, setCertFiles] = useState({}) // { certId: [files] }
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editUnits, setEditUnits] = useState([])
  const [saving, setSaving] = useState(false)

  const [sortCol, setSortCol] = useState('expiry_date')
  const [sortDir, setSortDir] = useState('asc')
  const [filterStatus, setFilterStatus] = useState('attention')
  const [filterProp, setFilterProp] = useState('')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-4 py-3 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-gray-800 whitespace-nowrap uppercase">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  const load = async () => {
    const [s, c, p] = await Promise.all([
      api.get('/compliance/summary'),
      api.get('/compliance'),
      api.get('/properties'),
    ])
    setSummary(s.data)
    setCerts(c.data)
    setProperties(p.data)
  }

  useEffect(() => { load() }, [])

  const loadUnitsForProp = async (propId, setter) => {
    if (!propId) { setter([]); return }
    try {
      const r = await api.get(`/compliance/units-for-property/${propId}`)
      setter(r.data)
    } catch { setter([]) }
  }

  const loadCertFiles = async (certId) => {
    const res = await api.get('/uploads', { params: { entity_type: 'compliance_certificate', entity_id: certId } })
    setCertFiles(prev => ({ ...prev, [certId]: res.data }))
  }

  const openAddPrefilled = (propId, certType, unitId) => {
    setForm({
      property_id: propId,
      unit_id: unitId || '',
      cert_type: certType,
      issue_date: '',
      expiry_date: '',
      contractor: '',
      reference: '',
      notes: '',
    })
    loadUnitsForProp(propId, setFormUnits)
    setIsRenewal(false)
    setRenewingId(null)
    setShowForm(true)
  }

  const openDetail = async (cert) => {
    setSelectedCert(cert)
    setEditMode(false)
    setEditForm({ ...cert, unit_id: cert.unit_id || '', issue_date: cert.issue_date, expiry_date: cert.expiry_date })
    await loadCertFiles(cert.id)
    await loadUnitsForProp(cert.property_id, setEditUnits)
  }

  const handleUpload = async (certId, file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('entity_type', 'compliance_certificate')
      fd.append('entity_id', certId)
      fd.append('category', 'certificate')
      fd.append('file', file)
      await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadCertFiles(certId)
    } finally { setUploading(false) }
  }

  const handleDeleteFile = async (certId, fileId) => {
    await api.delete(`/uploads/${fileId}`)
    await loadCertFiles(certId)
  }

  const openRenew = (c) => {
    setForm({ property_id: c.property_id ? Number(c.property_id) : '', unit_id: c.unit_id || '', cert_type: c.cert_type || 'gas_safety', issue_date: '', expiry_date: '', contractor: c.contractor || '', reference: '', notes: '' })
    loadUnitsForProp(c.property_id, setFormUnits)
    setRenewingId(c.id)
    setIsRenewal(true)
    setShowForm(true)
  }

  const save = async e => {
    e.preventDefault()
    const payload = { ...form, property_id: Number(form.property_id) }
    if (!payload.unit_id) delete payload.unit_id
    await api.post('/compliance', payload)
    if (renewingId) await api.delete(`/compliance/${renewingId}`)
    load()
    setShowForm(false)
    setIsRenewal(false)
    setRenewingId(null)
    setForm({ property_id: '', unit_id: '', cert_type: 'gas_safety', issue_date: '', expiry_date: '', contractor: '', reference: '', notes: '' })
    setFormUnits([])
  }

  const saveEdit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...editForm }
      if (!payload.unit_id) payload.unit_id = null
      await api.put(`/compliance/${selectedCert.id}`, payload)
      await load()
      // refresh selected cert with updated data
      const updated = (await api.get('/compliance')).data.find(c => c.id === selectedCert.id)
      if (updated) { setSelectedCert(updated); setEditForm({ ...updated, unit_id: updated.unit_id || '' }) }
      setEditMode(false)
    } finally { setSaving(false) }
  }

  const deleteCert = async id => {
    if (!confirm('Delete this certificate record?')) return
    await api.delete(`/compliance/${id}`)
    setSelectedCert(null)
    load()
  }

  // Build sorted property list from both summary (includes all props) and certs
  const allProps = [...new Map([
    ...summary.map(p => [p.property_id, { id: p.property_id, name: p.property_name }]),
    ...certs.filter(c => c.property_id).map(c => [c.property_id, { id: c.property_id, name: c.property_name }]),
  ]).values()].sort((a, b) => a.name.localeCompare(b.name))

  const filteredSummary = filterProp
    ? summary.filter(p => String(p.property_id) === String(filterProp))
    : summary

  const alerts = certs.filter(c => c.status === 'expired' || c.status === 'expiring_soon')
    .filter(c => !filterProp || String(c.property_id) === String(filterProp))
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))

  const filtered = certs.filter(c => {
    if (filterStatus === 'attention' && c.status !== 'expired' && c.status !== 'expiring_soon') return false
    if (filterStatus !== 'all' && filterStatus !== 'attention' && c.status !== filterStatus) return false
    if (filterProp && String(c.property_id) !== String(filterProp)) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if      (sortCol === 'cert_label')   { av = a.cert_label || '';    bv = b.cert_label || '' }
    else if (sortCol === 'issue_date')   { av = a.issue_date || '';    bv = b.issue_date || '' }
    else if (sortCol === 'expiry_date')  { av = a.expiry_date || '';   bv = b.expiry_date || '' }
    else if (sortCol === 'status')       { av = a.status || '';        bv = b.status || '' }
    else if (sortCol === 'unit_name')    { av = a.unit_name || '';     bv = b.unit_name || '' }
    else if (sortCol === 'contractor')   { av = a.contractor || '';    bv = b.contractor || '' }
    else                                 { av = a.property_name || ''; bv = b.property_name || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Certificates, safety checks & expiry tracking">
        <div className="flex items-center gap-3">
          {allProps.length > 1 && (
            <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All properties</option>
              {allProps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={() => { setShowForm(true); setIsRenewal(false); setRenewingId(null) }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Add Certificate
          </button>
        </div>
      </PageHeader>

      {/* Add / Renew modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-5">{isRenewal ? 'Renew Certificate' : 'Add Certificate'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Property</label>
                <select value={form.property_id}
                  onChange={e => { setForm({...form, property_id: e.target.value ? Number(e.target.value) : '', unit_id: ''}); loadUnitsForProp(e.target.value, setFormUnits) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                  <option value="">Select property…</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {formUnits.length > 1 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unit <span className="text-gray-400">(optional — leave blank for whole-property certs)</span></label>
                  <select value={form.unit_id}
                    onChange={e => setForm({...form, unit_id: e.target.value ? Number(e.target.value) : ''})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Whole property</option>
                    {formUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Certificate Type</label>
                <select value={form.cert_type} onChange={e => setForm({...form, cert_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(CERT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>
              <input placeholder="Contractor (optional)" value={form.contractor} onChange={e => setForm({...form, contractor: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input placeholder="Reference / Certificate number (optional)" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400">You can attach the certificate document after saving by clicking the row in the table.</p>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => { setShowForm(false); setIsRenewal(false); setRenewingId(null); setFormUnits([]) }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className={`rounded-xl border p-4 mb-6 ${alerts.some(a => a.status === 'expired') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <h3 className="font-semibold text-sm mb-2 text-gray-800">
            {alerts.filter(a => a.status === 'expired').length > 0 && `⛔ ${alerts.filter(a => a.status === 'expired').length} expired  `}
            {alerts.filter(a => a.status === 'expiring_soon').length > 0 && `⚠ ${alerts.filter(a => a.status === 'expiring_soon').length} expiring within 60 days`}
          </h3>
          <div className="space-y-1.5">
            {alerts.map(a => (
              <div key={a.id} className="flex justify-between items-center bg-white rounded-lg px-4 py-2 border border-gray-100 text-sm">
                <span className="font-medium text-gray-800">{a.property_name}{a.unit_name ? ` · ${a.unit_name}` : ''} — {a.cert_label}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${a.status === 'expired' ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                    {a.status === 'expired' ? `Expired ${fmt(a.expiry_date)}` : `Expires ${fmt(a.expiry_date)} (${a.days_until_expiry}d)`}
                  </span>
                  <StatusBadge status={a.status} />
                  <button onClick={() => openRenew(a)}
                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 font-medium whitespace-nowrap">
                    Renew
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property compliance matrix */}
      <div className="space-y-4 mb-6">
        {filteredSummary.map(prop => (
          <div key={prop.property_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${(STATUS_STYLE[prop.overall_status] || STATUS_STYLE.missing).dot}`} />
                <Link to={`/properties/${prop.property_id}`} className="font-semibold text-gray-900 hover:text-indigo-600">{prop.property_name}</Link>
                <span className="text-xs text-gray-400 capitalize">{prop.property_type}</span>
              </div>
              <StatusBadge status={prop.overall_status} />
            </div>

            {prop.is_multi_unit ? (
              /* Multi-unit: one row per unit */
              <div className="divide-y divide-gray-100">
                {prop.units.map(unit => (
                  <div key={unit.unit_id} className="flex items-stretch">
                    <div className="w-28 shrink-0 px-3 py-3 flex items-center border-r border-gray-100 bg-gray-50/60">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${(STATUS_STYLE[unit.overall_status] || STATUS_STYLE.missing).dot}`} />
                        <p className="text-xs font-medium text-gray-700 truncate">{unit.unit_name}</p>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
                      {CERT_ORDER.map(ctype => {
                        const c = unit.certificates[ctype]
                        if (!c) return null
                        const cellBg = (STATUS_STYLE[c.status] || STATUS_STYLE.missing).cell
                        return (
                          <button key={ctype}
                            onClick={() => {
                              if (c.cert_id) {
                                const match = certs.find(x => x.id === c.cert_id)
                                if (match) openDetail(match)
                              } else {
                                openAddPrefilled(prop.property_id, ctype, unit.unit_id)
                              }
                            }}
                            className={`px-2 py-3 text-center hover:brightness-95 transition-all cursor-pointer ${cellBg}`}>
                            <p className="text-xs text-gray-400 mb-1">{CERT_SHORT[ctype]}</p>
                            <StatusBadge status={c.status} />
                            {c.expiry_date && <p className="text-xs text-gray-400 mt-1">{fmt(c.expiry_date)}</p>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Single-unit: one row for the property */
              <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
                {CERT_ORDER.map(ctype => {
                  const c = prop.certificates[ctype]
                  if (!c) return null
                  const cellBg = (STATUS_STYLE[c.status] || STATUS_STYLE.missing).cell
                  return (
                    <button key={ctype}
                      onClick={() => {
                        if (c.cert_id) {
                          const match = certs.find(x => x.id === c.cert_id)
                          if (match) openDetail(match)
                        } else {
                          openAddPrefilled(prop.property_id, ctype, null)
                        }
                      }}
                      className={`px-4 py-3 text-center hover:brightness-95 transition-all cursor-pointer ${cellBg}`}>
                      <p className="text-xs text-gray-400 mb-1">{CERT_SHORT[ctype]}</p>
                      <StatusBadge status={c.status} />
                      {c.expiry_date && <p className="text-xs text-gray-400 mt-1">{fmt(c.expiry_date)}</p>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail / Edit modal */}
      {selectedCert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{selectedCert.cert_label}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedCert.property_name}{selectedCert.unit_name ? ` · ${selectedCert.unit_name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 font-medium">
                    Edit
                  </button>
                )}
                <button onClick={() => { setSelectedCert(null); setEditMode(false) }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-1">×</button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* View mode */}
              {!editMode && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Status', <StatusBadge status={selectedCert.status} />],
                    ['Issue Date', fmt(selectedCert.issue_date)],
                    ['Expiry Date', <span className={selectedCert.status === 'expired' ? 'text-red-600 font-semibold' : selectedCert.status === 'expiring_soon' ? 'text-amber-600 font-semibold' : 'text-gray-700'}>{fmt(selectedCert.expiry_date)}</span>],
                    ['Contractor', selectedCert.contractor || '—'],
                    ['Reference', selectedCert.reference || '—'],
                    ['Notes', selectedCert.notes || '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <div className="font-medium text-gray-800">{val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit mode */}
              {editMode && (
                <form onSubmit={saveEdit} className="space-y-3">
                  {editUnits.length > 1 && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                      <select value={editForm.unit_id || ''}
                        onChange={e => setEditForm({...editForm, unit_id: e.target.value ? Number(e.target.value) : ''})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Whole property</option>
                        {editUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Certificate Type</label>
                    <select value={editForm.cert_type || ''}
                      onChange={e => setEditForm({...editForm, cert_type: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {Object.entries(CERT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Issue Date</label>
                      <input type="date" value={editForm.issue_date || ''} onChange={e => setEditForm({...editForm, issue_date: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                      <input type="date" value={editForm.expiry_date || ''} onChange={e => setEditForm({...editForm, expiry_date: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                  </div>
                  <input placeholder="Contractor" value={editForm.contractor || ''} onChange={e => setEditForm({...editForm, contractor: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input placeholder="Reference / Certificate number" value={editForm.reference || ''} onChange={e => setEditForm({...editForm, reference: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <textarea placeholder="Notes" value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex gap-3">
                    <button type="submit" disabled={saving}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditMode(false)}
                      className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Files */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Certificate Documents</p>
                {(certFiles[selectedCert.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 mb-2">No files attached yet</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {(certFiles[selectedCert.id] || []).map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <a href={dlUrl(f.id)} target="_blank" rel="noreferrer"
                          className="text-sm text-indigo-600 hover:underline truncate">
                          📎 {f.original_name}
                        </a>
                        <button onClick={() => handleDeleteFile(selectedCert.id, f.id)}
                          className="text-gray-300 hover:text-red-400 ml-2 shrink-0 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-xl px-4 py-4 cursor-pointer hover:border-indigo-400 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                  <span className="text-sm text-indigo-600 font-medium">{uploading ? 'Uploading…' : '+ Attach PDF, image or scan'}</span>
                  <input type="file" className="hidden" accept=".pdf,image/*" disabled={uploading}
                    onChange={e => e.target.files[0] && handleUpload(selectedCert.id, e.target.files[0])} />
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button onClick={() => deleteCert(selectedCert.id)}
                  className="text-sm text-red-400 hover:text-red-600">Delete record</button>
                {(selectedCert.status === 'expired' || selectedCert.status === 'expiring_soon') && (
                  <button onClick={() => { setSelectedCert(null); openRenew(selectedCert) }}
                    className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">
                    Renew Certificate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
