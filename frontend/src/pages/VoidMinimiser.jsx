import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const BANDS = [
  { key: '30',   label: '0–30 days',   sub: 'Expired or ending within 30 days', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600',    bold: 'text-red-700',    count_bg: 'bg-red-100'    },
  { key: '60',   label: '31–60 days',  sub: 'Ending within 60 days',            bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', bold: 'text-orange-700', count_bg: 'bg-orange-100' },
  { key: '90',   label: '61–90 days',  sub: 'Ending within 90 days',            bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-600',  bold: 'text-amber-700',  count_bg: 'bg-amber-100'  },
  { key: '120',  label: '91–120 days', sub: 'Ending within 120 days',           bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', bold: 'text-yellow-800', count_bg: 'bg-yellow-100' },
  { key: '120+', label: '120+ days',   sub: 'Ending within 180 days',           bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-500',   bold: 'text-gray-700',   count_bg: 'bg-gray-100'   },
]

export default function VoidMinimiser() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(null)
  const [me, setMe] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/intelligence/void-risk'),
      api.get('/auth/me').catch(() => ({ data: null })),
    ]).then(([r, u]) => {
      setData(r.data)
      setMe(u.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
    </div>
  )

  const grouped = Object.fromEntries(BANDS.map(b => [b.key, data?.filter(v => v.risk === b.key) || []]))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <PageHeader title="Void Minimiser" subtitle="Identify at-risk voids before they happen" />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-5 gap-3">
        {BANDS.map(b => (
          <button key={b.key} onClick={() => setFilter(f => f === b.key ? null : b.key)}
            className={`rounded-xl border p-4 text-left w-full transition-all ${b.bg} ${b.border} ${filter === b.key ? 'ring-2 ring-indigo-400' : 'hover:opacity-80'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${b.text}`}>{b.label}</p>
            <p className={`text-3xl font-bold mt-1 ${b.bold}`}>{grouped[b.key].length}</p>
            <p className={`text-xs mt-1 ${b.text} opacity-70`}>{b.sub}</p>
          </button>
        ))}
      </div>

      {data?.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-3xl mb-2">✓</p>
          <p className="font-semibold text-green-800">No at-risk voids in the next 120 days</p>
          <p className="text-sm text-green-600 mt-1">All active leases either have confirmed renewals or end further away.</p>
        </div>
      )}

      {filter && (
        <button onClick={() => setFilter(null)} className="text-sm text-indigo-600 hover:underline">
          ← Show all
        </button>
      )}

      {BANDS.filter(b => !filter || filter === b.key).map(b => {
        const items = grouped[b.key]
        if (!items.length) return null
        return (
          <div key={b.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-3 border-b text-sm font-semibold ${b.bg} ${b.border} ${b.bold}`}>
              {b.label} — {b.sub}
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(v => (
                <VoidRow key={v.lease_id} void_={v} band={b} me={me}
                  onGenerateListing={() => navigate(`/listing-generator?property=${v.property_id}&unit=${v.unit_id}`)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function buildDefaultEmail(v, me) {
  const first = v.tenant_name?.split(' ')[0] || 'there'
  const leaseEnd = new Date(v.lease_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const subject = `Your tenancy at ${v.property_name} is ending — would you like to stay?`
  const agentName = me?.full_name || 'The Lettings Team'
  const agentEmail = me?.email || ''
  const orgName = me?.organisation_name || ''
  const contactLine = agentEmail
    ? `or email us at ${agentEmail}`
    : 'or get in touch with us directly'
  const body = `Hi ${first},

Your tenancy at ${v.property_name}, ${v.unit_name} is coming to an end on ${leaseEnd}.

We'd love to have you stay, and renewing is straightforward — just let us know you're interested and we'll take care of the paperwork.

Property: ${v.property_name}, ${v.unit_name}
Lease ends: ${leaseEnd}${v.monthly_rent ? `\nMonthly rent: £${v.monthly_rent.toLocaleString()}/mo` : ''}

To confirm your intention to renew, log in to your tenant portal and visit the Renewal tab — ${contactLine}.

If you've already been in touch, or have decided not to renew, please ignore this message. We'll need at least one month's written notice if you plan to leave.

Kind regards,
${agentName}${orgName ? `\n${orgName}` : ''}`
  return { subject, body }
}

function EmailPreviewModal({ void_: v, me, onClose, onSent }) {
  const defaults = buildDefaultEmail(v, me)
  const [subject, setSubject] = useState(defaults.subject)
  const [body, setBody] = useState(defaults.body)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setSending(true)
    setError('')
    try {
      await api.post(`/intelligence/void-risk/${v.lease_id}/email-tenant`, { subject, body })
      onSent()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to send.')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Email to {v.tenant_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{v.tenant_email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
          <button onClick={send} disabled={sending || !subject.trim() || !body.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
            {sending ? 'Sending…' : '✉️ Send email'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VoidRow({ void_: v, band: b, me, onGenerateListing }) {
  const [emailState, setEmailState] = useState('idle')
  const [showPreview, setShowPreview] = useState(false)

  return (
    <>
      {showPreview && (
        <EmailPreviewModal
          void_={v}
          me={me}
          onClose={() => setShowPreview(false)}
          onSent={() => { setShowPreview(false); setEmailState('sent') }}
        />
      )}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{v.property_name} — {v.unit_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Tenant: {v.tenant_name} · {v.bedrooms} bed · £{v.monthly_rent.toLocaleString()}/mo
          </p>
          {v.renewal_status && (
            <p className={`text-xs mt-1 font-medium ${
              v.renewal_status === 'declined' ? 'text-red-600' :
              v.renewal_status === 'sent' ? 'text-amber-600' : 'text-gray-500'
            }`}>
              Renewal: {v.renewal_status}
            </p>
          )}
          {!v.renewal_status && (
            <p className="text-xs mt-1 text-gray-400 italic">No renewal started</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${b.bold}`}>
            {v.days_left <= 0 ? `Expired ${Math.abs(v.days_left)}d ago` : `${v.days_left}d left`}
          </p>
          <p className="text-xs text-gray-400">{new Date(v.lease_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={onGenerateListing}
            className="text-xs bg-indigo-50 text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-100 whitespace-nowrap">
            ✍️ Draft listing
          </button>
          {v.tenant_email && (
            <button
              onClick={() => emailState === 'idle' && setShowPreview(true)}
              disabled={emailState === 'sent'}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                emailState === 'sent'  ? 'bg-green-50 text-green-700 cursor-default' :
                emailState === 'error' ? 'bg-red-50 text-red-700' :
                'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}>
              {emailState === 'sent' ? '✓ Email sent' : emailState === 'error' ? '✗ Failed' : '✉️ Email tenant'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
