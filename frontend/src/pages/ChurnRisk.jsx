import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

export default function ChurnRisk() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/intelligence/churn-risk')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data?.filter(t =>
    filter === 'all' || t.risk_level === filter
  ) || []

  const high   = data?.filter(t => t.risk_level === 'high').length   || 0
  const medium = data?.filter(t => t.risk_level === 'medium').length || 0
  const low    = data?.filter(t => t.risk_level === 'low').length    || 0

  function toggleFilter(key) {
    setFilter(f => f === key ? 'all' : key)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <PageHeader title="Churn Risk" subtitle="Predict which tenants are likely to leave" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'High Risk', count: high, color: 'red', key: 'high' },
          { label: 'Medium Risk', count: medium, color: 'amber', key: 'medium' },
          { label: 'Stable', count: low, color: 'green', key: 'low' },
        ].map(c => (
          <button key={c.key} onClick={() => toggleFilter(c.key)}
            className={`rounded-xl border p-4 text-left transition-all ${
              filter === c.key ? 'ring-2 ring-indigo-500' : 'hover:opacity-80'
            } ${
              c.color === 'red'   ? 'bg-red-50 border-red-200'     :
              c.color === 'amber' ? 'bg-amber-50 border-amber-200' :
              'bg-green-50 border-green-200'
            }`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${
              c.color === 'red' ? 'text-red-600' : c.color === 'amber' ? 'text-amber-600' : 'text-green-600'
            }`}>{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${
              c.color === 'red' ? 'text-red-700' : c.color === 'amber' ? 'text-amber-700' : 'text-green-700'
            }`}>{c.count}</p>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-gray-600 font-medium">No tenants in this risk category</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(t => <TenantRiskRow key={t.tenant_id} tenant={t} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function buildMailto(tenant) {
  const first = tenant.tenant_name.split(' ')[0]
  const hasLate = tenant.factors.some(f => f.includes('late payment'))
  const hasMaint = tenant.factors.some(f => f.includes('maintenance'))
  const hasLease = tenant.factors.some(f => f.includes('Lease ends'))

  let subject, body

  if (tenant.risk_level === 'high') {
    subject = `Important — your tenancy at ${tenant.property_name}`
    body = `Hi ${first},\n\nI wanted to reach out personally regarding your tenancy at ${tenant.property_name}, ${tenant.unit_name}.\n\n`
    if (hasLate) body += `We have some outstanding payment matters we'd like to resolve with you.\n\n`
    if (hasMaint) body += `We're also aware of some open maintenance issues and want to make sure these are resolved to your satisfaction.\n\n`
    if (hasLease) body += `Your tenancy is due to expire soon and we'd love to discuss renewal options with you.\n\n`
    body += `Please do get in touch at your earliest convenience so we can help.\n\nKind regards`
  } else if (tenant.risk_level === 'medium') {
    subject = `Checking in — ${tenant.property_name}`
    body = `Hi ${first},\n\nI hope you're well and enjoying your home at ${tenant.property_name}, ${tenant.unit_name}.\n\nI just wanted to check in and make sure everything is going smoothly for you.`
    if (hasMaint) body += ` We're aware of some maintenance requests and want to ensure they've been resolved to your satisfaction.`
    if (hasLease) body += ` We'd also love to discuss your renewal options when you're ready.`
    body += `\n\nPlease don't hesitate to get in touch if there's anything we can do.\n\nKind regards`
  } else {
    subject = `How are you getting on? — ${tenant.property_name}`
    body = `Hi ${first},\n\nI hope all is well at ${tenant.property_name}, ${tenant.unit_name}. We just wanted to check in and make sure you're happy in your home.\n\nIf there's anything we can help with or if you have any questions about your tenancy, please don't hesitate to get in touch.\n\nKind regards`
  }

  return `mailto:${tenant.tenant_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function TenantRiskRow({ tenant }) {
  const [expanded, setExpanded] = useState(false)

  const riskColor = tenant.risk_level === 'high'
    ? 'bg-red-100 text-red-700'
    : tenant.risk_level === 'medium'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-green-100 text-green-700'

  const barColor = tenant.risk_level === 'high'
    ? 'bg-red-500' : tenant.risk_level === 'medium'
    ? 'bg-amber-400' : 'bg-green-500'

  return (
    <div>
      <button onClick={() => setExpanded(x => !x)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{tenant.tenant_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {tenant.property_name}{tenant.unit_name ? ` — ${tenant.unit_name}` : ''}
            {tenant.lease_end ? ` · Lease ends ${new Date(tenant.lease_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
        </div>
        {/* Score bar */}
        <div className="w-24 hidden sm:block">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${tenant.churn_score}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{tenant.churn_score}/100</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${riskColor}`}>
          {tenant.risk_level === 'high' ? 'High Risk' : tenant.risk_level === 'medium' ? 'Medium' : 'Stable'}
        </span>
        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && tenant.factors.length > 0 && (
        <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-2">Risk factors</p>
          <ul className="space-y-1.5">
            {tenant.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5">⚠</span> {f}
              </li>
            ))}
          </ul>
          {tenant.current_arrears > 0 ? (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="text-red-500 mt-0.5 shrink-0">⚠</span>
              <div>
                <p className="text-xs font-semibold text-red-700">£{tenant.current_arrears.toLocaleString()} in current arrears — retention not recommended</p>
                <p className="text-xs text-red-600 mt-0.5">Review payment action on the <Link to="/risk" className="underline font-medium">Rent Risk report</Link> before any contact.</p>
              </div>
            </div>
          ) : tenant.tenant_email && (
            <a href={buildMailto(tenant)}
              className="inline-block mt-3 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              Draft email to {tenant.tenant_name.split(' ')[0]} →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
