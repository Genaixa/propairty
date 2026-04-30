import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const SCHEMES = ['TDS', 'DPS', 'MyDeposits', 'Other']
const STATUS_STEPS = ['unprotected', 'protected', 'pi_served', 'returned']

const statusLabel = {
  unprotected: 'Unprotected',
  protected: 'Protected',
  pi_served: 'PI Served',
  returned: 'Returned',
  disputed: 'Disputed',
}

const statusColor = {
  unprotected: 'bg-red-100 text-red-700',
  protected: 'bg-amber-100 text-amber-700',
  pi_served: 'bg-blue-100 text-blue-700',
  returned: 'bg-green-100 text-green-700',
  disputed: 'bg-purple-100 text-purple-700',
}

function Badge({ status }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabel[status] || status}
    </span>
  )
}

function UrgencyFlag({ d }) {
  if (d.protection_overdue)
    return <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Protection overdue!</span>
  if (d.pi_overdue)
    return <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">PI overdue!</span>
  if (d.days_to_protect !== null && d.days_to_protect >= 0 && d.days_to_protect <= 7)
    return <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Protect in {d.days_to_protect}d</span>
  if (d.days_to_pi !== null && d.days_to_pi >= 0 && d.days_to_pi <= 7)
    return <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">PI in {d.days_to_pi}d</span>
  return null
}

