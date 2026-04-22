import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { LANGUAGES } from '../i18n'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const billingResult = searchParams.get('billing') // 'success' | 'cancelled'

  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'agent' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [org, setOrg] = useState(null)
  const [assistantGender, setAssistantGender] = useState(() => localStorage.getItem('assistant_gender') || 'male')

  const [testEmail, setTestEmail] = useState('')
  const [testEmailMsg, setTestEmailMsg] = useState('')
  const [stripeStatus, setStripeStatus] = useState(null)
  const [billing, setBilling] = useState(null)
  const [billingLoading, setBillingLoading] = useState(false)

  const [reminderChannels, setReminderChannels] = useState(['email', 'portal'])
  const [reminderDays, setReminderDays] = useState([3, 1, 0, -1, -3, -7])
  const [reminderSaving, setReminderSaving] = useState(false)
  const [reminderMsg, setReminderMsg] = useState('')
  const [contractors, setContractors] = useState([])
  const [editUser, setEditUser] = useState(null) // user object being edited
  const [editForm, setEditForm] = useState({})
  const [editMsg, setEditMsg] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [inviteByEmail, setInviteByEmail] = useState(false)

  const [manageUser, setManageUser] = useState(null)
  const [manageForm, setManageForm] = useState({})
  const [manageMsg, setManageMsg] = useState('')
  const [manageSaving, setManageSaving] = useState(false)
  const [allProperties, setAllProperties] = useState([])

  const ROLE_COLOURS = {
    admin: 'bg-indigo-100 text-indigo-700',
    manager: 'bg-blue-100 text-blue-700',
    negotiator: 'bg-green-100 text-green-700',
    accounts: 'bg-amber-100 text-amber-700',
    read_only: 'bg-gray-100 text-gray-500',
  }
  const ROLE_LABELS = {
    admin: 'Admin', manager: 'Manager', negotiator: 'Negotiator',
    accounts: 'Accounts', read_only: 'Read Only',
    agent: 'Agent', // legacy
  }

  const [activeTab, setActiveTab] = useState('team')

  const [branding, setBranding] = useState({ logo_url: '', brand_color: '#4f46e5', tagline: '', address_text: '', website_url: '' })
  const [brandingSlug, setBrandingSlug] = useState('')
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingMsg, setBrandingMsg] = useState('')

  const [apiKeyStatus, setApiKeyStatus] = useState(null)
  const [apiKeyDraft, setApiKeyDraft] = useState({})
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState('')
  const [testSmsNumber, setTestSmsNumber] = useState('')
  const [testSmsMsg, setTestSmsMsg] = useState('')

  const [features, setFeatures] = useState(null)
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresMsg, setFeaturesMsg] = useState('')

  const [blogPosts, setBlogPosts] = useState([])
  const [blogForm, setBlogForm] = useState({ title: '', excerpt: '', body: '', cover_url: '', category: 'post', published: true })
  const [blogEditing, setBlogEditing] = useState(null)
  const [blogMsg, setBlogMsg] = useState('')
  const [blogSaving, setBlogSaving] = useState(false)

  const [customDomain, setCustomDomain] = useState('')
  const [customDomainSaving, setCustomDomainSaving] = useState(false)
  const [customDomainMsg, setCustomDomainMsg] = useState('')

  useEffect(() => {
    load()
    api.get('/stripe/status').then(r => setStripeStatus(r.data)).catch(() => {})
    api.get('/billing/status').then(r => setBilling(r.data)).catch(() => {})
    api.get('/onboarding/reminder-settings').then(r => {
      setReminderChannels(r.data.channels)
      setReminderDays(r.data.days)
    }).catch(() => {})
    api.get('/contractors').then(r => setContractors(r.data)).catch(() => {})
    api.get('/api/system/api-keys').then(r => setApiKeyStatus(r.data)).catch(() => {})
    api.get('/settings/features').then(r => setFeatures(r.data)).catch(() => {})
    api.get('/public/agent/blog-posts').then(r => setBlogPosts(r.data)).catch(() => {})
    api.get('/settings/custom-domain').then(r => setCustomDomain(r.data.custom_domain || '')).catch(() => {})
    api.get('/onboarding/branding').then(r => {
      setBranding({
        logo_url: r.data.logo_url || '',
        brand_color: r.data.brand_color || '#4f46e5',
        tagline: r.data.tagline || '',
        address_text: r.data.address_text || '',
        website_url: r.data.website_url || '',
      })
      setBrandingSlug(r.data.slug || '')
    }).catch(() => {})
  }, [])

  async function load() {
    try {
      const [usersRes, meRes] = await Promise.all([
        api.get('/onboarding/org-users'),
        api.get('/auth/me'),
      ])
      setUsers(usersRes.data)
      setOrg(meRes.data)
    } catch {}
  }

  async function handleSubscribe() {
    setBillingLoading(true)
    try {
      const r = await api.post('/billing/checkout')
      window.location.href = r.data.checkout_url
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to start checkout')
    }
    setBillingLoading(false)
  }

  async function handleManageBilling() {
    setBillingLoading(true)
    try {
      const r = await api.post('/billing/portal')
      window.location.href = r.data.portal_url
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to open billing portal')
    }
    setBillingLoading(false)
  }

  async function saveReminderSettings() {
    setReminderSaving(true)
    setReminderMsg('')
    try {
      await api.put('/onboarding/reminder-settings', { channels: reminderChannels, days: reminderDays })
      setReminderMsg('Saved.')
    } catch {
      setReminderMsg('Failed to save.')
    }
    setReminderSaving(false)
  }

  function toggleChannel(ch) {
    setReminderChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  function toggleDay(d) {
    setReminderDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
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

  async function handleTestSms(e) {
    e.preventDefault()
    setTestSmsMsg('')
    try {
      const r = await api.post('/api/system/test-sms', { to: testSmsNumber })
      setTestSmsMsg(r.data.message)
    } catch (err) {
      setTestSmsMsg(err.response?.data?.detail || 'Failed to send test SMS')
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteByEmail && form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (inviteByEmail) {
        await api.post('/onboarding/send-invite', { full_name: form.full_name, email: form.email, role: form.role })
        setSuccess(`Invite email sent to ${form.email}.`)
      } else {
        await api.post('/onboarding/invite', form)
        setSuccess(`${form.full_name} has been added.`)
      }
      setForm({ full_name: '', email: '', password: '', role: 'agent' })
      setShowAddMember(false)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to invite user')
    }
    setLoading(false)
  }

  function startEditUser(u) {
    setEditUser(u)
    setEditForm({ full_name: u.full_name, email: u.email, role: u.role, password: '' })
    setEditMsg('')
  }

  async function handleUpdateUser(e) {
    e.preventDefault()
    setEditMsg('')
    const payload = { full_name: editForm.full_name, email: editForm.email, role: editForm.role }
    if (editForm.password) payload.password = editForm.password
    try {
      await api.put(`/onboarding/org-users/${editUser.id}`, payload)
      setEditUser(null)
      load()
    } catch (e) {
      setEditMsg(e.response?.data?.detail || 'Failed to save')
    }
  }

  async function openManage(u) {
    setManageUser(u)
    setManageForm({ role: u.role, restrict_to_assigned: u.restrict_to_assigned || false, property_ids: u.assigned_property_ids || [] })
    setManageMsg('')
    if (!allProperties.length) {
      try {
        const r = await api.get('/properties')
        setAllProperties(r.data)
      } catch {}
    }
  }

  function toggleManageProp(pid) {
    setManageForm(f => ({
      ...f,
      property_ids: f.property_ids.includes(pid) ? f.property_ids.filter(x => x !== pid) : [...f.property_ids, pid]
    }))
  }

  async function saveManage() {
    setManageSaving(true)
    setManageMsg('')
    try {
      await api.put(`/onboarding/org-users/${manageUser.id}`, { role: manageForm.role, restrict_to_assigned: manageForm.restrict_to_assigned })
      await api.put(`/onboarding/org-users/${manageUser.id}/property-assignments`, { property_ids: manageForm.property_ids })
      setManageUser(null)
      load()
    } catch (e) {
      setManageMsg(e.response?.data?.detail || 'Failed to save')
    }
    setManageSaving(false)
  }

  async function handleRemoveUser(id, name) {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) return
    try {
      await api.delete(`/onboarding/org-users/${id}`)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to remove user')
    }
  }

  async function saveApiKeys(group) {
    const groupKeys = apiKeyStatus?.[group]?.map(k => k.field) || []
    const updates = {}
    groupKeys.forEach(f => { if (apiKeyDraft[f]) updates[f] = apiKeyDraft[f] })
    if (!Object.keys(updates).length) return
    setApiKeySaving(group)
    setApiKeyMsg('')
    try {
      const r = await api.post('/api/system/api-keys', { updates })
      setApiKeyMsg(r.data.message)
      // Refresh status, clear draft values for saved keys
      const fresh = await api.get('/api/system/api-keys')
      setApiKeyStatus(fresh.data)
      setApiKeyDraft(prev => {
        const next = { ...prev }
        groupKeys.forEach(f => { if (updates[f]) delete next[f] })
        return next
      })
    } catch (e) {
      setApiKeyMsg(e.response?.data?.detail || 'Failed to save')
    }
    setApiKeySaving(false)
  }

  function toggleFeature(key) {
    setFeatures(prev => {
      const groups = { ...prev.groups }
      for (const g of Object.keys(groups)) {
        groups[g] = groups[g].map(f => f.key === key ? { ...f, enabled: !f.enabled } : f)
      }
      return { groups }
    })
  }

  async function saveFeatures() {
    if (!features) return
    setFeaturesSaving(true)
    setFeaturesMsg('')
    const flags = {}
    for (const items of Object.values(features.groups)) {
      for (const f of items) flags[f.key] = f.enabled
    }
    try {
      const r = await api.post('/settings/features', { flags })
      setFeaturesMsg(r.data.message || 'Saved.')
    } catch {
      setFeaturesMsg('Failed to save.')
    } finally {
      setFeaturesSaving(false)
    }
  }

  async function saveBlogPost(e) {
    e.preventDefault()
    setBlogSaving(true); setBlogMsg('')
    try {
      if (blogEditing) {
        await api.put(`/public/agent/blog-posts/${blogEditing}`, blogForm)
        setBlogMsg('Updated.')
      } else {
        await api.post('/public/agent/blog-posts', blogForm)
        setBlogMsg('Published.')
      }
      const r = await api.get('/public/agent/blog-posts')
      setBlogPosts(r.data)
      setBlogEditing(null)
      setBlogForm({ title: '', excerpt: '', body: '', cover_url: '', category: 'post', published: true })
    } catch { setBlogMsg('Failed to save.') }
    setBlogSaving(false)
  }

  async function deleteBlogPost(id) {
    if (!confirm('Delete this post?')) return
    await api.delete(`/public/agent/blog-posts/${id}`)
    setBlogPosts(p => p.filter(x => x.id !== id))
  }

  function editBlogPost(post) {
    setBlogEditing(post.id)
    setBlogForm({ title: post.title, excerpt: post.excerpt || '', body: '', cover_url: post.cover_url || '', category: post.category || 'post', published: post.published })
    setActiveTab('blog')
    window.scrollTo(0, 0)
  }

  async function saveBranding(e) {
    e.preventDefault()
    setBrandingSaving(true)
    setBrandingMsg('')
    try {
      await api.put('/onboarding/branding', branding)
      setBrandingMsg('Saved.')
    } catch {
      setBrandingMsg('Failed to save.')
    }
    setBrandingSaving(false)
  }

  const tabs = [
    { id: 'team',         label: 'Team' },
    { id: 'billing',      label: 'Billing' },
    { id: 'contractors',  label: 'Contractors' },
    { id: 'reminders',    label: 'Reminders' },
    { id: 'branding',     label: 'Branding' },
    ...(org?.role === 'admin' ? [{ id: 'integrations', label: 'Integrations' }] : []),
    { id: 'features',     label: 'Features' },
    { id: 'blog',         label: 'Blog & Content' },
    { id: 'preferences',  label: 'Preferences' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle={org ? `${org.organisation_name || 'Your Organisation'}` : 'Manage your account, team & preferences'} />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Billing success / cancelled banner */}
      {billingResult === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-green-500 text-xl">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Subscription activated!</p>
            <p className="text-xs text-green-700 mt-0.5">Your account is now active. Thank you for subscribing to PropAIrty.</p>
          </div>
        </div>
      )}
      {billingResult === 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm text-amber-800">Checkout was cancelled — your subscription has not changed.</p>
        </div>
      )}

      {/* ── TEAM ── */}
      {activeTab === 'team' && <div className="space-y-6">

      {/* Team members */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
          <button onClick={() => { setShowAddMember(v => !v); setError(''); setSuccess('') }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            {showAddMember ? 'Cancel' : '+ Add member'}
          </button>
        </div>

        {/* Add member inline form */}
        {showAddMember && (
          <form onSubmit={handleInvite} className="px-6 py-4 border-b border-indigo-100 bg-indigo-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">New team member</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={inviteByEmail} onChange={e => setInviteByEmail(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
                <span className="text-xs text-indigo-700 font-medium">Send invite email</span>
              </label>
            </div>
            {inviteByEmail && (
              <p className="text-xs text-indigo-600 bg-indigo-100 rounded-lg px-3 py-2">
                An invite link will be emailed to the address below. They can set their own password when they click it.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Jane Smith" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="jane@agency.co.uk" required />
              </div>
              {!inviteByEmail && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Min 8 characters" required={!inviteByEmail} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="negotiator">Negotiator</option>
                  <option value="accounts">Accounts</option>
                  <option value="read_only">Read Only</option>
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <button type="submit" disabled={loading}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? (inviteByEmail ? 'Sending…' : 'Adding…') : (inviteByEmail ? 'Send Invite Email' : 'Add member')}
            </button>
          </form>
        )}

        {/* User list */}
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id}>
              {editUser?.id === u.id ? (
                /* Edit row */
                <form onSubmit={handleUpdateUser} className="px-6 py-4 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                      <input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep)</span></label>
                      <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Leave blank to keep current" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                      <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="negotiator">Negotiator</option>
                        <option value="accounts">Accounts</option>
                        <option value="read_only">Read Only</option>
                      </select>
                    </div>
                  </div>
                  {editMsg && <p className="text-sm text-red-500">{editMsg}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" onClick={() => setEditUser(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">Cancel</button>
                  </div>
                </form>
              ) : (
                /* Display row */
                <div className="px-6 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                      {u.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLOURS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {u.restrict_to_assigned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Restricted</span>
                    )}
                    <button onClick={() => startEditUser(u)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => openManage(u)} className="text-xs text-gray-500 hover:text-gray-700 font-medium border border-gray-200 px-2 py-0.5 rounded-md">Manage</button>
                    {u.id !== org?.id && (
                      <button onClick={() => handleRemoveUser(u.id, u.full_name)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="px-6 py-4 text-sm text-gray-400">No users found.</p>}
        </div>
      </div>

      </div>}

      {/* ── MANAGE USER MODAL ── */}
      {manageUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setManageUser(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Manage — {manageUser.full_name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{manageUser.email}</p>
              </div>
              <button onClick={() => setManageUser(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 overflow-y-auto space-y-5">
              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Role</label>
                <select value={manageForm.role} onChange={e => setManageForm(f => ({...f, role: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="admin">Admin — full access, manage team & billing</option>
                  <option value="manager">Manager — all operational features, no billing</option>
                  <option value="negotiator">Negotiator — properties, tenants, maintenance</option>
                  <option value="accounts">Accounts — payments, deposits, financials only</option>
                  <option value="read_only">Read Only — view everything, change nothing</option>
                </select>
              </div>

              {/* Restrict to assigned properties */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Property Access</label>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={manageForm.restrict_to_assigned}
                    onChange={e => setManageForm(f => ({...f, restrict_to_assigned: e.target.checked}))}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Restrict to assigned properties only</p>
                    <p className="text-xs text-gray-500 mt-0.5">When on, this person only sees data for the properties ticked below.</p>
                  </div>
                </label>
              </div>

              {/* Property checkboxes — only relevant when restrict_to_assigned */}
              {manageForm.restrict_to_assigned && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Assigned Properties <span className="font-normal text-gray-400 normal-case">({manageForm.property_ids.length} selected)</span>
                  </label>
                  {allProperties.length === 0 ? (
                    <p className="text-sm text-gray-400">No properties found.</p>
                  ) : (
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {allProperties.map(p => (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-gray-50">
                          <input type="checkbox" checked={manageForm.property_ids.includes(p.id)}
                            onChange={() => toggleManageProp(p.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.address_line1}{p.city ? `, ${p.city}` : ''}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {manageMsg && <p className="text-sm text-red-500">{manageMsg}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={saveManage} disabled={manageSaving}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {manageSaving ? 'Saving…' : 'Save permissions'}
              </button>
              <button onClick={() => setManageUser(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING ── */}
      {activeTab === 'billing' && <div className="space-y-6">

      {/* Subscription */}
      {billing && (
        <div className={`rounded-xl border shadow-sm overflow-hidden ${
          billing.status === 'active' ? 'bg-white border-gray-200' :
          billing.trial_active ? 'bg-indigo-50 border-indigo-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Subscription</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your PropAIrty plan</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              billing.status === 'active' ? 'bg-green-100 text-green-700' :
              billing.trial_active ? 'bg-indigo-100 text-indigo-700' :
              billing.status === 'past_due' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {billing.status === 'active' ? 'Active' :
               billing.trial_active ? `Trial — ${billing.trial_days_left}d left` :
               billing.status === 'past_due' ? 'Payment overdue' :
               billing.status === 'canceled' ? 'Cancelled' :
               billing.status === 'trialing' && !billing.trial_active ? 'Trial expired' :
               billing.status}
            </span>
          </div>
          <div className="px-6 py-5 space-y-4">
            {billing.trial_active && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-900">
                  You have <span className="font-bold">{billing.trial_days_left} day{billing.trial_days_left !== 1 ? 's' : ''}</span> remaining on your free trial.
                </p>
                <p className="text-xs text-indigo-700">
                  Trial ends {new Date(billing.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  Subscribe now to avoid any interruption.
                </p>
              </div>
            )}
            {(billing.status === 'trialing' && !billing.trial_active) && (
              <p className="text-sm font-medium text-red-700">Your free trial has expired. Subscribe to restore full access.</p>
            )}
            {billing.status === 'past_due' && (
              <p className="text-sm font-medium text-red-700">Your last payment failed. Please update your payment method to keep your account active.</p>
            )}
            {billing.status === 'active' && (
              <p className="text-sm text-green-700">Your subscription is active. Manage your plan, update card details, or view invoices below.</p>
            )}
            {billing.status === 'canceled' && (
              <p className="text-sm text-gray-600">Your subscription has been cancelled. Re-subscribe to regain access.</p>
            )}
            <div className="flex gap-3 flex-wrap">
              {!billing.has_subscription && billing.stripe_configured && (
                <button onClick={handleSubscribe} disabled={billingLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {billingLoading ? 'Loading…' : 'Subscribe — £49/mo'}
                </button>
              )}
              {billing.has_subscription && billing.stripe_configured && (
                <button onClick={handleManageBilling} disabled={billingLoading}
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {billingLoading ? 'Loading…' : 'Manage billing'}
                </button>
              )}
              {!billing.stripe_configured && (
                <p className="text-xs text-gray-500 italic">Stripe not yet configured — add Stripe keys in the Integrations tab to enable billing.</p>
              )}
            </div>
          </div>
        </div>
      )}

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

      </div>}

      {/* ── CONTRACTORS ── */}
      {activeTab === 'contractors' && <div className="space-y-6">
      <ContractorSetup contractors={contractors} />
      </div>}

      {/* ── REMINDERS ── */}
      {activeTab === 'reminders' && <div className="space-y-6">

      {/* Reminder Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Rent Reminder Settings</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose which channels to use and when reminders are sent each day at 8am.</p>
        </div>
        <div className="px-6 py-5 space-y-6">

          {/* Channels */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Channels</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'email', label: 'Email', icon: '✉', note: 'Requires tenant email' },
                { id: 'whatsapp', label: 'WhatsApp', icon: '💬', note: 'Requires WhatsApp number' },
                { id: 'sms', label: 'SMS', icon: '📱', note: 'Requires phone number' },
                { id: 'portal', label: 'In-portal', icon: '🔔', note: 'Requires portal enabled' },
              ].map(ch => (
                <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                  className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    reminderChannels.includes(ch.id)
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <p className="text-lg mb-1">{ch.icon}</p>
                  <p className={`text-sm font-semibold ${reminderChannels.includes(ch.id) ? 'text-indigo-700' : 'text-gray-700'}`}>{ch.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ch.note}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">When to send</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { d: 7,  label: '7 days before' },
                { d: 3,  label: '3 days before' },
                { d: 1,  label: '1 day before' },
                { d: 0,  label: 'Due today' },
                { d: -1, label: '1 day overdue' },
                { d: -3, label: '3 days overdue' },
                { d: -7, label: '7 days overdue' },
                { d: -14,label: '14 days overdue' },
              ].map(({ d, label }) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    reminderDays.includes(d)
                      ? d < 0
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <button onClick={saveReminderSettings} disabled={reminderSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
              {reminderSaving ? 'Saving…' : 'Save reminder settings'}
            </button>
            {reminderMsg && <p className={`text-sm ${reminderMsg === 'Saved.' ? 'text-green-600' : 'text-red-500'}`}>{reminderMsg}</p>}
          </div>

          {/* Test email */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Test email</p>
            <form onSubmit={handleTestEmail} className="flex gap-3">
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="Send a test email to..." required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Send test
              </button>
            </form>
            {testEmailMsg && <p className={`text-sm mt-2 ${testEmailMsg.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>{testEmailMsg}</p>}
          </div>
        </div>
      </div>

      </div>}

      {/* ── BRANDING ── */}
      {activeTab === 'branding' && <div className="space-y-6">

      {/* Public Website Branding */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Public Website &amp; Branding</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Customise your public property listings site.
            {brandingSlug && (
              <> View at <a href={`/site/${brandingSlug}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium ml-1">propairty.co.uk/site/{brandingSlug}</a></>
            )}
          </p>
        </div>
        <form onSubmit={saveBranding} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Agency tagline</label>
              <input value={branding.tagline} onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))}
                placeholder="e.g. Lettings you can trust"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={branding.brand_color || '#4f46e5'}
                  onChange={e => setBranding(b => ({ ...b, brand_color: e.target.value }))}
                  className="h-9 w-14 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <input value={branding.brand_color || '#4f46e5'}
                  onChange={e => setBranding(b => ({ ...b, brand_color: e.target.value }))}
                  placeholder="#4f46e5"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
              <input value={branding.logo_url} onChange={e => setBranding(b => ({ ...b, logo_url: e.target.value }))}
                placeholder="https://... or /uploads/your-logo.png"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <p className="text-xs text-gray-400 mt-1">Upload your logo via Properties → Photos, then paste the /uploads/... path here.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
              <input value={branding.website_url} onChange={e => setBranding(b => ({ ...b, website_url: e.target.value }))}
                placeholder="https://yourwebsite.co.uk"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Office address (shown in footer)</label>
            <input value={branding.address_text} onChange={e => setBranding(b => ({ ...b, address_text: e.target.value }))}
              placeholder="e.g. 12 High Street, Newcastle, NE1 1AB"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {/* Preview swatch */}
          {branding.brand_color && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: branding.brand_color }} />
              <div>
                <p className="text-xs font-medium text-gray-700">Colour preview</p>
                <p className="text-xs text-gray-400">This will be used for buttons, badges and accents on your public site.</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={brandingSaving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {brandingSaving ? 'Saving…' : 'Save branding'}
            </button>
            {brandingMsg && <p className={`text-sm ${brandingMsg === 'Saved.' ? 'text-green-600' : 'text-red-500'}`}>{brandingMsg}</p>}
          </div>
        </form>
      </div>

      {/* Custom domain */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Custom Domain</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Point your own domain at your agency website instead of propairty.co.uk/site/{brandingSlug}.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
            <p className="font-medium">Setup instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>In your DNS provider, add a <strong>CNAME record</strong> pointing your domain to <code className="bg-amber-100 px-1 rounded">propairty.co.uk</code></li>
              <li>Enter your domain below and save</li>
              <li>Contact us to provision the SSL certificate (usually same day)</li>
            </ol>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Your custom domain</label>
            <input
              type="text"
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="e.g. lettings.yourcompany.co.uk"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to use your default propairty.co.uk/site/{brandingSlug} address.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setCustomDomainSaving(true); setCustomDomainMsg('')
                try {
                  await api.put('/settings/custom-domain', { custom_domain: customDomain })
                  setCustomDomainMsg('Saved.')
                } catch (e) {
                  setCustomDomainMsg(e?.response?.data?.detail || 'Error saving.')
                } finally { setCustomDomainSaving(false) }
              }}
              disabled={customDomainSaving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {customDomainSaving ? 'Saving…' : 'Save domain'}
            </button>
            {customDomainMsg && <p className={`text-sm ${customDomainMsg === 'Saved.' ? 'text-green-600' : 'text-red-500'}`}>{customDomainMsg}</p>}
          </div>
        </div>
      </div>

      </div>}

      {/* ── INTEGRATIONS ── */}
      {activeTab === 'integrations' && <div className="space-y-6">

      {/* API Keys */}
      {apiKeyStatus && org?.role === 'admin' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">API Keys &amp; Integrations</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure third-party services. Keys are write-only — existing values are never shown.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { id: 'email',          label: 'Email (SMTP / IMAP)',       icon: '✉️' },
              { id: 'ai',             label: 'AI Providers',              icon: '🤖' },
              { id: 'payments',       label: 'Payments (Stripe)',         icon: '💳' },
              { id: 'communications', label: 'Communications (Twilio / Telegram)', icon: '📱' },
              { id: 'oauth',          label: 'OAuth (Google / Microsoft)', icon: '🔐' },
            ].map(({ id, label, icon }) => {
              const keys = apiKeyStatus[id] || []
              const configuredCount = keys.filter(k => k.configured).length
              const total = keys.length
              const allDone = configuredCount === total
              const hasDraft = keys.some(k => apiKeyDraft[k.field])
              return (
                <details key={id} className="group">
                  <summary className="px-6 py-4 flex items-center justify-between cursor-pointer list-none hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{configuredCount} of {total} configured</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        allDone ? 'bg-green-100 text-green-700' :
                        configuredCount > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {allDone ? 'All set' : configuredCount > 0 ? 'Partial' : 'Not configured'}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="px-6 pb-5 pt-2 space-y-3 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {keys.map(k => (
                        <div key={k.field}>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                            {k.label}
                            {k.configured
                              ? <span className="text-green-500 font-bold">✓</span>
                              : <span className="text-red-400 font-bold">✗</span>
                            }
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={apiKeyDraft[k.field] || ''}
                            onChange={e => setApiKeyDraft(prev => ({ ...prev, [k.field]: e.target.value }))}
                            placeholder={k.configured ? '— already configured, enter new value to change —' : (k.placeholder || 'Enter value…')}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => saveApiKeys(id)}
                        disabled={!hasDraft || apiKeySaving === id}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40">
                        {apiKeySaving === id ? 'Saving…' : 'Save'}
                      </button>
                      {apiKeyMsg && <p className={`text-sm ${apiKeyMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{apiKeyMsg}</p>}
                    </div>
                    {id === 'communications' && (
                      <div className="border-t border-gray-200 pt-3 mt-1">
                        <p className="text-sm font-medium text-gray-700 mb-2">Test SMS</p>
                        <form onSubmit={handleTestSms} className="flex gap-3">
                          <input
                            type="tel"
                            value={testSmsNumber}
                            onChange={e => setTestSmsNumber(e.target.value)}
                            placeholder="07700 900 000"
                            required
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                            Send test SMS
                          </button>
                        </form>
                        {testSmsMsg && <p className={`text-sm mt-2 ${testSmsMsg.toLowerCase().includes('sent') ? 'text-green-600' : 'text-red-500'}`}>{testSmsMsg}</p>}
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      </div>}

      {/* ── BLOG & CONTENT ── */}
      {activeTab === 'blog' && <div className="space-y-6">
        {/* Post form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{blogEditing ? 'Edit Post' : 'New Post'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Use categories <strong>tenant_advice</strong> or <strong>landlord_advice</strong> to populate your public advice pages dynamically.
            </p>
          </div>
          <form onSubmit={saveBlogPost} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input required value={blogForm.title} onChange={e => setBlogForm(f => ({...f, title: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select value={blogForm.category} onChange={e => setBlogForm(f => ({...f, category: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['post','tenant_advice','landlord_advice','market','tips','area'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cover Image URL</label>
                <input value={blogForm.cover_url} onChange={e => setBlogForm(f => ({...f, cover_url: e.target.value}))}
                  placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Excerpt</label>
                <input value={blogForm.excerpt} onChange={e => setBlogForm(f => ({...f, excerpt: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Body (HTML or plain text)</label>
                <textarea value={blogForm.body} onChange={e => setBlogForm(f => ({...f, body: e.target.value}))}
                  rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={blogForm.published} onChange={e => setBlogForm(f => ({...f, published: e.target.checked}))}
                  className="rounded" />
                Published (visible on public site)
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={blogSaving}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {blogSaving ? 'Saving…' : blogEditing ? 'Update Post' : 'Publish Post'}
              </button>
              {blogEditing && (
                <button type="button" onClick={() => { setBlogEditing(null); setBlogForm({ title: '', excerpt: '', body: '', cover_url: '', category: 'post', published: true }) }}
                  className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              )}
              {blogMsg && <span className="text-sm text-gray-500">{blogMsg}</span>}
            </div>
          </form>
        </div>

        {/* Posts list */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">All Posts ({blogPosts.length})</h2>
          </div>
          {blogPosts.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No posts yet. Create your first one above.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {blogPosts.map(p => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs mr-2">{p.category}</span>
                      {p.published ? <span className="text-green-600">Published</span> : <span className="text-gray-400">Draft</span>}
                      {p.published_at && <span className="ml-2">{new Date(p.published_at).toLocaleDateString('en-GB')}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => editBlogPost(p)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => deleteBlogPost(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}

      {/* ── FEATURES ── */}
      {activeTab === 'features' && <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Feature Flags</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Enable or disable features across all portals and the public website. Tenants, landlords, and contractors will only see the features you switch on.
            </p>
          </div>
          <div className="px-6 py-5 space-y-6">
            {!features ? (
              <p className="text-sm text-gray-400">Loading features…</p>
            ) : (
              Object.entries(features.groups).map(([groupLabel, items]) => (
                <div key={groupLabel}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{groupLabel}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(f => (
                      <div key={f.key} className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${f.enabled ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-800 truncate">{f.label}</span>
                          {f.premium_only && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold shrink-0">Premium</span>
                          )}
                        </div>
                        {org?.role === 'admin' ? (
                          <button
                            onClick={() => toggleFeature(f.key)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ml-3 ${f.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${f.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                          </button>
                        ) : (
                          <span className={`text-xs font-medium ml-3 ${f.enabled ? 'text-indigo-600' : 'text-gray-400'}`}>{f.enabled ? 'On' : 'Off'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          {org?.role === 'admin' && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
              <button onClick={saveFeatures} disabled={featuresSaving}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {featuresSaving ? 'Saving…' : 'Save Changes'}
              </button>
              {featuresMsg && <span className="text-sm text-gray-500">{featuresMsg}</span>}
            </div>
          )}
        </div>
      </div>}

      {/* ── PREFERENCES ── */}
      {activeTab === 'preferences' && <div className="space-y-6">

      {/* Language */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('settings.language')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Changes the language across the entire platform for your account.</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LANGUAGES.map(l => (
              <button key={l.code}
                onClick={() => i18n.changeLanguage(l.code)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                  i18n.language === l.code
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                <span className="text-base">{l.flag}</span>
                <span className="truncate">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">AI Assistant</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose the personality of your PropAIrty assistant.</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {[
              { gender: 'male',   name: 'Mendy', icon: '🤵', color: 'indigo', desc: 'Male · Blue' },
              { gender: 'female', name: 'Wendy', icon: '👩‍💼', color: 'violet', desc: 'Female · Purple' },
            ].map(opt => (
              <button key={opt.gender}
                onClick={() => { setAssistantGender(opt.gender); localStorage.setItem('assistant_gender', opt.gender); window.dispatchEvent(new Event('assistant_gender_changed')) }}
                className={`flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all ${
                  assistantGender === opt.gender
                    ? opt.color === 'indigo'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-3xl">{opt.icon}</span>
                <span className={`text-sm font-bold ${assistantGender === opt.gender ? (opt.color === 'indigo' ? 'text-indigo-700' : 'text-violet-700') : 'text-gray-700'}`}>{opt.name}</span>
                <span className="text-xs text-gray-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      </div>}

    </div>
  )
}

function ContractorSetup({ contractors }) {
  const TRADE_CATEGORIES = [
    { trade: 'Gas Engineer',               icon: '🔥', desc: 'Gas safety, boilers, CP12' },
    { trade: 'Electrician',               icon: '⚡', desc: 'EICR, rewires, fault finding' },
    { trade: 'Plumber',                   icon: '🔧', desc: 'Leaks, bathrooms, drainage' },
    { trade: 'Insulation Specialist',     icon: '🏠', desc: 'Loft, cavity wall, EPC upgrades' },
    { trade: 'Renewable Energy Installer',icon: '☀️', desc: 'Solar PV, heat pumps' },
    { trade: 'EPC Assessor',              icon: '📋', desc: 'Energy performance certificates' },
    { trade: 'Glazier',                   icon: '🪟', desc: 'Windows, double glazing' },
    { trade: 'Roofer',                    icon: '🏗️', desc: 'Roof repairs, flat roofs' },
    { trade: 'Builder',                   icon: '🧱', desc: 'General building and refurb' },
    { trade: 'Locksmith',                icon: '🔑', desc: 'Locks, security, access' },
    { trade: 'Painter/Decorator',         icon: '🖌️', desc: 'Interior and exterior' },
    { trade: 'Damp Proofing Specialist',  icon: '💧', desc: 'Damp, mould, tanking' },
    { trade: 'Cleaner',                   icon: '🧹', desc: 'End of tenancy cleans' },
    { trade: 'Gardener',                  icon: '🌿', desc: 'Garden and grounds' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">Contractor setup</h2>
      <p className="text-sm text-gray-500 mb-4">Make sure you have at least one contractor for each trade. When maintenance jobs come in, the system uses this list to suggest the right contractor.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TRADE_CATEGORIES.map(cat => {
          const count = contractors.filter(c =>
            (c.trade || '').toLowerCase() === cat.trade.toLowerCase() && c.is_active !== false
          ).length
          const status = count === 0 ? 'missing' : count === 1 ? 'ok' : 'good'
          return (
            <a key={cat.trade} href={`/contractors?trade=${encodeURIComponent(cat.trade)}`}
              className={`rounded-xl border p-4 flex flex-col gap-1 transition-all hover:shadow-md cursor-pointer ${
                status === 'missing' ? 'border-red-200 bg-red-50' :
                status === 'ok'      ? 'border-amber-200 bg-amber-50' :
                'border-green-200 bg-green-50'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{cat.icon}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  status === 'missing' ? 'bg-red-100 text-red-700' :
                  status === 'ok'      ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {status === 'missing' ? 'None' : `${count}`}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1">{cat.trade}</p>
              <p className="text-xs text-gray-500">{cat.desc}</p>
              {status === 'missing' && (
                <p className="text-xs text-red-600 font-medium mt-1">+ Add a contractor</p>
              )}
            </a>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3">Green = 2+ contractors (good coverage) · Amber = 1 contractor · Red = none assigned</p>
    </div>
  )
}
