import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'missing', 'n/a']

const condColor = {
  excellent: 'bg-green-100 text-green-700',
  good:      'bg-blue-100 text-blue-700',
  fair:      'bg-amber-100 text-amber-700',
  poor:      'bg-red-100 text-red-700',
  missing:   'bg-purple-100 text-purple-700',
  'n/a':     'bg-gray-100 text-gray-500',
}

function CondBadge({ cond }) {
  if (!cond) return <span className="inline-flex items-center justify-center w-20 text-gray-300 text-xs">—</span>
  return (
    <span className={`inline-flex items-center justify-center w-20 text-xs font-semibold px-2 py-1 rounded-md ${condColor[cond] || 'bg-gray-100 text-gray-600'}`}>
      {cond}
    </span>
  )
}

function downloadPdf(url, filename) {
  const token = localStorage.getItem('token')
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
    })
}

export default function Inventory() {
  const [inventories, setInventories] = useState([])
  const [drafts, setDrafts] = useState([])
  const [leases, setLeases] = useState([])
  const [defaultRooms, setDefaultRooms] = useState({})
  const [view, setView] = useState('list')    // list | create | edit | detail | compare | review_draft
  const [selected, setSelected] = useState(null)
  const [compareData, setCompareData] = useState(null)
  const [compareLease, setCompareLease] = useState(null)
  const [reviewDraft, setReviewDraft] = useState(null)

  const load = async () => {
    const [ir, lr, dr, draftsR] = await Promise.all([
      api.get('/inventory'),
      api.get('/inventory/leases'),
      api.get('/inventory/default-rooms'),
      api.get('/inventory/drafts'),
    ])
    setInventories(ir.data)
    setLeases(lr.data)
    setDefaultRooms(dr.data)
    setDrafts(draftsR.data)
  }

  useEffect(() => { load() }, [])

  async function openDetail(inv) {
    const r = await api.get(`/inventory/${inv.id}`)
    setSelected(r.data)
    setView('detail')
  }

  async function openDraftReview(draft) {
    const r = await api.get(`/inventory/${draft.id}`)
    setReviewDraft(r.data)
    setView('review_draft')
  }

  async function openCompare(lease) {
    const r = await api.get(`/inventory/compare/${lease.id}`)
    setCompareData(r.data)
    setCompareLease(lease)
    setView('compare')
  }

  const leasesWithBoth = leases.filter(l => l.has_check_in && l.has_check_out)

  // Group inventories by tenant+unit into single rows
  const grouped = Object.values(
    inventories.reduce((acc, inv) => {
      const key = `${inv.tenant_name}||${inv.unit}`
      if (!acc[key]) acc[key] = {
        tenant_name: inv.tenant_name,
        tenant_id: inv.tenant_id,
        unit: inv.unit,
        unit_id: inv.unit_id,
        property_id: inv.property_id,
        check_in: null,
        check_out: null,
      }
      if (inv.inv_type === 'check_in') acc[key].check_in = inv
      else acc[key].check_out = inv
      return acc
    }, {})
  )

  const [sortCol, setSortCol] = useState('tenant_name')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  const sortedGrouped = [...grouped].sort((a, b) => {
    let av, bv
    if      (sortCol === 'unit')       { av = a.unit;                              bv = b.unit }
    else if (sortCol === 'check_in')   { av = a.check_in?.inv_date || '';          bv = b.check_in?.inv_date || '' }
    else if (sortCol === 'check_out')  { av = a.check_out?.inv_date || '';         bv = b.check_out?.inv_date || '' }
    else                               { av = a.tenant_name;                       bv = b.tenant_name }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Room-by-room item tracking & condition records">
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setSelected(null); setCompareData(null); setReviewDraft(null) }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-4 py-2 rounded-lg">
            ← Back
          </button>
        )}
        {view === 'list' && (
          <button onClick={() => setView('create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + New Inventory
          </button>
        )}
      </PageHeader>

      {/* Telegram Drafts */}
      {view === 'list' && drafts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-gray-800">Telegram Drafts</h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{drafts.length}</span>
          </div>
          <div className="space-y-2">
            {drafts.map(draft => (
              <div key={draft.id} className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{draft.tenant_name} — {draft.unit}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {draft.inv_type === 'check_in' ? 'Check-In' : 'Check-Out'} · {fmt(draft.inv_date)} · {draft.rooms?.length ?? 0} rooms
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDraftReview(draft)}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
                    Review &amp; Confirm
                  </button>
                  <button onClick={async () => { if (confirm('Discard this draft?')) { await api.delete(`/inventory/${draft.id}`); load() } }}
                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded-lg">
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {grouped.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No inventories recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase w-10"></th>
                    <SortTh col="unit" label="Property / Unit" />
                    <SortTh col="tenant_name" label="Tenant" />
                    <SortTh col="check_in" label="Check-In" />
                    <SortTh col="check_out" label="Check-Out" />
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedGrouped.map(row => {
                    const lease = leasesWithBoth.find(l => l.tenant_name === row.tenant_name && l.unit === row.unit)
                    return (
                      <tr key={`${row.tenant_name}||${row.unit}`} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5">
                          <button onClick={() => openDetail(row.check_in || row.check_out)}
                            className="text-xs bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-600 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap">
                            View
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {row.property_id
                            ? <Link to={`/properties/${row.property_id}`} className="text-indigo-600 hover:underline">{row.unit}</Link>
                            : <span className="text-gray-500">{row.unit}</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 font-medium">
                          {row.tenant_id
                            ? <Link to={`/tenants/${row.tenant_id}`} className="text-indigo-600 hover:underline">{row.tenant_name}</Link>
                            : <span>{row.tenant_name}</span>
                          }
                        </td>
                        <td className="px-5 py-3.5">
                          {row.check_in ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openDetail(row.check_in)} className="text-gray-700 hover:text-indigo-600 hover:underline">{fmt(row.check_in.inv_date)}</button>
                              <button onClick={() => downloadPdf(`${BASE}/inventory/${row.check_in.id}/report`, `CheckIn_${row.tenant_name.replace(' ','_')}.pdf`)} className="text-xs text-gray-400 hover:text-gray-600">PDF</button>
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {row.check_out ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openDetail(row.check_out)} className="text-gray-700 hover:text-indigo-600 hover:underline">{fmt(row.check_out.inv_date)}</button>
                              <button onClick={() => downloadPdf(`${BASE}/inventory/${row.check_out.id}/report`, `CheckOut_${row.tenant_name.replace(' ','_')}.pdf`)} className="text-xs text-gray-400 hover:text-gray-600">PDF</button>
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {lease && (
                            <button onClick={() => openCompare(lease)}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-medium">
                              Compare
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create view */}
      {view === 'create' && (
        <InventoryBuilder
          leases={leases}
          defaultRooms={defaultRooms}
          onSaved={() => { load(); setView('list') }}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'edit' && selected && (
        <InventoryBuilder
          leases={leases}
          defaultRooms={defaultRooms}
          editInv={selected}
          onSaved={async () => { await load(); setView('detail') }}
          onCancel={() => setView('detail')}
        />
      )}

      {/* Review draft (from Telegram bot) */}
      {view === 'review_draft' && reviewDraft && (
        <InventoryBuilder
          leases={leases}
          defaultRooms={defaultRooms}
          draft={reviewDraft}
          onSaved={() => { load(); setView('list') }}
          onCancel={() => setView('list')}
        />
      )}

      {/* Detail view */}
      {view === 'detail' && selected && (
        <InventoryDetail
          inv={selected}
          onEdit={() => setView('edit')}
          onAckSent={load}
          onDelete={async () => {
            await api.delete(`/inventory/${selected.id}`)
            load(); setView('list')
          }}
        />
      )}

      {/* Comparison view */}
      {view === 'compare' && compareData && (
        <ComparisonView
          data={compareData}
          lease={compareLease}
          onDownload={() => downloadPdf(
            `${BASE}/inventory/compare/${compareLease.id}/report`,
            `InventoryComparison_${compareLease.tenant_name.replace(' ', '_')}.pdf`
          )}
        />
      )}
    </div>
  )
}


const PRESET_KEYS = ['Front', 'Back', 'Garage', 'Garden', 'Yard']

function parseKeys(str) {
  const counts = Object.fromEntries(PRESET_KEYS.map(k => [k, 0]))
  const others = []
  if (!str) return { counts, others }
  str.split(',').map(s => s.trim()).forEach(part => {
    const m = part.match(/^(\d+)\s+(.+)$/)
    if (!m) return
    const n = parseInt(m[1]), label = m[2].trim()
    const preset = PRESET_KEYS.find(k => k.toLowerCase() === label.toLowerCase())
    if (preset) counts[preset] = n
    else others.push({ label, count: n })
  })
  return { counts, others }
}

function serializeKeys(counts, others) {
  const parts = []
  PRESET_KEYS.forEach(k => { if (counts[k] > 0) parts.push(`${counts[k]} ${k.toLowerCase()}`) })
  others.forEach(o => { if (o.count > 0 && o.label.trim()) parts.push(`${o.count} ${o.label.trim()}`) })
  return parts.join(', ')
}

function KeysInput({ value, onChange }) {
  const parsed = parseKeys(value)
  const [counts, setCounts] = useState(parsed.counts)
  const [others, setOthers] = useState(parsed.others.length ? parsed.others : [])

  function update(newCounts, newOthers) {
    setCounts(newCounts)
    setOthers(newOthers)
    onChange(serializeKeys(newCounts, newOthers))
  }

  function setCount(key, val) {
    const n = Math.max(0, parseInt(val) || 0)
    update({ ...counts, [key]: n }, others)
  }

  function setOtherField(i, field, val) {
    const next = others.map((o, idx) => idx === i ? { ...o, [field]: field === 'count' ? Math.max(0, parseInt(val) || 0) : val } : o)
    update(counts, next)
  }

  function addOther() { update(counts, [...others, { label: '', count: 1 }]) }
  function removeOther(i) { update(counts, others.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_KEYS.map(key => (
          <div key={key} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-600 w-14">{key}</span>
            <input
              type="number" min={0} value={counts[key]}
              onChange={e => setCount(key, e.target.value)}
              className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        ))}
      </div>
      {others.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text" placeholder="e.g. Swimming pool, Stable…" value={o.label}
            onChange={e => setOtherField(i, 'label', e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="number" min={0} value={o.count}
            onChange={e => setOtherField(i, 'count', e.target.value)}
            className="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="button" onClick={() => removeOther(i)} className="text-gray-400 hover:text-red-500 text-lg px-1">×</button>
        </div>
      ))}
      <button type="button" onClick={addOther}
        className="text-xs text-indigo-600 hover:underline font-medium">
        + Other key type
      </button>
      {value && <p className="text-xs text-gray-400">Will record: <span className="text-gray-600">{value}</span></p>}
    </div>
  )
}


function InventoryBuilder({ leases, defaultRooms, draft, editInv, onSaved, onCancel }) {
  const prefill = editInv || draft
  const [leaseId, setLeaseId] = useState(prefill ? String(prefill.lease_id) : '')
  const [invType, setInvType] = useState(prefill?.inv_type ?? 'check_in')
  const [invDate, setInvDate] = useState(prefill?.inv_date ?? new Date().toISOString().slice(0, 10))
  const [conductedBy, setConductedBy] = useState(prefill?.conducted_by ?? '')
  const [tenantPresent, setTenantPresent] = useState(prefill?.tenant_present ?? true)
  const [overallNotes, setOverallNotes] = useState(prefill?.overall_notes ?? '')
  const [meterElectric, setMeterElectric] = useState(prefill?.meter_electric ?? '')
  const [meterGas, setMeterGas] = useState(prefill?.meter_gas ?? '')
  const [meterWater, setMeterWater] = useState(prefill?.meter_water ?? '')
  const [keysHanded, setKeysHanded] = useState(prefill?.keys_handed ?? '')
  const [rooms, setRooms] = useState(() => {
    if (prefill?.rooms?.length) {
      return prefill.rooms.map((r, ri) => ({
        room_name: r.room_name,
        order: ri,
        notes: r.notes ?? '',
        items: r.items.map((i, ii) => ({
          item_name: i.item_name,
          condition: i.condition ?? '',
          notes: i.notes ?? '',
          order: ii,
        })),
      }))
    }
    return []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [templateInfo, setTemplateInfo] = useState(null) // { source, inv_type, inv_date }
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Auto-load template when lease changes (new inventories only, not edits/drafts)
  useEffect(() => {
    if (prefill || !leaseId) return
    setLoadingTemplate(true)
    setTemplateInfo(null)
    api.get(`/inventory/template/${leaseId}`)
      .then(r => {
        const { rooms: tRooms, source, inv_type, inv_date } = r.data
        setRooms(tRooms.map((r, ri) => ({
          room_name: r.room_name,
          order: ri,
          notes: r.notes ?? '',
          items: r.items.map((i, ii) => ({
            item_name: i.item_name,
            condition: i.condition ?? '',
            notes: i.notes ?? '',
            order: ii,
          })),
        })))
        setTemplateInfo({ source, inv_type, inv_date })
      })
      .catch(() => {})
      .finally(() => setLoadingTemplate(false))
  }, [leaseId])

  function addRoom() {
    setRooms([...rooms, { room_name: '', order: rooms.length, notes: '', items: [] }])
  }

  function addItem(ri) {
    const updated = [...rooms]
    updated[ri].items.push({ item_name: '', condition: '', notes: '', order: updated[ri].items.length })
    setRooms(updated)
  }

  function updateRoom(ri, field, val) {
    const updated = [...rooms]
    updated[ri][field] = val
    setRooms(updated)
  }

  function updateItem(ri, ii, field, val) {
    const updated = [...rooms]
    updated[ri].items[ii][field] = val
    setRooms(updated)
  }

  function removeRoom(ri) {
    setRooms(rooms.filter((_, i) => i !== ri))
  }

  function removeItem(ri, ii) {
    const updated = [...rooms]
    updated[ri].items = updated[ri].items.filter((_, i) => i !== ii)
    setRooms(updated)
  }

  async function handleSave() {
    if (!leaseId) { setError('Please select a lease'); return }
    if (rooms.length === 0) { setError('Add at least one room'); return }
    setSaving(true)
    setError('')
    const payload = {
      lease_id: parseInt(leaseId),
      inv_type: invType,
      inv_date: invDate,
      conducted_by: conductedBy || null,
      tenant_present: tenantPresent,
      overall_notes: overallNotes || null,
      meter_electric: meterElectric || null,
      meter_gas: meterGas || null,
      meter_water: meterWater || null,
      keys_handed: keysHanded || null,
      rooms: rooms.map((r, ri) => ({
        room_name: r.room_name,
        order: ri,
        notes: r.notes || null,
        items: r.items.map((i, ii) => ({
          item_name: i.item_name,
          condition: i.condition || null,
          notes: i.notes || null,
          order: ii,
        })).filter(i => i.item_name),
      })).filter(r => r.room_name),
    }
    try {
      if (editInv) {
        await api.put(`/inventory/${editInv.id}`, payload)
      } else if (draft) {
        await api.post(`/inventory/${draft.id}/confirm`, payload)
      } else {
        await api.post('/inventory', payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Header fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenancy</label>
            {leases.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No active leases found. Create a lease first before recording an inventory.
              </p>
            ) : (
              <select value={leaseId} onChange={e => setLeaseId(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select property / unit…</option>
                {Object.entries(
                  leases.reduce((acc, l) => {
                    const p = l.property_name || l.unit.split(' · ')[0] || 'Unknown'
                    if (!acc[p]) acc[p] = []
                    acc[p].push(l)
                    return acc
                  }, {})
                ).map(([propName, propLeases]) => (
                  <optgroup key={propName} label={propName}>
                    {propLeases.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.unit_name || l.unit} — {l.tenant_name}
                        {l.has_check_in && !l.has_check_out ? ' ✓ check-in done' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2 mt-1">
              {['check_in', 'check_out'].map(t => (
                <button key={t} type="button" onClick={() => setInvType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    invType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {t === 'check_in' ? 'Check-In' : 'Check-Out'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conducted By</label>
            <input value={conductedBy} onChange={e => setConductedBy(e.target.value)} placeholder="Agent name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tenantPresent} onChange={e => setTenantPresent(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded" />
              <span className="text-sm text-gray-700">Tenant Present</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[['Electric', meterElectric, setMeterElectric], ['Gas', meterGas, setMeterGas],
            ['Water', meterWater, setMeterWater]].map(([label, val, set]) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder="00000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Keys Handed</label>
          <KeysInput value={keysHanded} onChange={setKeysHanded} />
        </div>
      </div>

      {/* Room builder */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Rooms &amp; Items</h3>
        <button onClick={addRoom} type="button"
          className="text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
          + Add Room
        </button>
      </div>

      {loadingTemplate && (
        <p className="text-xs text-gray-400 animate-pulse">Loading rooms for this tenancy…</p>
      )}

      {templateInfo && !loadingTemplate && (
        <div className={`rounded-lg px-4 py-2.5 text-xs flex items-center gap-2 ${templateInfo.source === 'inventory' ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
          {templateInfo.source === 'inventory' ? (
            <>
              <span>📋</span>
              <span>
                Rooms and conditions pre-loaded from last {templateInfo.inv_type === 'check_in' ? 'check-in' : 'check-out'}
                {templateInfo.inv_date ? ` (${new Date(templateInfo.inv_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}.
                Update any items whose condition has changed.
              </span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>No previous inventory for this unit — loaded default room template. Conditions are blank.</span>
            </>
          )}
        </div>
      )}

      {rooms.map((room, ri) => (
        <div key={ri} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <input value={room.room_name} onChange={e => updateRoom(ri, 'room_name', e.target.value)}
              placeholder="Room name (e.g. Living Room)"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => removeRoom(ri)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
          </div>
          <div className="divide-y divide-gray-100">
            {room.items.map((item, ii) => (
              <div key={ii} className="px-4 py-2.5 flex items-center gap-3">
                <input value={item.item_name} onChange={e => updateItem(ri, ii, 'item_name', e.target.value)}
                  placeholder="Item (e.g. Carpet)"
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={item.condition} onChange={e => updateItem(ri, ii, 'condition', e.target.value)}
                  className={`px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${item.condition ? condColor[item.condition] : ''}`}>
                  <option value="">Condition…</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={item.notes} onChange={e => updateItem(ri, ii, 'notes', e.target.value)}
                  placeholder="Notes…"
                  className="w-40 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => removeItem(ri, ii)} className="text-gray-300 hover:text-red-400">&times;</button>
              </div>
            ))}
            <div className="px-4 py-2">
              <button onClick={() => addItem(ri)} className="text-xs text-indigo-600 hover:text-indigo-800">+ Add Item</button>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Overall Notes</label>
        <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : draft ? 'Confirm & Save' : 'Save Inventory'}
        </button>
      </div>
    </div>
  )
}


function InventoryDetail({ inv, onDelete, onEdit, onAckSent }) {
  const [sending, setSending] = useState(false)
  const [sendDone, setSendDone] = useState(false)
  const [sendError, setSendError] = useState('')

  async function sendAck() {
    setSending(true); setSendError('')
    try {
      await api.post(`/inventory/${inv.id}/send-acknowledgement`)
      setSendDone(true)
      if (onAckSent) onAckSent()
    } catch (e) {
      setSendError(e.response?.data?.detail || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{inv.inv_type === 'check_in' ? 'Check-In' : 'Check-Out'} Inventory</h3>
            <p className="text-sm text-gray-500">{inv.tenant_name} · {inv.unit}</p>
            <div className="mt-1.5">
              {inv.tenant_acknowledged_at ? (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                  ✓ Acknowledged {new Date(inv.tenant_acknowledged_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                </span>
              ) : inv.ack_sent_at ? (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                  ⏳ Sent {new Date(inv.ack_sent_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })} — awaiting tenant
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 font-semibold px-2.5 py-1 rounded-full">
                  Pending acknowledgement
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => downloadPdf(`${BASE}/inventory/${inv.id}/report`, `Inventory_${inv.tenant_name.replace(' ', '_')}.pdf`)}
              className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg">PDF</button>
            {!inv.is_locked && (
              <>
                <button onClick={onEdit}
                  className="text-sm text-gray-700 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg">Edit</button>
                <button onClick={sendAck} disabled={sending || sendDone}
                  className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {sendDone ? '✓ Sent' : sending ? 'Sending…' : inv.ack_sent_at ? 'Resend to Tenant' : 'Send to Tenant'}
                </button>
              </>
            )}
            {!inv.is_locked && (
              <button onClick={() => { if (confirm('Delete this inventory?')) onDelete() }}
                className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg">Delete</button>
            )}
          </div>
        </div>
        {sendError && <p className="text-xs text-red-500 mb-2">{sendError}</p>}
        <div className="grid grid-cols-4 gap-3 text-sm">
          {[['Date', fmt(inv.inv_date)], ['Conducted By', inv.conducted_by || '—'],
            ['Tenant Present', inv.tenant_present ? 'Yes' : 'No'],
            ['Electric', inv.meter_electric || '—'], ['Gas', inv.meter_gas || '—'],
            ['Water', inv.meter_water || '—'], ['Keys', inv.keys_handed || '—']].map(([l, v]) => (
            <div key={l} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{l}</p>
              <p className="font-medium text-gray-900 text-xs mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {inv.rooms
        .filter(room => room.items.some(i => i.item_name?.trim() && i.condition && i.condition !== 'n/a'))
        .map(room => {
          const filledItems = room.items.filter(i => i.item_name?.trim() && i.condition && i.condition !== 'n/a')
          return (
            <div key={room.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h4 className="font-semibold text-gray-800">{room.room_name}</h4>
                {room.notes && <p className="text-xs text-gray-500 mt-0.5">{room.notes}</p>}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {filledItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-700 w-1/2">{item.item_name}</td>
                      <td className="px-5 py-2.5"><CondBadge cond={item.condition} /></td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {room.photos?.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
                  {room.photos.map(p => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={p.original_name}
                        className="h-20 w-20 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })
      }
    </div>
  )
}


function ComparisonView({ data, lease, onDownload }) {
  const { check_in, check_out, comparison, declined_items, declined_count } = data
  const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{lease.tenant_name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{lease.unit}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Check-In</p>
                <p className="text-sm font-semibold text-blue-700">{fmtD(check_in?.inv_date)}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="text-center px-4 py-2 bg-orange-50 rounded-lg">
                <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide mb-0.5">Check-Out</p>
                <p className="text-sm font-semibold text-orange-700">{fmtD(check_out?.inv_date)}</p>
              </div>
            </div>
          </div>
          <button onClick={onDownload}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* Declined items summary */}
      {declined_count > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-rose-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-semibold text-rose-700">
              {declined_count} item{declined_count !== 1 ? 's' : ''} declined in condition
            </p>
          </div>
          <table className="w-full text-sm">
            <colgroup>
              <col className="w-auto" />
              <col className="w-24" />
              <col className="w-6" />
              <col className="w-24" />
            </colgroup>
            <tbody className="divide-y divide-rose-100">
              {declined_items.map((d, i) => (
                <tr key={i}>
                  <td className="px-5 py-2.5 text-rose-800 font-medium">{d.room} — {d.item}</td>
                  <td className="py-2.5 text-center"><CondBadge cond={d.in_condition} /></td>
                  <td className="py-2.5 text-center">
                    <svg className="w-3.5 h-3.5 text-rose-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </td>
                  <td className="pr-5 py-2.5 text-center"><CondBadge cond={d.out_condition} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Room-by-room comparison */}
      {comparison?.filter(room => room.items.some(i => i.item_name?.trim() && (i.condition || i.out_condition))).map(room => {
        const filledItems = room.items.filter(i => i.item_name?.trim() && (i.condition || i.out_condition))
        const changedCount = filledItems.filter(i => i.changed).length
        return (
          <div key={room.room_name} className={`bg-white rounded-xl border overflow-hidden ${changedCount > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
            {/* Room header */}
            <div className={`flex items-center justify-between px-5 py-3 border-b ${changedCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <h4 className="font-semibold text-gray-800">{room.room_name}</h4>
              {changedCount > 0 && (
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {changedCount} change{changedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <colgroup>
                <col className="w-auto" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-16" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Item</th>
                  <th className="text-center py-2.5 text-xs font-medium text-blue-400">Check-In</th>
                  <th className="text-center py-2.5 text-xs font-medium text-orange-400">Check-Out</th>
                  <th className="text-center pr-5 py-2.5 text-xs font-medium text-gray-400">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filledItems.map((item, i) => (
                  <tr key={i} className={item.changed ? 'bg-rose-50/50' : item.improved ? 'bg-emerald-50/40' : 'hover:bg-gray-50/60'}>
                    <td className="px-5 py-3 text-gray-700 font-medium">{item.item_name}</td>
                    <td className="py-3 text-center"><CondBadge cond={item.condition} /></td>
                    <td className="py-3 text-center"><CondBadge cond={item.out_condition} /></td>
                    <td className="pr-5 py-3 text-center">
                      {item.changed
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold">▼</span>
                        : item.improved
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">▲</span>
                          : <span className="text-gray-200 text-sm">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
