import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const CATEGORY_META = {
  maintenance_request: { label: 'Maintenance',     color: 'bg-orange-100 text-orange-700' },
  rent_query:          { label: 'Rent',            color: 'bg-green-100 text-green-700' },
  tenancy_enquiry:     { label: 'Enquiry',         color: 'bg-blue-100 text-blue-700' },
  renewal_query:       { label: 'Renewal',         color: 'bg-purple-100 text-purple-700' },
  complaint:           { label: 'Complaint',       color: 'bg-red-100 text-red-700' },
  contractor_update:   { label: 'Contractor',      color: 'bg-yellow-100 text-yellow-700' },
  landlord_query:      { label: 'Landlord',        color: 'bg-indigo-100 text-indigo-700' },
  notice_to_quit:      { label: 'Notice to Quit',  color: 'bg-red-100 text-red-700' },
  legal_notice:        { label: 'Legal',           color: 'bg-red-200 text-red-800' },
  other:               { label: 'Other',           color: 'bg-gray-100 text-gray-600' },
}

const URGENCY_BORDER = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  medium: 'border-l-amber-300',
  low:    'border-l-gray-200',
}

const URGENCY_DOT = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-amber-300',
  low:    'bg-gray-300',
}

const URGENCY_META = {
  urgent: { label: 'Urgent', color: 'text-red-600 font-semibold' },
  high:   { label: 'High',   color: 'text-orange-600' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  low:    { label: 'Low',    color: 'text-gray-400' },
}

const SOURCE_LABEL = {
  email:              'Email',
  sms:                'SMS',
  whatsapp:           'WhatsApp',
  telegram:           'Telegram',
  portal_maintenance: 'Portal',
  portal_message:     'Portal',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SenderCard({ profile }) {
  if (!profile) return null
  const isTenant = profile.type === 'tenant'
  const isLandlord = profile.type === 'landlord'
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
        {profile.name?.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{profile.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
            {isTenant ? 'Tenant' : 'Landlord'}
          </span>
        </div>
        {isTenant && (
          <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
            <div>{profile.property}{profile.unit ? ` · ${profile.unit}` : ''}</div>
            <div className="flex gap-3 flex-wrap">
              {profile.monthly_rent && <span>£{profile.monthly_rent}/mo</span>}
              {profile.lease_end && <span>Lease ends {profile.lease_end}</span>}
              {profile.open_maintenance > 0 && (
                <span className="text-orange-600">{profile.open_maintenance} open job{profile.open_maintenance > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )}
        {isLandlord && profile.properties?.length > 0 && (
          <div className="text-xs text-gray-500 mt-0.5">{profile.properties.join(', ')}</div>
        )}
        <div className="flex gap-3 mt-1.5">
          {isTenant && profile.id && (
            <Link to={`/tenants/${profile.id}`} className="text-xs text-indigo-600 hover:underline">Tenant profile →</Link>
          )}
          {isTenant && profile.property_id && (
            <Link to={`/properties/${profile.property_id}`} className="text-xs text-indigo-600 hover:underline">Property →</Link>
          )}
          {isLandlord && profile.id && (
            <Link to={`/landlords/${profile.id}`} className="text-xs text-indigo-600 hover:underline">Landlord profile →</Link>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, href, variant = 'primary' }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer'
  const styles = {
    primary:   `${base} bg-indigo-600 text-white hover:bg-indigo-700`,
    secondary: `${base} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`,
    danger:    `${base} bg-red-50 border border-red-200 text-red-700 hover:bg-red-100`,
  }
  if (href) return <Link to={href} className={styles[variant]}>{children}</Link>
  return <button onClick={onClick} className={styles[variant]}>{children}</button>
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors cursor-pointer">
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
  const [showChannels, setShowChannels] = useState(false)
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

  useEffect(() => { loadQueue(); loadSettings() }, [])

  const selectItem = (item) => {
    setSelectedItem(item)
    setResult(item)
    setDraftText(item.suggested_reply || '')
    setSendResults(null)
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
    setSending(true); setSendResults(null)
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

  const toggleChannel = (ch) =>
    setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])

  const copyReply = () => {
    if (!draftText) return
    navigator.clipboard.writeText(draftText)
    setReplyCopied(true)
    setTimeout(() => setReplyCopied(false), 2000)
  }

  const connectGmail = async () => {
    setConnectLoading('gmail')
    try { const r = await api.post('/inbound/gmail/connect'); window.location.href = r.data.auth_url }
    catch (e) { alert(e.response?.data?.detail || 'Gmail OAuth not configured'); setConnectLoading('') }
  }

  const connectOutlook = async () => {
    setConnectLoading('outlook')
    try { const r = await api.post('/inbound/outlook/connect'); window.location.href = r.data.auth_url }
    catch (e) { alert(e.response?.data?.detail || 'Outlook OAuth not configured'); setConnectLoading('') }
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
    setTelegramRegistering(true); setTelegramMsg('')
    try {
      const r = await api.post('/inbound/telegram/register')
      setTelegramMsg(`Webhook registered: ${r.data.webhook_url}`)
    } catch (e) { setTelegramMsg(e.response?.data?.detail || 'Failed') }
    setTelegramRegistering(false)
  }

  const pending = queue.filter(i => i.status === 'pending').length
  const urgent  = queue.filter(i => i.status === 'pending' && i.urgency === 'urgent').length

  const filtered = queue.filter(i => {
    if (filterCat && i.category !== filterCat) return false
    if (filterUrgency && i.urgency !== filterUrgency) return false
    if (filterSource && i.source !== filterSource) return false
    if (filterStatus === 'pending' && i.status !== 'pending') return false
    if (filterStatus === 'actioned' && i.status !== 'actioned') return false
    return true
  })

  const selectedInView = selectedItem && filtered.some(i => i.id === selectedItem.id)
  const activeResult = selectedInView ? result : null
  const cat = activeResult ? (CATEGORY_META[activeResult.category] || CATEGORY_META.other) : null
  const urg = activeResult ? (URGENCY_META[activeResult.urgency] || URGENCY_META.low) : null

  const STATUS_TABS = [
    { key: 'pending',  label: 'Pending' },
    { key: 'actioned', label: 'Actioned' },
    { key: 'all',      label: 'All' },
  ]

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageHeader
            title="Smart Inbox"
            subtitle="AI categorises messages and drafts replies"
          />
          {(pending > 0 || urgent > 0) && (
            <div className="flex gap-3 mt-1">
              {pending > 0 && <span className="text-xs text-red-600 font-medium">{pending} pending</span>}
              {urgent > 0  && <span className="text-xs text-orange-600 font-medium">{urgent} urgent</span>}
            </div>
          )}
        </div>
        {inboundSettings && (
          <button
            onClick={() => setShowChannels(v => !v)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {showChannels ? 'Hide channels' : 'Channels'}
          </button>
        )}
      </div>

      {/* Inbound channels — collapsed by default */}
      {showChannels && inboundSettings && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Inbound Channels</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">Email forwarding</p>
              <p className="text-xs text-gray-400">Forward any inbox to this address</p>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.forwarding_address}</span>
                <CopyButton text={inboundSettings.forwarding_address} />
              </div>
            </div>

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">Gmail</p>
              {inboundSettings.gmail_connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded truncate">✓ {inboundSettings.gmail_email}</span>
                  <button onClick={disconnectGmail} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">×</button>
                </div>
              ) : (
                <button onClick={connectGmail} disabled={connectLoading === 'gmail'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
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

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">Outlook / Microsoft 365</p>
              {inboundSettings.outlook_connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded truncate">✓ {inboundSettings.outlook_email}</span>
                  <button onClick={disconnectOutlook} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">×</button>
                </div>
              ) : (
                <button onClick={connectOutlook} disabled={connectLoading === 'outlook'}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#0078d4">
                    <path d="M21.2 3H8.8C7.8 3 7 3.8 7 4.8V7H3.8C2.8 7 2 7.8 2 8.8v10.4C2 20.2 2.8 21 3.8 21H16.2c1 0 1.8-.8 1.8-1.8V17H21.2c1 0 1.8-.8 1.8-1.8V4.8C23 3.8 22.2 3 21.2 3zM16 19.2c0 .1-.1.2-.2.2H3.8c-.1 0-.2-.1-.2-.2V11l6.2 3.9 6.2-3.9v8.2zm0-9.9L10 13.1 4 9.3V8.8c0-.1.1-.2.2-.2H15.8c.1 0 .2.1.2.2v.5zm5 5.9c0 .1-.1.2-.2.2H18V11l-1-1V4.8c0-.1.1-.2.2-.2H21.2c.1 0 .2.1.2.2v10.4z"/>
                  </svg>
                  {connectLoading === 'outlook' ? 'Connecting…' : 'Connect Outlook'}
                </button>
              )}
            </div>

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">SMS (Twilio)</p>
              {inboundSettings.twilio_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Twilio configured{inboundSettings.twilio_sms_number ? ` · ${inboundSettings.twilio_sms_number}` : ''}</p>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.sms_webhook_url}</span>
                    <CopyButton text={inboundSettings.sms_webhook_url} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Add <span className="font-mono">TWILIO_ACCOUNT_SID</span> + <span className="font-mono">TWILIO_AUTH_TOKEN</span> to .env</p>
              )}
            </div>

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">WhatsApp (Twilio)</p>
              {inboundSettings.twilio_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Configured{inboundSettings.twilio_whatsapp_number ? ` · ${inboundSettings.twilio_whatsapp_number}` : ''}</p>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-xs font-mono text-gray-700 truncate flex-1">{inboundSettings.whatsapp_webhook_url}</span>
                    <CopyButton text={inboundSettings.whatsapp_webhook_url} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Add Twilio credentials to .env to enable</p>
              )}
            </div>

            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-medium text-gray-700">Telegram Bot</p>
              {inboundSettings.telegram_configured ? (
                <>
                  <p className="text-xs text-green-700">✓ Bot token configured</p>
                  <button onClick={registerTelegram} disabled={telegramRegistering}
                    className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                    {telegramRegistering ? 'Registering…' : 'Register webhook'}
                  </button>
                  {telegramMsg && <p className="text-xs text-gray-500">{telegramMsg}</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400">Create bot via <span className="font-mono">@BotFather</span>, then add <span className="font-mono">TELEGRAM_BOT_TOKEN</span></p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Main split layout */}
      <div className="grid grid-cols-5 gap-5">

        {/* Left: queue */}
        <div className="col-span-2 flex flex-col gap-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {/* Status tabs + filters */}
            <div className="border-b border-gray-100">
              <div className="flex">
                {STATUS_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setFilterStatus(t.key)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                      filterStatus === t.key
                        ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                    {t.key === 'pending' && pending > 0 && (
                      <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pending}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 px-3 py-2 border-t border-gray-50">
                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="">All types</option>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select
                  value={filterUrgency}
                  onChange={e => setFilterUrgency(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="">All urgencies</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={loadQueue}
                  title="Refresh"
                  className="text-gray-400 hover:text-gray-600 transition-colors px-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Queue items */}
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-xs text-gray-400 text-center">No items match the current filters.</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                {filtered.map(item => {
                  const hcat = CATEGORY_META[item.category] || CATEGORY_META.other
                  const urgBorder = URGENCY_BORDER[item.urgency] || URGENCY_BORDER.low
                  const isSelected = selectedItem?.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`border-l-[3px] ${urgBorder} px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      } ${item.status === 'actioned' ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.subject || '(no subject)'}</p>
                        <span className="text-xs text-gray-400 shrink-0">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${hcat.color}`}>{hcat.label}</span>
                        {item.from_name && <span className="text-xs text-gray-400 truncate">{item.from_name}</span>}
                        {item.status === 'actioned' && <span className="text-xs text-green-600 ml-auto shrink-0">✓</span>}
                      </div>
                      {item.summary && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{item.summary}</p>
                      )}
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
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm text-gray-500">Select a message to view details</p>
              <p className="text-xs text-gray-400 mt-1">Portal submissions are triaged automatically. Forwarded emails appear here instantly.</p>
            </div>
          )}

          {activeResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{activeResult.error}</div>
          )}

          {activeResult && !activeResult.error && (
            <>
              {/* Detail card */}
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">

                {/* Subject + meta */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${URGENCY_DOT[activeResult.urgency] || 'bg-gray-300'}`}></span>
                        <span className={`text-xs ${urg.color}`}>{urg.label}</span>
                      </div>
                      {activeResult.confidence && (
                        <span className="text-xs text-gray-400">{activeResult.confidence}% confidence</span>
                      )}
                      {activeResult.source && SOURCE_LABEL[activeResult.source] && (
                        <span className="text-xs text-gray-400">via {SOURCE_LABEL[activeResult.source]}</span>
                      )}
                    </div>
                    {activeResult.created_at && (
                      <span className="text-xs text-gray-400 shrink-0">{formatDateTime(activeResult.created_at)}</span>
                    )}
                  </div>
                  {activeResult.subject && (
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{activeResult.subject}</h3>
                  )}
                  {activeResult.summary && (
                    <p className="text-sm text-gray-600">{activeResult.summary}</p>
                  )}
                </div>

                {/* Sender */}
                <div className="px-5 py-4">
                  {activeResult.sender_profile ? (
                    <SenderCard profile={activeResult.sender_profile} />
                  ) : activeResult.from_email ? (
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Sender <strong className="mx-1">{activeResult.from_email}</strong> not found in your database
                    </div>
                  ) : null}
                </div>

                {/* Auto-created + action items */}
                {(activeResult.records_created?.length > 0 || activeResult.action_items?.length > 0) && (
                  <div className="px-5 py-4 space-y-3">
                    {activeResult.records_created?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Auto-created</p>
                        <div className="space-y-1">
                          {activeResult.records_created.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-700">{r.label}</span>
                              {r.type === 'maintenance_request' && (
                                <Link to={r.id ? `/maintenance?job=${r.id}` : '/maintenance'} className="text-indigo-600 hover:underline ml-1">View →</Link>
                              )}
                              {r.type === 'applicant' && (
                                <Link to="/applicants" className="text-indigo-600 hover:underline ml-1">View →</Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeResult.action_items?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Actions needed</p>
                        <ul className="space-y-1">
                          {activeResult.action_items.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-gray-300 mt-0.5">→</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Original message */}
                {activeResult.body && (
                  <div className="px-5 py-3">
                    <details className="text-xs">
                      <summary className="text-gray-400 cursor-pointer hover:text-gray-600 select-none">Show original message</summary>
                      <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-gray-600 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {activeResult.body}
                      </div>
                    </details>
                  </div>
                )}

                {/* Actions row */}
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {activeResult.category === 'maintenance_request' && activeResult.sender_profile?.property_id && (() => {
                      const jobRecord = activeResult.records_created?.find(r => r.type === 'maintenance_request')
                      return <ActionButton href={jobRecord ? `/maintenance?job=${jobRecord.id}` : '/maintenance'}>Open maintenance</ActionButton>
                    })()}
                    {activeResult.category === 'renewal_query' && <ActionButton href="/renewals">Go to renewals</ActionButton>}
                    {activeResult.category === 'tenancy_enquiry' && <ActionButton href="/applicants">View applicants</ActionButton>}
                    {activeResult.category === 'rent_query' && <ActionButton href="/payments">View payments</ActionButton>}
                    {activeResult.category === 'complaint' && <ActionButton variant="danger">Log complaint</ActionButton>}
                    {activeResult.sender_profile?.type === 'tenant' && activeResult.sender_profile.id && (
                      <ActionButton variant="secondary" href={`/tenants/${activeResult.sender_profile.id}`}>Tenant profile</ActionButton>
                    )}
                    {activeResult.sender_profile?.type === 'landlord' && activeResult.sender_profile.id && (
                      <ActionButton variant="secondary" href={`/landlords/${activeResult.sender_profile.id}`}>Landlord profile</ActionButton>
                    )}
                  </div>
                  <div className="flex gap-3 shrink-0">
                    {selectedItem?.status !== 'actioned' && (
                      <button onClick={() => markActioned(selectedItem.id)} className="text-xs text-green-600 hover:text-green-800 font-medium cursor-pointer">✓ Done</button>
                    )}
                    <button onClick={() => dismiss(selectedItem.id)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Dismiss</button>
                  </div>
                </div>
              </div>

              {/* Reply composer */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">Reply</h2>
                  <button onClick={copyReply} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
                    {replyCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <textarea
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    rows={5}
                    className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                    placeholder="Write your reply…"
                  />

                  {(() => {
                    const profile = activeResult.sender_profile || {}
                    const hasEmail = !!(profile.email || activeResult.from_email?.includes('@'))
                    const hasPhone = !!(profile.phone || ['sms','whatsapp'].includes(activeResult.source))
                    const hasTelegram = !!(profile.telegram_chat_id || activeResult.source === 'telegram')
                    const isTenant = profile.type === 'tenant'
                    const CHANNELS = [
                      { id: 'email',    label: 'Email',    avail: hasEmail,    reason: 'No email on record' },
                      { id: 'sms',      label: 'SMS',      avail: hasPhone,    reason: 'No phone on record' },
                      { id: 'whatsapp', label: 'WhatsApp', avail: hasPhone,    reason: 'No phone on record' },
                      { id: 'telegram', label: 'Telegram', avail: hasTelegram, reason: 'Needs to message first' },
                    ]
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Send via</span>
                        {CHANNELS.map(ch => {
                          const on = selectedChannels.includes(ch.id)
                          return (
                            <button
                              key={ch.id}
                              onClick={() => ch.avail && toggleChannel(ch.id)}
                              title={ch.avail ? undefined : ch.reason}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                                !ch.avail
                                  ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400 bg-white'
                                  : on
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                            >
                              {ch.label}
                            </button>
                          )
                        })}
                        <span
                          title={isTenant ? 'Always sent to tenant portal' : 'Only for known tenants'}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                            isTenant ? 'bg-indigo-600 border-indigo-600 text-white' : 'opacity-30 border-gray-200 text-gray-400 bg-white'}`}
                        >
                          Portal{isTenant ? ' ·always' : ''}
                        </span>
                      </div>
                    )
                  })()}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={sendReply}
                      disabled={sending || (selectedChannels.length === 0 && activeResult.sender_profile?.type !== 'tenant') || !draftText.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {sending ? 'Sending…' : 'Send reply'}
                    </button>
                    {selectedChannels.length === 0 && activeResult.sender_profile?.type !== 'tenant' && (
                      <p className="text-xs text-gray-400">Select a channel first</p>
                    )}
                  </div>

                  {sendResults && (
                    <div className="space-y-1 border-t border-gray-100 pt-2">
                      {sendResults._error && <p className="text-xs text-red-600">{sendResults._error}</p>}
                      {Object.entries(sendResults).filter(([k]) => k !== '_error').map(([ch, res]) => (
                        <div key={ch} className="flex items-center gap-2 text-xs">
                          <span className={res.ok ? 'text-green-600' : 'text-red-500'}>{res.ok ? '✓' : '✗'}</span>
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
