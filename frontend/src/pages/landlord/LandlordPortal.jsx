import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import landlordApi from '../../lib/landlordApi'

const TABS = ['Properties', 'Financials', 'Arrears', 'Compliance', 'Maintenance', 'Renewals', 'Inspections', 'Documents', 'Statements', 'Messages']

async function downloadBlob(url, filename) {
  const token = localStorage.getItem('landlord_token')
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const res = await fetch(`${BASE}/landlord/${url}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { alert('Failed to generate PDF'); return }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const badge = (status, extra = '') => {
  const map = {
    valid: 'bg-green-100 text-green-700',
    expiring_soon: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-600',
    overdue: 'bg-red-100 text-red-700',
    partial: 'bg-orange-100 text-orange-700',
    open: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    occupied: 'bg-blue-100 text-blue-700',
    vacant: 'bg-gray-100 text-gray-500',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  }
  const cls = map[status] || 'bg-gray-100 text-gray-600'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls} ${extra}`}>{status?.replace(/_/g, ' ')}</span>
}

export default function LandlordPortal() {
  const [tab, setTab] = useState('Properties')
  const [me, setMe] = useState(null)
  const [properties, setProperties] = useState([])
  const [financials, setFinancials] = useState(null)
  const [arrears, setArrears] = useState([])
  const [compliance, setCompliance] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [renewals, setRenewals] = useState([])
  const [inspections, setInspections] = useState([])
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [stmtYear, setStmtYear] = useState(new Date().getFullYear())
  const [stmtMonth, setStmtMonth] = useState(new Date().getMonth() + 1)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    landlordApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    landlordApi.get('/portal/properties').then(r => setProperties(r.data)).catch(() => {})
    landlordApi.get('/portal/financials').then(r => setFinancials(r.data)).catch(() => {})
    landlordApi.get('/portal/arrears').then(r => setArrears(r.data)).catch(() => {})
    landlordApi.get('/portal/compliance').then(r => setCompliance(r.data)).catch(() => {})
    landlordApi.get('/portal/maintenance').then(r => setMaintenance(r.data)).catch(() => {})
    landlordApi.get('/portal/renewals').then(r => setRenewals(r.data)).catch(() => {})
    landlordApi.get('/portal/inspections').then(r => setInspections(r.data)).catch(() => {})
    landlordApi.get('/portal/documents').then(r => setDocuments(r.data)).catch(() => {})
  }, [])

  // Load messages when Messages tab selected
  useEffect(() => {
    if (tab === 'Messages') {
      landlordApi.get('/portal/messages').then(r => {
        setMessages(r.data)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }).catch(() => {})
    }
  }, [tab])

  function logout() {
    localStorage.removeItem('landlord_token')
    navigate('/landlord/login')
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!msgInput.trim()) return
    setMsgSending(true)
    try {
      const r = await landlordApi.post('/portal/messages', { body: msgInput.trim() })
      setMessages(prev => [...prev, r.data])
      setMsgInput('')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      // silently ignore
    } finally {
      setMsgSending(false)
    }
  }

  const arrearsCount = arrears.length
  const unreadMsgs = messages.filter(m => m.sender_type === 'agent').length // rough badge

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-emerald-600">
            Prop<span className="text-gray-900">AI</span>rty
            <span className="text-sm font-normal text-gray-400 ml-2">Landlord Portal</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {me && <span className="text-sm text-gray-600">Hello, <span className="font-medium">{me.full_name}</span></span>}
          <button
            onClick={() => downloadBlob('portal/report', `PropAIrty-Report-${new Date().toISOString().slice(0, 7)}.pdf`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
            Download Report
          </button>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Arrears banner */}
        {arrearsCount > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-red-600 font-semibold text-sm">⚠ {arrearsCount} tenant{arrearsCount > 1 ? 's' : ''} in arrears</span>
            <button onClick={() => setTab('Arrears')} className="text-xs text-red-600 underline ml-auto">View breakdown</button>
          </div>
        )}

        {/* Summary cards */}
        {financials && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Rent</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">£{financials.total_rent.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Collected</p>
              <p className="text-2xl font-bold text-green-600 mt-1">£{financials.collected.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Arrears</p>
              <p className={`text-2xl font-bold mt-1 ${financials.arrears > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                £{financials.arrears.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t}
              {t === 'Arrears' && arrearsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {arrearsCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Properties */}
        {tab === 'Properties' && (
          <div className="space-y-4">
            {properties.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                No properties assigned yet. Contact your letting agent.
              </div>
            )}
            {properties.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-sm text-gray-500">{p.address}</p>
                  </div>
                  <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full capitalize">
                    {p.property_type}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {p.units.map(u => (
                    <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">
                          {u.tenant_name ? `Tenant: ${u.tenant_name}` : 'Vacant'}
                          {u.lease_end ? ` · Lease ends ${u.lease_end}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">£{u.rent_amount}/mo</span>
                        {badge(u.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Financials */}
        {tab === 'Financials' && financials && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Due Date</th>
                  <th className="px-6 py-3 text-right">Amount Due</th>
                  <th className="px-6 py-3 text-right">Paid</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {financials.payments.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 text-gray-700">{p.due_date}</td>
                    <td className="px-6 py-3 text-right text-gray-700">£{p.amount_due}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{p.amount_paid != null ? `£${p.amount_paid}` : '—'}</td>
                    <td className="px-6 py-3 text-center">{badge(p.status)}</td>
                  </tr>
                ))}
                {financials.payments.length === 0 && (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400">No payment records.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Arrears */}
        {tab === 'Arrears' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {arrears.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No tenants currently in arrears.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Tenant</th>
                    <th className="px-6 py-3 text-left">Property / Unit</th>
                    <th className="px-6 py-3 text-right">Amount Owed</th>
                    <th className="px-6 py-3 text-right">Payments Overdue</th>
                    <th className="px-6 py-3 text-center">Days Overdue</th>
                    <th className="px-6 py-3 text-left">Oldest Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {arrears.map((a, i) => {
                    const rowCls = a.days_overdue >= 7 ? 'bg-red-50' : a.days_overdue >= 1 ? 'bg-amber-50' : ''
                    const daysCls = a.days_overdue >= 7 ? 'text-red-700 font-bold' : a.days_overdue >= 1 ? 'text-amber-700 font-semibold' : 'text-gray-700'
                    return (
                      <tr key={i} className={rowCls}>
                        <td className="px-6 py-3 font-medium text-gray-900">{a.tenant_name}</td>
                        <td className="px-6 py-3 text-gray-600">{a.property} · {a.unit}</td>
                        <td className="px-6 py-3 text-right font-semibold text-red-700">£{a.total_owed.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{a.payments_overdue}</td>
                        <td className={`px-6 py-3 text-center ${daysCls}`}>{a.days_overdue}d</td>
                        <td className="px-6 py-3 text-gray-500">{a.oldest_due_date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Compliance */}
        {tab === 'Compliance' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Certificate</th>
                  <th className="px-6 py-3 text-left">Issued</th>
                  <th className="px-6 py-3 text-left">Expires</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {compliance.map(c => (
                  <tr key={c.id}>
                    <td className="px-6 py-3 font-medium text-gray-900">{c.label}</td>
                    <td className="px-6 py-3 text-gray-600">{c.issue_date || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{c.expiry_date || '—'}</td>
                    <td className="px-6 py-3 text-center">
                      {badge(c.status)}
                      {c.days_remaining != null && c.days_remaining >= 0 && (
                        <span className="text-xs text-gray-400 ml-1">({c.days_remaining}d)</span>
                      )}
                    </td>
                  </tr>
                ))}
                {compliance.length === 0 && (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-400">No certificates on record.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Maintenance */}
        {tab === 'Maintenance' && (
          <div className="space-y-3">
            {maintenance.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No maintenance jobs.</div>
            )}
            {maintenance.map(j => (
              <div key={j.id} className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{j.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{j.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{j.created_at?.slice(0, 10)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-4">
                  {badge(j.status)}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    j.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    j.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{j.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Renewals */}
        {tab === 'Renewals' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {renewals.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No leases expiring within 90 days.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Tenant</th>
                    <th className="px-6 py-3 text-left">Property / Unit</th>
                    <th className="px-6 py-3 text-left">End Date</th>
                    <th className="px-6 py-3 text-right">Days Left</th>
                    <th className="px-6 py-3 text-right">Monthly Rent</th>
                    <th className="px-6 py-3 text-center">Renewal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {renewals.map(r => {
                    const urgentCls = r.days_remaining <= 30 ? 'text-red-700 font-bold' : r.days_remaining <= 60 ? 'text-amber-700 font-semibold' : 'text-gray-700'
                    return (
                      <tr key={r.lease_id}>
                        <td className="px-6 py-3 font-medium text-gray-900">{r.tenant_name}</td>
                        <td className="px-6 py-3 text-gray-600">{r.property} · {r.unit}</td>
                        <td className="px-6 py-3 text-gray-600">{r.end_date}</td>
                        <td className={`px-6 py-3 text-right ${urgentCls}`}>{r.days_remaining}d</td>
                        <td className="px-6 py-3 text-right text-gray-700">£{r.monthly_rent?.toLocaleString()}</td>
                        <td className="px-6 py-3 text-center">{r.renewal_status ? badge(r.renewal_status) : <span className="text-xs text-gray-400">None sent</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Inspections */}
        {tab === 'Inspections' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {inspections.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No inspections on record.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Property / Unit</th>
                    <th className="px-6 py-3 text-left">Scheduled</th>
                    <th className="px-6 py-3 text-left">Inspector</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-left">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inspections.map(i => (
                    <tr key={i.id}>
                      <td className="px-6 py-3 font-medium text-gray-900">{i.type}</td>
                      <td className="px-6 py-3 text-gray-600">{i.property} · {i.unit}</td>
                      <td className="px-6 py-3 text-gray-600">{i.scheduled_date?.slice(0, 10) || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{i.inspector_name || '—'}</td>
                      <td className="px-6 py-3 text-center">{badge(i.status)}</td>
                      <td className="px-6 py-3 text-gray-600 capitalize">{i.overall_condition || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Documents */}
        {tab === 'Documents' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No documents on record.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">File</th>
                    <th className="px-6 py-3 text-left">Category</th>
                    <th className="px-6 py-3 text-left">Description</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map(d => (
                    <tr key={d.id}>
                      <td className="px-6 py-3">
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/uploads/${d.id}/download`}
                          className="text-emerald-600 hover:underline font-medium text-sm"
                          target="_blank" rel="noopener noreferrer">
                          {d.original_name}
                        </a>
                        {d.file_size && <span className="text-xs text-gray-400 ml-1">({Math.round(d.file_size / 1024)}kb)</span>}
                      </td>
                      <td className="px-6 py-3 text-gray-600 capitalize">{d.category || '—'}</td>
                      <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{d.description || '—'}</td>
                      <td className="px-6 py-3 text-gray-500 capitalize">{d.entity_type}</td>
                      <td className="px-6 py-3 text-gray-400">{d.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Statements */}
        {tab === 'Statements' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Download Monthly Rent Statement</h3>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <select value={stmtYear} onChange={e => setStmtYear(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - i
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Month</label>
                <select value={stmtMonth} onChange={e => setStmtMonth(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => downloadBlob(
                  `portal/statement/${stmtYear}/${stmtMonth}`,
                  `Statement-${stmtYear}-${String(stmtMonth).padStart(2, '0')}.pdf`
                )}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                Download PDF
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Shows all units across your properties for the selected month — expected rent, collected, and outstanding.
            </p>
          </div>
        )}

        {/* Messages */}
        {tab === 'Messages' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height: '520px' }}>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Messages with your letting agent</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-10">No messages yet. Send a message to your agent below.</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === 'landlord' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender_type === 'landlord'
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{m.body}</p>
                    <p className={`text-xs mt-1 ${m.sender_type === 'landlord' ? 'text-emerald-200' : 'text-gray-400'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={msgSending || !msgInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
