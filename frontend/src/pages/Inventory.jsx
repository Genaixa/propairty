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
  if (!cond) return <span className="text-gray-300 text-xs">—</span>
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${condColor[cond] || 'bg-gray-100 text-gray-600'}`}>{cond}</span>
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
  const [view, setView] = useState('list')    // list | create | detail | compare | review_draft
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


function InventoryBuilder({ leases, defaultRooms, draft, onSaved, onCancel }) {
  const [leaseId, setLeaseId] = useState(draft ? String(draft.lease_id) : '')
  const [invType, setInvType] = useState(draft?.inv_type ?? 'check_in')
  const [invDate, setInvDate] = useState(draft?.inv_date ?? new Date().toISOString().slice(0, 10))
  const [conductedBy, setConductedBy] = useState(draft?.conducted_by ?? '')
  const [tenantPresent, setTenantPresent] = useState(draft?.tenant_present ?? true)
  const [overallNotes, setOverallNotes] = useState(draft?.overall_notes ?? '')
  const [meterElectric, setMeterElectric] = useState(draft?.meter_electric ?? '')
  const [meterGas, setMeterGas] = useState(draft?.meter_gas ?? '')
  const [meterWater, setMeterWater] = useState(draft?.meter_water ?? '')
  const [keysHanded, setKeysHanded] = useState(draft?.keys_handed ?? '')
  const [rooms, setRooms] = useState(() => {
    if (draft?.rooms?.length) {
      return draft.rooms.map((r, ri) => ({
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

  function loadDefaultRooms() {
    const built = Object.entries(defaultRooms).map(([roomName, items], ri) => ({
      room_name: roomName,
      order: ri,
      notes: '',
      items: items.map((item, ii) => ({ item_name: item, condition: '', notes: '', order: ii })),
    }))
    setRooms(built)
  }

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
      if (draft) {
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Lease / Tenant</label>
            <select value={leaseId} onChange={e => setLeaseId(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select lease…</option>
              {leases.map(l => <option key={l.id} value={l.id}>{l.tenant_name} — {l.unit}</option>)}
            </select>
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
        <div className="grid grid-cols-4 gap-3">
          {[['Electric', meterElectric, setMeterElectric], ['Gas', meterGas, setMeterGas],
            ['Water', meterWater, setMeterWater], ['Keys Handed', keysHanded, setKeysHanded]].map(([label, val, set]) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={label === 'Keys Handed' ? 'e.g. 2 front door' : '00000'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Room builder */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Rooms &amp; Items</h3>
        <div className="flex gap-2">
          <button onClick={loadDefaultRooms} type="button"
            className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
            Load Default Rooms
          </button>
          <button onClick={addRoom} type="button"
            className="text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
            + Add Room
          </button>
        </div>
      </div>

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


function InventoryDetail({ inv, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{inv.inv_type === 'check_in' ? 'Check-In' : 'Check-Out'} Inventory</h3>
            <p className="text-sm text-gray-500">{inv.tenant_name} · {inv.unit}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadPdf(`${BASE}/inventory/${inv.id}/report`, `Inventory_${inv.tenant_name.replace(' ', '_')}.pdf`)}
              className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg">PDF</button>
            <button onClick={() => { if (confirm('Delete this inventory?')) onDelete() }}
              className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg">Delete</button>
          </div>
        </div>
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{lease.tenant_name} — {lease.unit}</h3>
          <p className="text-sm text-gray-500">
            Check-In: {check_in?.inv_date} &nbsp;→&nbsp; Check-Out: {check_out?.inv_date}
          </p>
        </div>
        <button onClick={onDownload}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Download Comparison PDF
        </button>
      </div>

      {declined_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700 text-sm mb-2">{declined_count} item{declined_count > 1 ? 's' : ''} with declined condition</p>
          <div className="space-y-1">
            {declined_items.map((d, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-red-700">
                <span className="font-medium">{d.room} — {d.item}:</span>
                <CondBadge cond={d.in_condition} />
                <span className="text-red-400">→</span>
                <CondBadge cond={d.out_condition} />
              </div>
            ))}
          </div>
        </div>
      )}

      {comparison?.filter(room => room.items.some(i => i.item_name?.trim() && (i.condition || i.out_condition))).map(room => {
        const filledItems = room.items.filter(i => i.item_name?.trim() && (i.condition || i.out_condition))
        const hasChanges = filledItems.some(i => i.changed)
        return (
          <div key={room.room_name} className={`bg-white rounded-xl border overflow-hidden ${hasChanges ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className={`px-5 py-3 border-b ${hasChanges ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <h4 className="font-semibold text-gray-800">{room.room_name}</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2">Item</th>
                  <th className="text-center px-5 py-2">Check-In</th>
                  <th className="text-center px-5 py-2">Check-Out</th>
                  <th className="text-center px-5 py-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filledItems.map((item, i) => (
                  <tr key={i} className={item.changed ? 'bg-red-50/40' : 'hover:bg-gray-50'}>
                    <td className="px-5 py-2.5 text-gray-700">{item.item_name}</td>
                    <td className="px-5 py-2.5 text-center"><CondBadge cond={item.condition} /></td>
                    <td className="px-5 py-2.5 text-center"><CondBadge cond={item.out_condition} /></td>
                    <td className="px-5 py-2.5 text-center text-xs font-bold">
                      {item.changed ? <span className="text-red-600">▼</span>
                        : item.improved ? <span className="text-green-600">▲</span>
                        : <span className="text-gray-300">—</span>}
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
