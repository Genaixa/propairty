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

  const markPaid = async (id, amount_due) => {
    setMarkingId(id)
    await api.post(`/payments/${id}/mark-paid`, {
      amount_paid: amount_due,
      paid_date: new Date().toISOString().slice(0, 10)
    })
    load(month)
    setMarkingId(null)
  }

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
                  <button onClick={() => markPaid(p.id, p.amount_due)}
                    disabled={markingId === p.id}
                    className="text-xs bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-200 disabled:opacity-50">
                    Mark Paid
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
                  <td className="px-5 py-3.5 text-green-600">{p.amount_paid ? `£${p.amount_paid}` : '—'}</td>
                  <td className="px-5 py-3.5"><Badge value={p.status} /></td>
                  <td className="px-5 py-3.5">
                    {(p.status === 'pending' || p.status === 'overdue') && (
                      <div className="flex gap-2">
                        <button onClick={() => sendReminder(p.id)}
                          disabled={remindingId === p.id || reminderSent[p.id]}
                          className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50">
                          {reminderSent[p.id] ? 'Sent ✓' : remindingId === p.id ? 'Sending…' : 'Remind'}
                        </button>
                        <button onClick={() => markPaid(p.id, p.amount_due)}
                          disabled={markingId === p.id}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50">
                          Mark Paid
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
