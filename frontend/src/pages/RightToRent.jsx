import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const DOC_LABELS = {
  british_passport: 'British Passport',
  uk_passport: 'UK Passport',
  euss_settled: 'EUSS Settled Status',
  euss_pre_settled: 'EUSS Pre-Settled',
  brp: 'Biometric Residence Permit',
  visa: 'Visa',
  other: 'Other',
}

const STATUS_COLORS = {
  valid: 'bg-green-100 text-green-800',
  valid_indefinite: 'bg-green-100 text-green-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-800',
  not_checked: 'bg-red-100 text-red-800',
}

export default function RightToRent() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [sortCol, setSortCol] = useState('full_name')
  const [sortDir, setSortDir] = useState('asc')
  const [activeFilter, setActiveFilter] = useState(null)

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  const STATUS_ORDER = { expired: 0, not_checked: 1, expiring_soon: 2, valid: 3, valid_indefinite: 4 }

  const sortedTenants = [...tenants].sort((a, b) => {
    let av, bv
    if (sortCol === 'rtr_check_date' || sortCol === 'rtr_expiry_date') {
      av = a[sortCol] || '9999'
      bv = b[sortCol] || '9999'
    } else if (sortCol === 'status') {
      av = STATUS_ORDER[a.status] ?? 99
      bv = STATUS_ORDER[b.status] ?? 99
      return sortDir === 'asc' ? av - bv : bv - av
    } else {
      av = (a[sortCol] || '').toLowerCase()
      bv = (b[sortCol] || '').toLowerCase()
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const displayedTenants = activeFilter ? sortedTenants.filter(t => t.status === activeFilter) : sortedTenants
  function toggleFilter(f) { setActiveFilter(v => v === f ? null : f) }

  const [form, setForm] = useState({ rtr_document_type: 'british_passport', rtr_check_date: '', rtr_expiry_date: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/rtr').then(r => { setTenants(r.data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const openEdit = (t) => {
    setEditing(t.tenant_id)
    setForm({
      rtr_document_type: t.rtr_document_type || 'british_passport',
      rtr_check_date: t.rtr_check_date || new Date().toISOString().split('T')[0],
      rtr_expiry_date: t.rtr_expiry_date || '',
    })
  }

  const save = async () => {
    setSaving(true)
    await api.put(`/rtr/${editing}`, {
      rtr_document_type: form.rtr_document_type,
      rtr_check_date: form.rtr_check_date,
      rtr_expiry_date: form.rtr_expiry_date || null,
    })
    setSaving(false)
    setEditing(null)
    load()
  }

  const counts = {
    expired: tenants.filter(t => t.status === 'expired').length,
    expiring_soon: tenants.filter(t => t.status === 'expiring_soon').length,
    not_checked: tenants.filter(t => t.status === 'not_checked').length,
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div>
      <PageHeader title="Right to Rent" subtitle="UK immigration status checks · £20,000 penalty for non-compliance" />

      {(counts.expired > 0 || counts.expiring_soon > 0 || counts.not_checked > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {counts.expired > 0 && (
            <button onClick={() => toggleFilter('expired')} className={`rounded-xl border p-4 text-center transition-all ${activeFilter === 'expired' ? 'ring-2 ring-red-400 bg-red-100 border-red-400' : 'bg-red-50 border-red-200 hover:ring-2 hover:ring-red-300'}`}>
              <div className="text-2xl font-bold text-red-700">{counts.expired}</div>
              <div className="text-sm text-red-600 font-medium">Expired</div>
            </button>
          )}
          {counts.expiring_soon > 0 && (
            <button onClick={() => toggleFilter('expiring_soon')} className={`rounded-xl border p-4 text-center transition-all ${activeFilter === 'expiring_soon' ? 'ring-2 ring-amber-400 bg-amber-100 border-amber-400' : 'bg-amber-50 border-amber-200 hover:ring-2 hover:ring-amber-300'}`}>
              <div className="text-2xl font-bold text-amber-700">{counts.expiring_soon}</div>
              <div className="text-sm text-amber-600 font-medium">Expiring Soon</div>
            </button>
          )}
          {counts.not_checked > 0 && (
            <button onClick={() => toggleFilter('not_checked')} className={`rounded-xl border p-4 text-center transition-all ${activeFilter === 'not_checked' ? 'ring-2 ring-red-400 bg-red-100 border-red-400' : 'bg-red-50 border-red-200 hover:ring-2 hover:ring-red-300'}`}>
              <div className="text-2xl font-bold text-red-700">{counts.not_checked}</div>
              <div className="text-sm text-red-600 font-medium">Not Checked</div>
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {activeFilter && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            Filtered: <span className="font-medium text-gray-700">{{ expired: 'Expired', expiring_soon: 'Expiring Soon', not_checked: 'Not Checked' }[activeFilter]}</span>
            · {displayedTenants.length} result{displayedTenants.length !== 1 ? 's' : ''}
            <button onClick={() => setActiveFilter(null)} className="ml-auto text-indigo-600 hover:underline">Show all</button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <SortTh col="full_name" label="Tenant" />
              <SortTh col="rtr_document_type" label="Document" />
              <SortTh col="rtr_check_date" label="Check Date" />
              <SortTh col="rtr_expiry_date" label="Expiry" />
              <SortTh col="status" label="Status" />
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedTenants.map(t => (
              <tr key={t.tenant_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{t.rtr_document_type ? DOC_LABELS[t.rtr_document_type] || t.rtr_document_type : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{fmt(t.rtr_check_date)}</td>
                <td className="px-4 py-3 text-gray-600">{t.rtr_expiry_date ? fmt(t.rtr_expiry_date) : 'No expiry'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                    {t.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(t)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="p-8 text-center text-gray-400">No tenants found.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Update Right to Rent Check</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select
                  value={form.rtr_document_type}
                  onChange={e => setForm({ ...form, rtr_document_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(DOC_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Date</label>
                <input
                  type="date"
                  value={form.rtr_check_date}
                  onChange={e => setForm({ ...form, rtr_check_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date <span className="text-gray-400 font-normal">(leave blank — British/ILR/Settled)</span>
                </label>
                <input
                  type="date"
                  value={form.rtr_expiry_date}
                  onChange={e => setForm({ ...form, rtr_expiry_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