export default function Deposits() {
  const [deposits, setDeposits] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [leases, setLeases] = useState([])
  const [addForm, setAddForm] = useState({ lease_id: '', amount: '', received_date: '', scheme: '', scheme_reference: '', notes: '' })
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
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

  const load = async () => {
    const [dr, cr] = await Promise.all([api.get('/deposits'), api.get('/deposits/compliance')])
    setDeposits(dr.data)
    setCompliance(cr.data)
  }

  useEffect(() => {
    load()
    api.get('/deposits/leases-for-deposit').then(r => setLeases(r.data)).catch(() => {})
  }, [])

  const filtered = deposits.filter(d => {
    if (filter === 'unprotected')   return d.status === 'unprotected'
    if (filter === 'pi_outstanding') return d.status === 'protected'
    if (filter === 'returned')      return d.status === 'returned' || d.status === 'disputed'
    return true
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    let av, bv
    if      (sortCol === 'unit')          { av = a.unit || '';           bv = b.unit || '' }
    else if (sortCol === 'amount')        { av = a.amount || 0;          bv = b.amount || 0; return sortDir === 'asc' ? av - bv : bv - av }
    else if (sortCol === 'received_date') { av = a.received_date || '';  bv = b.received_date || '' }
    else if (sortCol === 'scheme')        { av = a.scheme || '';         bv = b.scheme || '' }
    else if (sortCol === 'status')        { av = a.status || '';         bv = b.status || '' }
    else                                  { av = a.tenant_name || '';    bv = b.tenant_name || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    setSaving(true)
    try {
      await api.post('/deposits', { ...addForm, lease_id: parseInt(addForm.lease_id), amount: parseFloat(addForm.amount) })
      setShowAdd(false)
      setAddForm({ lease_id: '', amount: '', received_date: '', scheme: '', scheme_reference: '', notes: '' })
      load()
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="Deposits" subtitle="Deposit protection & compliance">
        <button onClick={() => setShowAdd(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Register Deposit
        </button>
      </PageHeader>

      {/* Compliance summary */}
      {compliance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button onClick={() => setFilter('all')} className={`rounded-xl border p-5 text-left transition-all ${filter === 'all' ? 'ring-2 ring-gray-400 bg-gray-50 border-gray-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <p className="text-sm text-gray-500">Total Held</p>
            <p className="text-2xl font-bold text-gray-900">£{compliance.total_held.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">{compliance.total_count} deposits</p>
          </button>
          <button onClick={() => setFilter('unprotected')} className={`rounded-xl border p-5 text-left transition-all ${filter === 'unprotected' ? 'ring-2 ring-red-400 bg-red-50 border-red-300' : compliance.protection_overdue > 0 ? 'bg-red-50 border-red-200 hover:ring-2 hover:ring-red-300' : compliance.unprotected > 0 ? 'bg-amber-50 border-amber-200 hover:ring-2 hover:ring-amber-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <p className="text-sm text-gray-500">Unprotected</p>
            <p className={`text-2xl font-bold ${compliance.protection_overdue > 0 ? 'text-red-600' : compliance.unprotected > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {compliance.unprotected}
            </p>
            <p className="text-xs text-gray-400 mt-1">{compliance.protection_overdue > 0 ? `${compliance.protection_overdue} overdue!` : '30-day deadline'}</p>
          </button>
          <button onClick={() => setFilter('pi_outstanding')} className={`rounded-xl border p-5 text-left transition-all ${filter === 'pi_outstanding' ? 'ring-2 ring-red-400 bg-red-50 border-red-300' : compliance.pi_overdue > 0 ? 'bg-red-50 border-red-200 hover:ring-2 hover:ring-red-300' : compliance.pi_outstanding > 0 ? 'bg-amber-50 border-amber-200 hover:ring-2 hover:ring-amber-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <p className="text-sm text-gray-500">PI Outstanding</p>
            <p className={`text-2xl font-bold ${compliance.pi_overdue > 0 ? 'text-red-600' : compliance.pi_outstanding > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {compliance.pi_outstanding}
            </p>
            <p className="text-xs text-gray-400 mt-1">{compliance.pi_overdue > 0 ? `${compliance.pi_overdue} overdue!` : '30-day deadline'}</p>
          </button>
          <button onClick={() => setFilter('returned')} className={`rounded-xl border p-5 text-left transition-all ${filter === 'returned' ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300' : compliance.returns_pending > 0 ? 'bg-blue-50 border-blue-200 hover:ring-2 hover:ring-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <p className="text-sm text-gray-500">Returns Pending</p>
            <p className={`text-2xl font-bold ${compliance.returns_pending > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
              {compliance.returns_pending}
            </p>
            <p className="text-xs text-gray-400 mt-1">tenancy ended</p>
          </button>
        </div>
      )}

      {/* Alerts */}
      {compliance && (compliance.protection_overdue > 0 || compliance.pi_overdue > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <p className="font-semibold text-red-700 text-sm mb-1">Legal compliance action required</p>
          <div className="text-sm text-red-600 space-y-0.5">
            {compliance.protection_overdue > 0 && (
              <p>• {compliance.protection_overdue} deposit{compliance.protection_overdue > 1 ? 's' : ''} not registered with a protection scheme within 30 days — tenants may claim up to 3× the deposit amount in compensation.</p>
            )}
            {compliance.pi_overdue > 0 && (
              <p>• {compliance.pi_overdue} deposit{compliance.pi_overdue > 1 ? 's' : ''} have Prescribed Information overdue — serve PI to the tenant immediately.</p>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        {[['all', 'All'], ['unprotected', 'Unprotected'], ['pi_outstanding', 'PI Outstanding'], ['returned', 'Returned']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === v ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No deposits found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortTh col="tenant_name" label="Tenant" />
                <SortTh col="unit" label="Property" />
                <SortTh col="amount" label="Amount" />
                <SortTh col="received_date" label="Received" />
                <SortTh col="scheme" label="Scheme" />
                <SortTh col="status" label="Status" />
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">Flag</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedFiltered.map(d => (
                <tr key={d.id} className={`hover:bg-gray-50 ${d.protection_overdue || d.pi_overdue ? 'bg-red-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-medium">
                    {d.tenant_id
                      ? <Link to={`/tenants/${d.tenant_id}`} className="text-indigo-600 hover:underline">{d.tenant_name}</Link>
                      : <span className="text-gray-900">{d.tenant_name}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {d.property_id
                      ? <Link to={`/properties/${d.property_id}`} className="text-indigo-600 hover:underline">{d.unit}</Link>
                      : <span className="text-gray-500">{d.unit}</span>}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-700">£{d.amount?.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-gray-500">{fmt(d.received_date)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{d.scheme || '—'}</td>
                  <td className="px-5 py-3.5"><Badge status={d.status} /></td>
                  <td className="px-5 py-3.5"><UrgencyFlag d={d} /></td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setSelected(d)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Register Deposit" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lease</label>
              <select value={addForm.lease_id} onChange={e => setAddForm({...addForm, lease_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select lease…</option>
                {leases.map(l => (
                  <option key={l.id} value={l.id} disabled={l.has_deposit}>
                    {l.tenant_name} — {l.unit_name} ({l.status}){l.has_deposit ? ' — already registered' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (£)</label>
                <input type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm({...addForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Received</label>
                <input type="date" value={addForm.received_date} onChange={e => setAddForm({...addForm, received_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheme</label>
                <select value={addForm.scheme} onChange={e => setAddForm({...addForm, scheme: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Not yet registered</option>
                  {SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheme Reference</label>
                <input value={addForm.scheme_reference} onChange={e => setAddForm({...addForm, scheme_reference: e.target.value})}
                  placeholder="e.g. TDS123456" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={addForm.notes} onChange={e => setAddForm({...addForm, notes: e.target.value})}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {addError && <p className="text-sm text-red-500">{addError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60">
                {saving ? 'Saving…' : 'Register'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage modal */}
      {selected && (
        <ManageModal deposit={selected} onClose={() => { setSelected(null); load() }} />
      )}
    </div>
  )
}


function ManageModal({ deposit, onClose }) {
  const [form, setForm] = useState({
    scheme: deposit.scheme || '',
    scheme_reference: deposit.scheme_reference || '',
    protected_date: deposit.protected_date || '',
    prescribed_info_date: deposit.prescribed_info_date || '',
    return_amount: deposit.return_amount || '',
    deductions: deposit.deductions || '',
    deduction_reason: deposit.deduction_reason || '',
    returned_date: deposit.returned_date || '',
    dispute_notes: deposit.dispute_notes || '',
    notes: deposit.notes || '',
    status: deposit.status,
    checkin_inspection_id: deposit.checkin_inspection_id || '',
    checkout_inspection_id: deposit.checkout_inspection_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inspections, setInspections] = useState([])

  useEffect(() => {
    if (deposit.unit_id) {
      api.get('/inspections', { params: { status: 'completed' } })
        .then(r => setInspections(r.data.filter(i => i.unit_id === deposit.unit_id)))
        .catch(() => {})
    }
  }, [deposit.unit_id])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {}
      for (const [k, v] of Object.entries(form)) {
        if (v !== '' && v !== null && v !== undefined) payload[k] = v
      }
      if (payload.return_amount) payload.return_amount = parseFloat(payload.return_amount)
      if (payload.deductions) payload.deductions = parseFloat(payload.deductions)
      if (payload.checkin_inspection_id) payload.checkin_inspection_id = parseInt(payload.checkin_inspection_id)
      if (payload.checkout_inspection_id) payload.checkout_inspection_id = parseInt(payload.checkout_inspection_id)
      await api.put(`/deposits/${deposit.id}`, payload)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this deposit record?')) return
    await api.delete(`/deposits/${deposit.id}`)
    onClose()
  }

  const stepIndex = STATUS_STEPS.indexOf(deposit.status)

  return (
    <Modal title={`Deposit — ${deposit.tenant_name}`} onClose={onClose} wide>
      {/* Progress pipeline */}
      <div className="flex items-center gap-0 mb-6">
        {STATUS_STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex flex-col items-center flex-1 ${i <= stepIndex ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < stepIndex ? 'bg-green-500 text-white' : i === stepIndex ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600">{statusLabel[s]}</span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 ${i < stepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Amount</p>
          <p className="font-bold text-gray-900">£{deposit.amount?.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Received</p>
          <p className="font-bold text-gray-900">{fmt(deposit.received_date)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Property</p>
          <p className="font-bold text-gray-900 truncate">{deposit.unit}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Protection */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Protection</legend>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheme</label>
              <select value={form.scheme} onChange={e => setForm({...form, scheme: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Not yet registered</option>
                {SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
              <input value={form.scheme_reference} onChange={e => setForm({...form, scheme_reference: e.target.value})}
                placeholder="e.g. TDS123456" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Protected</label>
              <input type="date" value={form.protected_date} onChange={e => setForm({...form, protected_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prescribed Info Served</label>
              <input type="date" value={form.prescribed_info_date} onChange={e => setForm({...form, prescribed_info_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </fieldset>

        {/* Return */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-xs font-semibold text-gray-500 uppercase px-1">End of Tenancy Return</legend>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Returned</label>
              <input type="date" value={form.returned_date} onChange={e => setForm({...form, returned_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Returned (£)</label>
              <input type="number" step="0.01" value={form.return_amount} onChange={e => setForm({...form, return_amount: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deductions (£)</label>
              <input type="number" step="0.01" value={form.deductions} onChange={e => setForm({...form, deductions: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Reason</label>
              <input value={form.deduction_reason} onChange={e => setForm({...form, deduction_reason: e.target.value})}
                placeholder="e.g. Carpet damage, cleaning" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dispute Notes</label>
            <textarea value={form.dispute_notes} onChange={e => setForm({...form, dispute_notes: e.target.value})}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </fieldset>

        {/* Linked Inspections */}
        {inspections.length > 0 && (
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Linked Inspections</legend>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-In Inspection</label>
                <select value={form.checkin_inspection_id} onChange={e => setForm({...form, checkin_inspection_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">None</option>
                  {inspections.filter(i => i.type === 'check_in').map(i => (
                    <option key={i.id} value={i.id}>
                      {i.completed_date || i.scheduled_date} — {i.overall_condition || 'no condition'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-Out Inspection</label>
                <select value={form.checkout_inspection_id} onChange={e => setForm({...form, checkout_inspection_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">None</option>
                  {inspections.filter(i => i.type === 'check_out').map(i => (
                    <option key={i.id} value={i.id}>
                      {i.completed_date || i.scheduled_date} — {i.overall_condition || 'no condition'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">Delete record</button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}


function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
