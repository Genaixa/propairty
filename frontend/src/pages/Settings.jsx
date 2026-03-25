import { useState, useEffect } from 'react'
import api from '../lib/api'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

function landlordApi(method, path, data) {
  const token = localStorage.getItem('token')
  return axios({ method, url: `${BASE}/landlord${path}`, data, headers: { Authorization: `Bearer ${token}` } })
}

export default function Settings() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'agent' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [org, setOrg] = useState(null)

  const [landlords, setLandlords] = useState([])
  const [llForm, setLlForm] = useState({ full_name: '', email: '', password: '', phone: '' })
  const [llError, setLlError] = useState('')
  const [llSuccess, setLlSuccess] = useState('')
  const [llLoading, setLlLoading] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testEmailMsg, setTestEmailMsg] = useState('')
  const [stripeStatus, setStripeStatus] = useState(null)

  useEffect(() => {
    load()
    api.get('/stripe/status').then(r => setStripeStatus(r.data)).catch(() => {})
  }, [])

  async function load() {
    try {
      const [usersRes, meRes, llRes] = await Promise.all([
        api.get('/onboarding/org-users'),
        api.get('/auth/me'),
        landlordApi('get', '/landlords'),
      ])
      setUsers(usersRes.data)
      setOrg(meRes.data)
      setLandlords(llRes.data)
    } catch {}
  }

  async function handleTestEmail(e) {
    e.preventDefault()
    setTestEmailMsg('')
    try {
      const r = await api.post('/onboarding/test-email', { to_email: testEmail })
      setTestEmailMsg(r.data.message)
    } catch (err) {
      setTestEmailMsg(err.response?.data?.detail || 'Failed to send test email')
    }
  }

  async function handleAddLandlord(e) {
    e.preventDefault()
    if (llForm.password.length < 8) { setLlError('Password must be at least 8 characters'); return }
    setLlLoading(true)
    setLlError('')
    setLlSuccess('')
    try {
      await landlordApi('post', '/landlords', llForm)
      setLlSuccess(`${llForm.full_name} has been added as a landlord.`)
      setLlForm({ full_name: '', email: '', password: '', phone: '' })
      load()
    } catch (e) {
      setLlError(e.response?.data?.detail || 'Failed to add landlord')
    }
    setLlLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/onboarding/invite', form)
      setSuccess(`${form.full_name} has been added.`)
      setForm({ full_name: '', email: '', password: '', role: 'agent' })
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to invite user')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        {org && (
          <p className="text-sm text-gray-500 mt-1">
            Organisation: <span className="font-medium text-gray-700">{org.organisation_name || 'Your Organisation'}</span>
          </p>
        )}
      </div>

      {/* Team members */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {u.role}
              </span>
            </div>
          ))}
          {users.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400">No users found.</p>
          )}
        </div>
      </div>

      {/* Stripe payments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Online Rent Payments (Stripe)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Tenants pay rent directly through their portal. Receipts emailed automatically.
            </p>
          </div>
          {stripeStatus && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              stripeStatus.configured
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {stripeStatus.configured ? 'Active' : 'Not configured'}
            </span>
          )}
        </div>
        <div className="px-6 py-4 space-y-4">
          {stripeStatus?.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <span className="text-green-500">✓</span> Stripe keys configured
              </div>
              <div className={`flex items-center gap-2 text-sm ${stripeStatus.webhook_configured ? 'text-green-700' : 'text-amber-600'}`}>
                <span>{stripeStatus.webhook_configured ? '✓' : '!'}</span>
                {stripeStatus.webhook_configured ? 'Webhook secret configured' : 'Webhook secret not set — payments will not auto-confirm'}
              </div>
              <p className="text-xs text-gray-500 pt-1">
                Tenants see a <strong>Pay now</strong> button in their portal for all unpaid rent. Payments are confirmed automatically via webhook and a receipt is emailed to the tenant.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">1.</span> Create an account at <span className="font-mono text-xs">stripe.com</span> and get your API keys</p>
              <p><span className="font-medium">2.</span> Add to <span className="font-mono text-xs">/root/propairty/backend/.env.production</span>:</p>
              <pre className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-mono mt-1 text-gray-700">
{`STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...`}
              </pre>
              <p><span className="font-medium">3.</span> In Stripe dashboard, add a webhook endpoint: <span className="font-mono text-xs">https://propairty.co.uk/api/stripe/webhook</span> — event: <span className="font-mono text-xs">checkout.session.completed</span></p>
              <p><span className="font-medium">4.</span> Restart backend: <span className="font-mono text-xs">systemctl restart propairty</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Email notifications */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Email Notifications</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tenants with an email address and portal access receive automatic rent reminders.</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { days: '3 days before', label: 'Upcoming reminder' },
              { days: '1 day before', label: 'Final reminder' },
              { days: 'Due today', label: 'Due date reminder' },
              { days: '1 day late', label: 'Missed payment' },
              { days: '3 days late', label: 'Overdue notice' },
              { days: '7 days late', label: 'Final overdue notice' },
            ].map((r, i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="font-medium text-gray-900 text-xs">{r.days}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleTestEmail} className="flex gap-3 pt-2">
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
              placeholder="Send a test email to..." required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Send test
            </button>
          </form>
          {testEmailMsg && <p className={`text-sm ${testEmailMsg.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>{testEmailMsg}</p>}
        </div>
      </div>

      {/* Landlords */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Landlords</h2>
            <p className="text-xs text-gray-400 mt-0.5">Landlords can log in at <span className="font-mono">/landlord/login</span> to view their properties.</p>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {landlords.map(l => (
            <div key={l.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{l.full_name}</p>
                <p className="text-xs text-gray-500">{l.email}{l.phone ? ` · ${l.phone}` : ''}</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">landlord</span>
            </div>
          ))}
          {landlords.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400">No landlords added yet.</p>
          )}
        </div>
        <form onSubmit={handleAddLandlord} className="px-6 py-5 border-t border-gray-100 space-y-4">
          <p className="text-sm font-medium text-gray-700">Add a Landlord</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input value={llForm.full_name} onChange={e => setLlForm({...llForm, full_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="John Smith" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={llForm.email} onChange={e => setLlForm({...llForm, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="landlord@email.co.uk" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input type="password" value={llForm.password} onChange={e => setLlForm({...llForm, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="At least 8 characters" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
              <input value={llForm.phone} onChange={e => setLlForm({...llForm, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+44 7700 900000" />
            </div>
          </div>
          {llError && <p className="text-sm text-red-500">{llError}</p>}
          {llSuccess && <p className="text-sm text-green-600">{llSuccess}</p>}
          <button type="submit" disabled={llLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
            {llLoading ? 'Adding…' : 'Add Landlord'}
          </button>
        </form>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Invite a Team Member</h2>
          <p className="text-xs text-gray-400 mt-0.5">They can log in immediately with the password you set.</p>
        </div>
        <form onSubmit={handleInvite} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Jane Smith" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="jane@agency.co.uk" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="At least 8 characters" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button type="submit" disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
            {loading ? 'Inviting…' : 'Send Invite'}
          </button>
        </form>
      </div>
    </div>
  )
}
