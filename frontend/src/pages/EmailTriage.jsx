import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const CATEGORY_META = {
  maintenance_request: { label: 'Maintenance',      color: 'bg-orange-100 text-orange-800',  icon: '🔧' },
  rent_query:          { label: 'Rent Query',        color: 'bg-green-100 text-green-800',    icon: '💷' },
  tenancy_enquiry:     { label: 'Tenancy Enquiry',   color: 'bg-blue-100 text-blue-800',      icon: '🔍' },
  renewal_query:       { label: 'Renewal',           color: 'bg-purple-100 text-purple-800',  icon: '🔄' },
  complaint:           { label: 'Complaint',         color: 'bg-red-100 text-red-800',        icon: '⚠️' },
  contractor_update:   { label: 'Contractor',        color: 'bg-yellow-100 text-yellow-800',  icon: '👷' },
  landlord_query:      { label: 'Landlord Query',    color: 'bg-indigo-100 text-indigo-800',  icon: '🏢' },
  notice_to_quit:      { label: 'Notice to Quit',    color: 'bg-red-100 text-red-800',        icon: '📮' },
  legal_notice:        { label: 'Legal Notice',      color: 'bg-red-200 text-red-900',        icon: '⚖️' },
  other:               { label: 'Other',             color: 'bg-gray-100 text-gray-700',      icon: '📧' },
}

const URGENCY_META = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'URGENT', color: 'bg-red-100 text-red-700 font-bold' },
}

