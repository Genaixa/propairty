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
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/intelligence/void-risk')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
    </div>
  )

  const grouped = Object.fromEntries(BANDS.map(b => [b.key, data?.filter(v => v.risk === b.key) || []]))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                <VoidRow key={v.lease_id} void_={v} band={b}
                  onGenerateListing={() => navigate(`/listing-generator?property=${v.property_id}&unit=${v.unit_id}`)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VoidRow({ void_: v, band: b, onGenerateListing }) {
  const [emailState, setEmailState] = useState('idle')

  async function handleEmailTenant() {
    setEmailState('sending')
    try {
      await api.post(`/intelligence/void-risk/${v.lease_id}/email-tenant`)
      setEmailState('sent')
    } catch {
      setEmailState('error')
      setTimeout(() => setEmailState('idle'), 3000)
    }
  }

  return (
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
          <button onClick={handleEmailTenant} disabled={emailState === 'sending' || emailState === 'sent'}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              emailState === 'sent'    ? 'bg-green-50 text-green-700 cursor-default' :
              emailState === 'error'   ? 'bg-red-50 text-red-700' :
              emailState === 'sending' ? 'bg-gray-50 text-gray-400 cursor-default' :
              'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {emailState === 'sent' ? '✓ Email sent' : emailState === 'sending' ? 'Sending…' : emailState === 'error' ? '✗ Failed' : '✉️ Email tenant'}
          </button>
        )}
      </div>
    </div>
  )
}
