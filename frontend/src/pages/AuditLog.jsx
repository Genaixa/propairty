import { PageHeader } from '../components/Illustration'
import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const ACTION_COLOURS = {
  created:  'bg-green-100 text-green-700',
  updated:  'bg-blue-100 text-blue-700',
  deleted:  'bg-red-100 text-red-700',
  sent:     'bg-violet-100 text-violet-700',
  viewed:   'bg-gray-100 text-gray-600',
}

const ENTITY_ICONS = {
  tenant:       '👤',
  property:     '🏠',
  lease:        '📄',
  payment:      '💷',
  maintenance:  '🔧',
  compliance:   '📋',
  deposit:      '🏦',
  applicant:    '🔍',
  notice:       '⚖️',
  contractor:   '🔨',
  landlord:     '🏢',
  inspection:   '🔎',
  document:     '📁',
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function timeSince(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days, limit: 200 }
      if (entityType) params.entity_type = entityType
      if (action) params.action = action
      if (search) params.search = search
      const r = await api.get('/audit', { params })
      setEntries(r.data)
    } finally {
      setLoading(false)
    }
  }, [entityType, action, search, days])

  useEffect(() => { load() }, [load])

  const entityTypes = [
    '', 'tenant', 'property', 'lease', 'payment', 'maintenance',
    'compliance', 'deposit', 'applicant', 'notice', 'contractor', 'landlord',
  ]
  const actions = ['', 'created', 'updated', 'deleted', 'sent', 'viewed']

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Full history of actions taken in your organisation">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, detail, or user…"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All types</option>
          {entityTypes.filter(Boolean).map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All actions</option>
          {actions.filter(Boolean).map(a => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-500 text-sm">No audit log entries found for this filter.</p>
            <p className="text-gray-400 text-xs mt-1">Audit entries are created as your team takes actions in the platform.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Record</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-gray-900 text-xs font-medium">{timeSince(e.created_at)}</p>
                    <p className="text-gray-400 text-xs">{fmtDate(e.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700 font-medium">{e.user_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLOURS[e.action] || 'bg-gray-100 text-gray-600'}`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600">
                      {ENTITY_ICONS[e.entity_type] || '📌'} {e.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {e.entity_name || (e.entity_id ? `#${e.entity_id}` : '—')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {e.detail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {entries.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
            Showing {entries.length} entries · Last {days} days
          </div>
        )}
      </div>
    </div>
  )
}
