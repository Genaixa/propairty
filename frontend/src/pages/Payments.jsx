import { PageHeader } from '../components/Illustration'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import Badge from '../components/Badge'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function today() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

export default function Payments() {
  const [month, setMonth] = useState(today())
  const [payments, setPayments] = useState([])
  const [arrears, setArrears] = useState(null)
  const [markingId, setMarkingId] = useState(null)
  const [remindingId, setRemindingId] = useState(null)
  const [reminderSent, setReminderSent] = useState({})
  const [loading, setLoading] = useState(false)
  const [onlinePayments, setOnlinePayments] = useState([])
  const [showOnline, setShowOnline] = useState(false)

  // Record Payment modal
  const [recordModal, setRecordModal] = useState(null)
  const [recordForm, setRecordForm] = useState({ amount_paid: '', paid_date: '', method: 'Bank Transfer', notes: '' })
  const [recordSaving, setRecordSaving] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [coveredMonths, setCoveredMonths] = useState([]) // months auto-paid from surplus
  const [surplusConfirmed, setSurplusConfirmed] = useState(false)

  // Compute how much of a payment cannot be allocated to any remaining lease month
  function calcUnallocated(modal, form) {
    if (!modal || !form.amount_paid) return 0
    const entered = Number(form.amount_paid)
    if (entered <= modal.amount_due) return 0
    if (!modal.lease_end_date || !modal.monthly_rent) return 0
    const surplus = entered - modal.amount_due
    let allocatable = 0
    const dueDate = new Date(modal.due_date)
    const endDate = new Date(modal.lease_end_date)
    let d = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1)
    while (d <= endDate) { allocatable += modal.monthly_rent; d.setMonth(d.getMonth() + 1) }
    return Math.max(0, surplus - allocatable)
  }

  function openRecord(p) {
    setRecordModal(p)
    setRecordForm({
      amount_paid: p.amount_due,
      paid_date: new Date().toISOString().slice(0, 10),
      method: 'Bank Transfer',
      notes: ''
    })
    setRecordError('')
    setSurplusConfirmed(false)
  }

  async function submitRecord() {
    if (!recordForm.amount_paid || Number(recordForm.amount_paid) <= 0) {
      setRecordError('Please enter a valid amount.')
      return
    }
    if (!recordForm.paid_date) {
      setRecordError('Please enter the payment date.')
      return
    }
    setRecordSaving(true)
    setRecordError('')
    const notesStr = [recordForm.method, recordForm.notes].filter(Boolean).join(' — ')
    const res = await api.post(`/payments/${recordModal.id}/mark-paid`, {
      amount_paid: Number(recordForm.amount_paid),
      paid_date: recordForm.paid_date,
      notes: notesStr || null
    })
    setRecordModal(null)
    setRecordSaving(false)
    const extra = res.data?.covered_months || []
    setCoveredMonths(extra)
    if (extra.length) setTimeout(() => setCoveredMonths([]), 6000)
    load(month)
  }

  const load = async (m) => {
    setLoading(true)
    const [p, a] = await Promise.all([
      api.get(`/payments?month=${m}`),
      api.get('/payments/arrears')
    ])
    setPayments(p.data)
    setArrears(a.data)
    setLoading(false)
  }

  useEffect(() => { load(month) }, [month])

  useEffect(() => {
    api.get('/stripe/payments').then(r => setOnlinePayments(r.data)).catch(() => {})
  }, [])

  const markPaid = (p) => openRecord(p)

  const sendReminder = async (id) => {
    setRemindingId(id)
    try {
      await api.post(`/payments/${id}/send-reminder`)
      setReminderSent(prev => ({ ...prev, [id]: true }))
    } catch {
      // silently reset so button is usable again
    } finally {
      setRemindingId(null)
    }
  }

  const paid = payments.filter(p => p.status === 'paid')
  const pending = payments.filter(p => p.status === 'pending')
  const overdue = payments.filter(p => p.status === 'overdue' || p.status === 'partial')
  const collected = paid.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const expected = payments.reduce((s, p) => s + p.amount_due, 0)

  const [sortCol, setSortCol] = useState('due_date')
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

  const sortedPayments = [...payments].sort((a, b) => {
    let av, bv
    if      (sortCol === 'tenant_name') { av = a.tenant_name || ''; bv = b.tenant_name || '' }
    else if (sortCol === 'unit')        { av = a.unit || '';         bv = b.unit || '' }
    else if (sortCol === 'amount_due')  { av = a.amount_due;         bv = b.amount_due; return sortDir === 'asc' ? av - bv : bv - av }
    else if (sortCol === 'amount_paid') { av = a.amount_paid || 0;   bv = b.amount_paid || 0; return sortDir === 'asc' ? av - bv : bv - av }
    else if (sortCol === 'status')      { av = a.status || '';        bv = b.status || '' }
    else                                { av = a.due_date || '';      bv = b.due_date || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      <PageHeader title="Rent Payments" subtitle="Track, record & chase rent across your portfolio">
        <div className="flex items-center gap-1">
          <button onClick={() => {
            const [y, m] = month.split('-').map(Number)
            const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
            setMonth(prev)
          }} className="text-gray-400 hover:text-gray-600 text-xl px-2">‹</button>
          <span className="font-medium text-gray-700 w-40 text-center text-sm">{monthLabel(month)}</span>
          <button onClick={() => {
            const [y, m] = month.split('-').map(Number)
            const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
            setMonth(next)
          }} className="text-gray-400 hover:text-gray-600 text-xl px-2">›</button>
        </div>
      </PageHeader>

      {/* Advance payment toast */}
      {coveredMonths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-sm text-green-800">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span>Payment recorded — surplus automatically applied to {coveredMonths.join(', ')}.</span>
          <button onClick={() => setCoveredMonths([])} className="ml-auto text-green-600 hover:text-green-800 cursor-pointer">✕</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Expected</p>
          <p className="text-2xl font-bold text-gray-900">£{expected.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{payments.length} payments</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">£{collected.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{paid.length} paid</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-500">{pending.length}</p>
          <p className="text-xs text-gray-400 mt-1">awaiting payment</p>
        </div>
        <div className={`rounded-xl border p-5 ${arrears?.count > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Arrears</p>
          <p className={`text-2xl font-bold ${arrears?.count > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            £{arrears?.total_owed?.toLocaleString() ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">{arrears?.count ?? 0} overdue</p>
        </div>
      </div>

      {/* Arrears alert */}
      {arrears?.count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-red-700 mb-3">⚠ Arrears — {arrears.count} payment{arrears.count > 1 ? 's' : ''} overdue</h3>
          <div className="space-y-2">
            {arrears.payments.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-white rounded-lg px-4 py-2.5 border border-red-100">
                <div>
                  {p.tenant_id
                    ? <Link to={`/tenants/${p.tenant_id}`} className="font-medium text-indigo-600 hover:underline text-sm">{p.tenant_name}</Link>
                    : <span className="font-medium text-gray-900 text-sm">{p.tenant_name}</span>}
                  {p.property_id
                    ? <Link to={`/properties/${p.property_id}`} className="text-gray-400 text-xs ml-2 hover:text-indigo-600 hover:underline">{p.unit}</Link>
                    : <span className="text-gray-400 text-xs ml-2">{p.unit}</span>}

                  {p.tenant_phone && <span className="text-gray-400 text-xs ml-2">· {p.tenant_phone}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-500">Due {fmt(p.due_date)}</span>
                  <span className="font-semibold text-red-600 text-sm">£{p.amount_due}</span>
                  <button onClick={() => sendReminder(p.id)}
                    disabled={remindingId === p.id || reminderSent[p.id]}
                    className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                    {reminderSent[p.id] ? 'Sent ✓' : remindingId === p.id ? 'Sending…' : 'Send Reminder'}
                  </button>
                  <button onClick={() => openRecord(p)}
                    className="text-xs bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-200">
                    Record Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Online payments panel */}
      {onlinePayments.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden mb-6">
          <button
            onClick={() => setShowOnline(v => !v)}
            className="w-full px-5 py-4 flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">💳</span>
              <span className="font-semibold text-indigo-800 text-sm">
                Online Payments via Stripe — {onlinePayments.length} total
              </span>
            </div>
            <span className="text-indigo-400 text-sm">{showOnline ? '▲ hide' : '▼ show'}</span>
          </button>
          {showOnline && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tenant', 'Unit', 'Period', 'Amount', 'Paid Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {onlinePayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.tenant_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {p.property_id
                        ? <Link to={`/properties/${p.property_id}`} className="text-indigo-600 hover:underline">{p.unit}</Link>
                        : p.unit}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{p.due_date ? new Date(p.due_date).toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : '—'}</td>
                    <td className="px-5 py-3 font-semibold text-green-600">£{p.amount_paid?.toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmt(p.paid_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Record Payment modal */}
      {recordModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Record Payment</h2>
              <p className="text-sm text-gray-500 mt-0.5">{recordModal.tenant_name} · Due £{recordModal.amount_due?.toLocaleString()}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount Received (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={recordForm.amount_paid}
                  onChange={e => { setRecordForm(f => ({ ...f, amount_paid: e.target.value })); setSurplusConfirmed(false) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="0.00"
                />
                {recordForm.amount_paid && Number(recordForm.amount_paid) > 0 && Number(recordForm.amount_paid) < recordModal.amount_due && (
                  <p className="text-xs text-amber-600 mt-1">Partial payment — balance of £{(recordModal.amount_due - Number(recordForm.amount_paid)).toFixed(2)} will remain outstanding.</p>
                )}
                {(() => {
                  const entered = Number(recordForm.amount_paid)
                  if (!recordForm.amount_paid || entered <= 0) return null
                  const unallocated = calcUnallocated(recordModal, recordForm)
                  if (unallocated > 0) {
                    const max = (entered - unallocated).toFixed(2)
                    const endFmt = new Date(recordModal.lease_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    return <p className="text-xs text-red-600 mt-1 font-medium">Amount exceeds total remaining rent on this lease (ends {endFmt}). Maximum you can record: £{max}.</p>
                  }
                  if (entered > recordModal.amount_due)
                    return <p className="text-xs text-blue-600 mt-1">Surplus of £{(entered - recordModal.amount_due).toFixed(2)} will automatically be applied to future months.</p>
                  return null
                })()}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={recordForm.paid_date}
                  onChange={e => setRecordForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select
                  value={recordForm.method}
                  onChange={e => setRecordForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  {['Bank Transfer', 'Standing Order', 'Cash', 'Cheque', 'Card', 'Other'].map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference / Notes <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={recordForm.notes}
                  onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="e.g. ref: 20240501"
                />
              </div>
              {recordError && <p className="text-xs text-red-600">{recordError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setRecordModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={submitRecord}
                disabled={recordSaving || calcUnallocated(recordModal, recordForm) > 0}
                className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {recordSaving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* This month's payments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">{monthLabel(month)} — All Payments</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No payments for this month yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortTh col="tenant_name" label="Tenant" />
                <SortTh col="unit" label="Unit" />
                <SortTh col="due_date" label="Due Date" />
                <SortTh col="amount_due" label="Amount Due" />
                <SortTh col="amount_paid" label="Paid" />
                <SortTh col="status" label="Status" />
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPayments.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.status === 'overdue' ? 'bg-red-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-medium">
                    {p.tenant_id
                      ? <Link to={`/tenants/${p.tenant_id}`} className="text-indigo-600 hover:underline">{p.tenant_name}</Link>
                      : <span className="text-gray-900">{p.tenant_name}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {p.property_id
                      ? <Link to={`/properties/${p.property_id}`} className="text-indigo-600 hover:underline">{p.unit}</Link>
                      : <span className="text-gray-500">{p.unit}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{fmt(p.due_date)}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-700">£{p.amount_due}</td>
                  <td className="px-5 py-3.5">
                    {p.amount_paid
                      ? <><span className="font-medium text-green-600">£{p.amount_paid.toLocaleString()}</span>
                          {p.paid_date && <div className="text-xs text-gray-400 mt-0.5">{fmt(p.paid_date)}</div>}</>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5"><Badge value={p.status} /></td>
                  <td className="px-5 py-3.5">
                    {(p.status === 'pending' || p.status === 'overdue' || p.status === 'partial') && (
                      <div className="flex gap-2">
                        <button onClick={() => sendReminder(p.id)}
                          disabled={remindingId === p.id || reminderSent[p.id]}
                          className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                          {reminderSent[p.id] ? 'Sent ✓' : remindingId === p.id ? 'Sending…' : 'Remind'}
                        </button>
                        <button onClick={() => openRecord(p)}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
                          Record Payment
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