const SOURCE_META = {
  email:               { label: 'Email',          color: 'bg-gray-100 text-gray-600',     icon: '📧' },
  sms:                 { label: 'SMS',            color: 'bg-green-100 text-green-700',   icon: '💬' },
  whatsapp:            { label: 'WhatsApp',       color: 'bg-emerald-100 text-emerald-700', icon: '📱' },
  telegram:            { label: 'Telegram',       color: 'bg-sky-100 text-sky-700',       icon: '✈️' },
  portal_maintenance:  { label: 'Portal',         color: 'bg-indigo-100 text-indigo-700', icon: '🏠' },
  portal_message:      { label: 'Portal message', color: 'bg-indigo-100 text-indigo-700', icon: '💬' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SenderCard({ profile }) {
  if (!profile) return null
  const isTenant = profile.type === 'tenant'
  const isLandlord = profile.type === 'landlord'
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-sm font-bold shrink-0">
        {profile.name?.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-indigo-900">{profile.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
            {isTenant ? 'Tenant' : 'Landlord'}
          </span>
        </div>
        {isTenant && (
          <div className="text-xs text-indigo-700 mt-0.5 space-y-0.5">
            <div>{profile.property}{profile.unit ? ` · ${profile.unit}` : ''}</div>
            <div className="flex gap-3">
              {profile.monthly_rent && <span>£{profile.monthly_rent}/mo</span>}
              {profile.lease_end && <span>Lease ends {profile.lease_end}</span>}
              {profile.open_maintenance > 0 && (
                <span className="text-orange-600">{profile.open_maintenance} open job{profile.open_maintenance > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )}
        {isLandlord && profile.properties?.length > 0 && (
          <div className="text-xs text-indigo-700 mt-0.5">{profile.properties.join(', ')}</div>
        )}
        <div className="flex gap-2 mt-2">
          {isTenant && profile.id && (
            <Link to={`/tenants/${profile.id}`} className="text-xs text-indigo-600 hover:underline">View tenant →</Link>
          )}
          {isTenant && profile.property_id && (
            <Link to={`/properties/${profile.property_id}`} className="text-xs text-indigo-600 hover:underline">View property →</Link>
          )}
          {isLandlord && profile.id && (
            <Link to={`/landlords/${profile.id}`} className="text-xs text-indigo-600 hover:underline">View landlord →</Link>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, href, variant = 'primary' }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors'
  const styles = {
    primary:   `${base} bg-indigo-600 text-white hover:bg-indigo-700`,
    secondary: `${base} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`,
    danger:    `${base} bg-red-50 border border-red-200 text-red-700 hover:bg-red-100`,
  }
  if (href) return <Link to={href} className={styles[variant]}>{children}</Link>
  return <button onClick={onClick} className={styles[variant]}>{children}</button>
}

function StatPill({ label, value, color }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${color}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs leading-tight">{label}</span>
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
      {copied ? '✓ Copied' : label}
    </button>
  )
}

export default function EmailTriage() {
  const [replyCopied, setReplyCopied] = useState(false)
  const [queue, setQueue] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [result, setResult] = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [inboundSettings, setInboundSettings] = useState(null)
  const [connectLoading, setConnectLoading] = useState('')
  const [telegramRegistering, setTelegramRegistering] = useState(false)
  const [telegramMsg, setTelegramMsg] = useState('')
  const [draftText, setDraftText] = useState('')
  const [selectedChannels, setSelectedChannels] = useState([])
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState(null)

  const loadQueue = () =>
    api.get('/intelligence/triage-queue').then(r => setQueue(r.data)).catch(() => {})

  const loadSettings = () =>
    api.get('/inbound/settings').then(r => setInboundSettings(r.data)).catch(() => {})

  useEffect(() => {
    loadQueue()
    loadSettings()
  }, [])

  const selectItem = (item) => {
    setSelectedItem(item)
    setResult(item)
    setDraftText(item.suggested_reply || '')
    setSendResults(null)
    // Pre-select the channel the message arrived on
    const ch = item.source === 'sms' ? ['sms']
      : item.source === 'whatsapp' ? ['whatsapp']
      : item.source === 'telegram' ? ['telegram']
      : ['email']
    setSelectedChannels(ch)
  }

  const dismiss = async (id) => {
    await api.patch(`/intelligence/triage-queue/${id}`, { status: 'dismissed' })
    setQueue(q => q.filter(i => i.id !== id))
    if (selectedItem?.id === id) { setSelectedItem(null); setResult(null) }
  }

  const markActioned = async (id) => {
    await api.patch(`/intelligence/triage-queue/${id}`, { status: 'actioned' })
    setQueue(q => q.map(i => i.id === id ? { ...i, status: 'actioned' } : i))
  }

  const sendReply = async () => {
    if (!draftText.trim() || !activeResult) return
    setSending(true)
    setSendResults(null)
    try {
      const r = await api.post('/inbound/reply', {
        triage_item_id: activeResult.id,
        reply_text: draftText,
        channels: selectedChannels,
      })
      setSendResults(r.data.results)
      setQueue(q => q.map(i => i.id === activeResult.id ? { ...i, status: 'actioned' } : i))
    } catch (e) {
      setSendResults({ _error: e.response?.data?.detail || 'Send failed' })
    }
    setSending(false)
  }

  const toggleChannel = (ch) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  const copyReply = () => {
    if (!draftText) return
    navigator.clipboard.writeText(draftText)
    setReplyCopied(true)
    setTimeout(() => setReplyCopied(false), 2000)
  }

  const connectGmail = async () => {
    setConnectLoading('gmail')
    try {
      const r = await api.post('/inbound/gmail/connect')
      window.location.href = r.data.auth_url
    } catch (e) {
      alert(e.response?.data?.detail || 'Gmail OAuth not configured')
      setConnectLoading('')
    }
  }

  const connectOutlook = async () => {
    setConnectLoading('outlook')
    try {
      const r = await api.post('/inbound/outlook/connect')
      window.location.href = r.data.auth_url
    } catch (e) {
      alert(e.response?.data?.detail || 'Outlook OAuth not configured')
      setConnectLoading('')
    }
  }

  const disconnectGmail = async () => {
    await api.delete('/inbound/gmail')
    setInboundSettings(s => ({ ...s, gmail_connected: false, gmail_email: null }))
  }

  const disconnectOutlook = async () => {
    await api.delete('/inbound/outlook')
    setInboundSettings(s => ({ ...s, outlook_connected: false, outlook_email: null }))
  }

  const registerTelegram = async () => {
    setTelegramRegistering(true)
    setTelegramMsg('')
    try {
      const r = await api.post('/inbound/telegram/register')
      setTelegramMsg(`✓ Webhook registered: ${r.data.webhook_url}`)
    } catch (e) {
      setTelegramMsg(e.response?.data?.detail || 'Failed to register webhook')
    }
    setTelegramRegistering(false)
  }

  // Stats
  const pending = queue.filter(i => i.status === 'pending').length
  const urgent  = queue.filter(i => i.status === 'pending' && i.urgency === 'urgent').length

  // Filtered queue
  const filtered = queue.filter(i => {
    if (filterCat && i.category !== filterCat) return false
    if (filterUrgency && i.urgency !== filterUrgency) return false
    if (filterSource && i.source !== filterSource) return false
    if (filterStatus === 'pending' && i.status !== 'pending') return false
    if (filterStatus === 'actioned' && i.status !== 'actioned') return false
    if (filterStatus === 'all') return true
    return true
  })

  // If selected item is filtered out, don't show it in the right panel
  const selectedInView = selectedItem && filtered.some(i => i.id === selectedItem.id)
  const activeResult = selectedInView ? result : null

  const cat = activeResult ? (CATEGORY_META[activeResult.category] || CATEGORY_META.other) : null
  const urg = activeResult ? (URGENCY_META[activeResult.urgency] || URGENCY_META.low) : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader title="Smart Inbox Triage" subtitle="AI identifies senders, categorises communications and drafts replies" />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Pending" value={pending} color="bg-red-50 border-red-200 text-red-800" />
        <StatPill label="Urgent" value={urgent}  color="bg-orange-50 border-orange-200 text-orange-800" />
      </div>

      {/* Inbound connections */}
      {inboundSettings && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inbound Channels</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* ── Email forwarding ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">📧 Email forwarding</p>
              <p className="text-xs text-gray-400">Forward any inbox to this address</p>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.forwarding_address}</span>
                <CopyButton text={inboundSettings.forwarding_address} />
              </div>
            </div>

            {/* ── Gmail ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">Gmail</p>
              <p className="text-xs text-gray-400">Pull unread mail via OAuth</p>
              {inboundSettings.gmail_connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg truncate">✓ {inboundSettings.gmail_email}</span>
                  <button onClick={disconnectGmail} className="text-xs text-red-500 hover:text-red-700 shrink-0">×</button>
                </div>
              ) : (
                <button onClick={connectGmail} disabled={connectLoading === 'gmail'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {connectLoading === 'gmail' ? 'Connecting…' : 'Connect Gmail'}
                </button>
              )}
            </div>

            {/* ── Outlook ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">Outlook / Microsoft 365</p>
              <p className="text-xs text-gray-400">Pull unread mail via OAuth</p>
              {inboundSettings.outlook_connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg truncate">✓ {inboundSettings.outlook_email}</span>
                  <button onClick={disconnectOutlook} className="text-xs text-red-500 hover:text-red-700 shrink-0">×</button>
                </div>
              ) : (
                <button onClick={connectOutlook} disabled={connectLoading === 'outlook'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#0078d4">
                    <path d="M21.2 3H8.8C7.8 3 7 3.8 7 4.8V7H3.8C2.8 7 2 7.8 2 8.8v10.4C2 20.2 2.8 21 3.8 21H16.2c1 0 1.8-.8 1.8-1.8V17H21.2c1 0 1.8-.8 1.8-1.8V4.8C23 3.8 22.2 3 21.2 3zM16 19.2c0 .1-.1.2-.2.2H3.8c-.1 0-.2-.1-.2-.2V11l6.2 3.9 6.2-3.9v8.2zm0-9.9L10 13.1 4 9.3V8.8c0-.1.1-.2.2-.2H15.8c.1 0 .2.1.2.2v.5zm5 5.9c0 .1-.1.2-.2.2H18V11l-1-1V4.8c0-.1.1-.2.2-.2H21.2c.1 0 .2.1.2.2v10.4z"/>
                  </svg>
                  {connectLoading === 'outlook' ? 'Connecting…' : 'Connect Outlook'}
                </button>
              )}
            </div>

            {/* ── SMS ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">💬 SMS (Twilio)</p>
              {inboundSettings.twilio_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Twilio configured</p>
                  {inboundSettings.twilio_sms_number && (
                    <p className="text-xs text-gray-500">Number: <span className="font-mono">{inboundSettings.twilio_sms_number}</span></p>
                  )}
                  <p className="text-xs text-gray-400">Set in Twilio console → Messaging webhook:</p>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.sms_webhook_url}</span>
                    <CopyButton text={inboundSettings.sms_webhook_url} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Add <span className="font-mono">TWILIO_ACCOUNT_SID</span> and <span className="font-mono">TWILIO_AUTH_TOKEN</span> to .env.production to enable</p>
              )}
            </div>

            {/* ── WhatsApp ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">📱 WhatsApp (Twilio)</p>
              {inboundSettings.twilio_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Twilio configured</p>
                  {inboundSettings.twilio_whatsapp_number && (
                    <p className="text-xs text-gray-500">Number: <span className="font-mono">{inboundSettings.twilio_whatsapp_number}</span></p>
                  )}
                  <p className="text-xs text-gray-400">Set in Twilio → WhatsApp sandbox → webhook:</p>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.whatsapp_webhook_url}</span>
                    <CopyButton text={inboundSettings.whatsapp_webhook_url} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Add Twilio credentials to .env.production to enable</p>
              )}
            </div>

            {/* ── Telegram ── */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-medium text-gray-600">✈️ Telegram Bot</p>
              {inboundSettings.telegram_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Bot token configured</p>
                  <p className="text-xs text-gray-400">Register the webhook once to start receiving messages:</p>
                  <button onClick={registerTelegram} disabled={telegramRegistering}
                    className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {telegramRegistering ? 'Registering…' : 'Register webhook'}
                  </button>
                  {telegramMsg && <p className="text-xs text-gray-600">{telegramMsg}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400">Create a bot via <span className="font-mono">@BotFather</span> then add <span className="font-mono">TELEGRAM_BOT_TOKEN</span> to .env.production</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium">Filter:</span>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          <option value="pending">Pending</option>
          <option value="actioned">Actioned</option>
          <option value="all">All</option>
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          <option value="">All sources</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
          <option value="portal_maintenance">Portal</option>
          <option value="portal_message">Portal message</option>
        </select>
        <select
          value={filterUrgency}
          onChange={e => setFilterUrgency(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          <option value="">All urgencies</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {(filterCat || filterUrgency || filterSource || filterStatus !== 'pending') && (
          <button
            onClick={() => { setFilterCat(''); setFilterUrgency(''); setFilterSource(''); setFilterStatus('pending') }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >× Clear</button>
        )}
        <button onClick={loadQueue} className="ml-auto text-xs text-gray-400 hover:text-gray-600">↺ Refresh</button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: queue */}
        <div className="col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Inbox
                {pending > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending}</span>
                )}
              </h2>
              <span className="text-xs text-gray-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-xs text-gray-400 text-center">No items match the current filters.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
                {filtered.map(item => {
                  const hcat = CATEGORY_META[item.category] || CATEGORY_META.other
                  const hurg = URGENCY_META[item.urgency] || URGENCY_META.low
                  const hsrc = SOURCE_META[item.source] || SOURCE_META.email
                  const isSelected = selectedItem?.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-gray-50'} ${item.status === 'actioned' ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${hsrc.color}`}>{hsrc.icon} {hsrc.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${hcat.color}`}>{hcat.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${hurg.color}`}>{hurg.label}</span>
                        {item.status === 'actioned' && <span className="text-xs text-green-600">✓</span>}
                      </div>
                      <p className="text-xs text-gray-800 font-medium truncate">{item.subject || '(no subject)'}</p>
                      {item.from_name && <p className="text-xs text-gray-400">{item.from_name}</p>}
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate flex-1">{item.summary}</p>
                        <span className="text-xs text-gray-400 ml-2 shrink-0">{timeAgo(item.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="col-span-3 space-y-4">
          {!activeResult && (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-sm text-gray-500">Select an item from the queue to view details.</p>
              <p className="text-xs text-gray-400 mt-1">Portal submissions are triaged automatically. Emails forwarded to your inbound address appear here instantly.</p>
            </div>
          )}

          {activeResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{activeResult.error}</div>
          )}

          {activeResult && !activeResult.error && (
            <>
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cat.color}`}>{cat.icon} {cat.label}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${urg.color}`}>{urg.label} priority</span>
                    {activeResult.confidence && (
                      <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">{activeResult.confidence}% confidence</span>
                    )}
                  </div>
                  {activeResult.created_at && (
                    <span className="text-xs text-gray-400 shrink-0">{formatDateTime(activeResult.created_at)}</span>
                  )}
                </div>

                {activeResult.subject && (
                  <p className="text-sm font-semibold text-gray-800">{activeResult.subject}</p>
                )}
                {activeResult.summary && (
                  <p className="text-sm text-gray-600">{activeResult.summary}</p>
                )}

                {/* Sender identification */}
                {activeResult.sender_profile ? (
                  <SenderCard profile={activeResult.sender_profile} />
                ) : activeResult.from_email ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                    ⚠️ Sender <strong>{activeResult.from_email}</strong> not found in your tenant or landlord database.
                  </div>
                ) : null}

                {/* Auto-created records */}
                {activeResult.records_created?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-green-800">Records auto-created:</p>
                    {activeResult.records_created.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-green-700">✓ {r.label}</span>
                        {r.type === 'maintenance_request' && (
                          <Link to="/maintenance" className="text-xs text-indigo-600 hover:underline">View →</Link>
                        )}
                        {r.type === 'applicant' && (
                          <Link to="/applicants" className="text-xs text-indigo-600 hover:underline">View →</Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action items */}
                {activeResult.action_items?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions required</p>
                    <ul className="space-y-1">
                      {activeResult.action_items.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-gray-400 mt-0.5">→</span>{a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Original body */}
                {activeResult.body && (
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer hover:text-gray-600 select-none">Show original message</summary>
                    <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-600 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {activeResult.body}
                    </div>
                  </details>
                )}

                {/* Queue actions */}
                {selectedItem?.id && (
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    {selectedItem.status !== 'actioned' && (
                      <button onClick={() => markActioned(selectedItem.id)} className="text-xs text-green-600 hover:text-green-800 font-medium">✓ Mark actioned</button>
                    )}
                    <button onClick={() => dismiss(selectedItem.id)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
                  </div>
                )}

                {/* Quick action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeResult.category === 'maintenance_request' && activeResult.sender_profile?.property_id && (
                    <ActionButton href="/maintenance">Open maintenance</ActionButton>
                  )}
                  {activeResult.category === 'renewal_query' && (
                    <ActionButton href="/renewals">Go to renewals</ActionButton>
                  )}
                  {activeResult.category === 'tenancy_enquiry' && (
                    <ActionButton href="/applicants">View applicants</ActionButton>
                  )}
                  {activeResult.category === 'rent_query' && (
                    <ActionButton href="/payments">View payments</ActionButton>
                  )}
                  {activeResult.category === 'complaint' && (
                    <ActionButton variant="danger">Log formal complaint</ActionButton>
                  )}
                  {activeResult.sender_profile?.type === 'tenant' && activeResult.sender_profile.id && (
                    <ActionButton variant="secondary" href={`/tenants/${activeResult.sender_profile.id}`}>Tenant profile</ActionButton>
                  )}
                  {activeResult.sender_profile?.type === 'landlord' && activeResult.sender_profile.id && (
                    <ActionButton variant="secondary" href={`/landlords/${activeResult.sender_profile.id}`}>Landlord profile</ActionButton>
                  )}
                </div>
              </div>

              {/* Reply composer */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">Reply</h2>
                  <button onClick={copyReply} className="text-xs text-gray-400 hover:text-gray-600">
                    {replyCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {/* Editable textarea */}
                  <textarea
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    rows={6}
                    className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                    placeholder="Write your reply…"
                  />

                  {/* Channel selector */}
                  {(() => {
                    const profile = activeResult.sender_profile || {}
                    const hasEmail = !!(profile.email || activeResult.from_email?.includes('@'))
                    const hasPhone = !!(profile.phone || ['sms','whatsapp'].includes(activeResult.source))
                    const hasTelegram = !!(profile.telegram_chat_id || activeResult.source === 'telegram')
                    const isTenant = profile.type === 'tenant'

                    const CHANNELS = [
                      { id: 'email',    label: 'Email',    icon: '📧', avail: hasEmail,    reason: 'No email address on record' },
                      { id: 'sms',      label: 'SMS',      icon: '💬', avail: hasPhone,    reason: 'No phone number on record' },
                      { id: 'whatsapp', label: 'WhatsApp', icon: '📱', avail: hasPhone,    reason: 'No phone number on record' },
                      { id: 'telegram', label: 'Telegram', icon: '✈️', avail: hasTelegram, reason: 'Message must first arrive via Telegram' },
                    ]

                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500">Send via</p>
                        <div className="flex flex-wrap gap-2">
                          {CHANNELS.map(ch => {
                            const on = selectedChannels.includes(ch.id)
                            return (
                              <button
                                key={ch.id}
                                onClick={() => ch.avail && toggleChannel(ch.id)}
                                title={ch.avail ? `Toggle ${ch.label}` : ch.reason}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                                  ${!ch.avail
                                    ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400 bg-white'
                                    : on
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
                              >
                                {ch.icon} {ch.label}
                              </button>
                            )
                          })}
                          {/* Portal — always shown, always highlighted */}
                          <span
                            title={isTenant ? 'Always sent to tenant portal' : 'Only available for known tenants'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border
                              ${isTenant
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'opacity-30 border-gray-200 text-gray-400 bg-white'}`}
                          >
                            🏠 Portal {isTenant && <span className="opacity-70 text-xs">always</span>}
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Send button */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={sendReply}
                      disabled={sending || (selectedChannels.length === 0 && activeResult.sender_profile?.type !== 'tenant') || !draftText.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                    {selectedChannels.length === 0 && activeResult.sender_profile?.type !== 'tenant' && (
                      <p className="text-xs text-gray-400">Select at least one channel</p>
                    )}
                  </div>

                  {/* Send results */}
                  {sendResults && (
                    <div className="space-y-1 pt-1 border-t border-gray-100">
                      {sendResults._error && (
                        <p className="text-xs text-red-600">{sendResults._error}</p>
                      )}
                      {Object.entries(sendResults).filter(([k]) => k !== '_error').map(([ch, res]) => (
                        <div key={ch} className="flex items-center gap-2 text-xs">
                          <span className={res.ok ? 'text-green-600' : 'text-red-500'}>
                            {res.ok ? '✓' : '✗'}
                          </span>
                          <span className="font-medium capitalize">{ch}</span>
                          {res.to && <span className="text-gray-400">→ {res.to}</span>}
                          {res.error && <span className="text-red-400">{res.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
