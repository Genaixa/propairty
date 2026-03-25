import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import tenantApi from '../../lib/tenantApi'

const tabs = ['My Lease', 'Payments', 'Maintenance']

const statusBadge = status => {
  const map = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-500',
    terminated: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
    open: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export default function TenantPortal() {
  const [tab, setTab] = useState('My Lease')
  const [me, setMe] = useState(null)
  const [lease, setLease] = useState(null)
  const [payments, setPayments] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [newJob, setNewJob] = useState({ title: '', description: '', priority: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [renewal, setRenewal] = useState(null)
  const [renewalResponse, setRenewalResponse] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    tenantApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    tenantApi.get('/portal/lease').then(r => setLease(r.data)).catch(() => {})
    tenantApi.get('/portal/payments').then(r => setPayments(r.data)).catch(() => {})
    tenantApi.get('/portal/maintenance').then(r => setMaintenance(r.data)).catch(() => {})
    tenantApi.get('/portal/renewal').then(r => setRenewal(r.data)).catch(() => {})
    tenantApi.get('/portal/notifications').then(r => setNotifications(r.data)).catch(() => {})
    // Check for payment result in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') setTab('Payments')
  }, [])

  async function handleOpenNotifications() {
    setShowNotifications(v => !v)
    const unread = notifications.filter(n => !n.read)
    if (unread.length > 0) {
      await tenantApi.post('/portal/notifications/read-all').catch(() => {})
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  async function handlePay(paymentId) {
    setPayingId(paymentId)
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
      const token = localStorage.getItem('tenant_token')
      const res = await fetch(`${BASE}/stripe/checkout/${paymentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        alert(data.detail || 'Payment unavailable — contact your letting agent.')
      }
    } catch {
      alert('Payment unavailable — contact your letting agent.')
    }
    setPayingId(null)
  }

  function logout() {
    localStorage.removeItem('tenant_token')
    navigate('/tenant/login')
  }

  async function handleSubmitMaintenance(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg('')
    try {
      await tenantApi.post('/portal/maintenance', newJob)
      setSubmitMsg('Your request has been submitted. Your letting agent will be in touch.')
      setNewJob({ title: '', description: '', priority: 'medium' })
      const r = await tenantApi.get('/portal/maintenance')
      setMaintenance(r.data)
    } catch (err) {
      setSubmitMsg(err.response?.data?.detail || 'Failed to submit request.')
    }
    setSubmitting(false)
  }

  const totalOwed = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + (p.amount_due - (p.amount_paid || 0)), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-violet-600">
            Prop<span className="text-gray-900">AI</span>rty
            <span className="text-sm font-normal text-gray-400 ml-2">Tenant Portal</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {me && <span className="text-sm text-gray-600">Hello, <span className="font-medium">{me.full_name}</span></span>}

          {/* Notification bell */}
          <div className="relative">
            <button onClick={handleOpenNotifications}
              className="relative p-2 text-gray-500 hover:text-violet-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {showNotifications && (
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-violet-50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                          n.type === 'urgent' ? 'bg-red-500' :
                          n.type === 'warning' ? 'bg-amber-400' :
                          n.type === 'success' ? 'bg-green-500' : 'bg-violet-400'
                        }`} />
                        <div>
                          <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 transition-colors">Sign out</button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Arrears banner */}
        {totalOwed > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-red-500 text-lg">!</span>
            <p className="text-sm text-red-700 font-medium">
              You have £{totalOwed.toFixed(2)} in overdue rent. Please contact your letting agent.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* My Lease tab */}
        {tab === 'My Lease' && (
          <div>
            {/* Renewal offer banner */}
            {renewal && !renewalResponse && (
              <div className="mb-5 bg-violet-50 border border-violet-300 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📋</span>
                  <h3 className="font-bold text-violet-800">Renewal Offer</h3>
                </div>
                <p className="text-sm text-violet-700 mb-3">
                  Your letting agent has offered to renew your tenancy.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500">Proposed Rent</p>
                    <p className="font-bold text-gray-900">£{renewal.proposed_rent}/mo</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500">New Start Date</p>
                    <p className="font-bold text-gray-900">{renewal.proposed_start}</p>
                  </div>
                  {renewal.proposed_end && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-500">New End Date</p>
                      <p className="font-bold text-gray-900">{renewal.proposed_end}</p>
                    </div>
                  )}
                </div>
                {renewal.agent_notes && (
                  <p className="text-xs text-violet-600 bg-white rounded-lg p-3 mb-4">{renewal.agent_notes}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: true })
                      setRenewalResponse('accepted')
                    }}
                    className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-violet-700"
                  >
                    Accept Renewal
                  </button>
                  <button
                    onClick={async () => {
                      await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: false })
                      setRenewalResponse('declined')
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            {renewalResponse === 'accepted' && (
              <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">Renewal accepted! Your new agreement will be sent to you by email shortly.</p>
              </div>
            )}
            {renewalResponse === 'declined' && (
              <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-600">You have declined the renewal offer. Please contact your letting agent to discuss next steps.</p>
              </div>
            )}

            {!lease ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No active lease found.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{lease.property_name}</h2>
                    <p className="text-sm text-gray-500">{lease.property_address}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(lease.status)}`}>
                    {lease.status}
                  </span>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.unit_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Rent</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">£{lease.monthly_rent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Lease Start</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.start_date || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Lease End</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {lease.end_date || (lease.is_periodic ? 'Periodic (rolling)' : '—')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Deposit</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.deposit ? `£${lease.deposit}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Rent Due</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.rent_day ? `${lease.rent_day}${ordinal(lease.rent_day)} of each month` : '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments tab */}
        {tab === 'Payments' && (
          <div className="space-y-4">
            {new URLSearchParams(window.location.search).get('payment') === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3">
                <p className="text-sm text-green-700 font-medium">Payment successful — thank you! Your record will update shortly.</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Due Date</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Paid</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td className="px-6 py-3 text-gray-700">{p.due_date}</td>
                      <td className="px-6 py-3 text-right text-gray-700">£{p.amount_due}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{p.amount_paid != null ? `£${p.amount_paid}` : '—'}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {p.status !== 'paid' ? (
                          <button onClick={() => handlePay(p.id)} disabled={payingId === p.id}
                            className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            {payingId === p.id ? '…' : 'Pay now'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No payment records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Maintenance tab */}
        {tab === 'Maintenance' && (
          <div className="space-y-6">
            {/* Submit new request */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Report an Issue</h2>
              </div>
              <form onSubmit={handleSubmitMaintenance} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. Boiler not working" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={3} placeholder="Please describe the issue in detail…" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={newJob.priority} onChange={e => setNewJob({...newJob, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="low">Low — non-urgent</option>
                    <option value="medium">Medium — needs attention</option>
                    <option value="high">High — urgent</option>
                    <option value="urgent">Urgent — emergency</option>
                  </select>
                </div>
                {submitMsg && <p className={`text-sm ${submitMsg.includes('submitted') ? 'text-green-600' : 'text-red-500'}`}>{submitMsg}</p>}
                <button type="submit" disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* Past requests */}
            {maintenance.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Your Requests</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {maintenance.map(j => (
                    <div key={j.id} className="px-6 py-4 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{j.title}</p>
                        {j.description && <p className="text-xs text-gray-500 mt-0.5">{j.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">{j.created_at?.slice(0, 10)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-4 ${statusBadge(j.status)}`}>
                        {j.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
