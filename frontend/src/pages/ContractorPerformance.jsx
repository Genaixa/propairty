import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function ContractorPerformance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/intelligence/contractor-performance')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  const trades = [...new Set(data?.map(c => c.trade).filter(Boolean) || [])]
  const jobsByTrade = trades.reduce((acc, t) => {
    acc[t] = data.filter(c => c.trade === t).reduce((s, c) => s + (c.total_jobs || 0), 0)
    return acc
  }, {})
  const totalJobs = data?.reduce((s, c) => s + (c.total_jobs || 0), 0) || 0
  const filtered = data?.filter(c =>
    (c.total_jobs || 0) > 0 && (!filter || c.trade === filter)
  ) || []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <PageHeader title="Contractor Performance" subtitle="Ratings, speed and reliability by trade" />
      </div>

      {/* Trade filter */}
      {trades.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              !filter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}>
            All trades {totalJobs > 0 && <span className={`ml-1 ${!filter ? 'opacity-75' : 'text-gray-400'}`}>({totalJobs})</span>}
          </button>
          {trades.map(t => (
            <button key={t} onClick={() => setFilter(filter === t ? '' : t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border capitalize transition-colors ${
                filter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}>
              {t} {jobsByTrade[t] > 0 && <span className={`ml-1 ${filter === t ? 'opacity-75' : 'text-gray-400'}`}>({jobsByTrade[t]})</span>}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">🔨</p>
          <p className="text-gray-600 font-medium">No contractors yet</p>
          <p className="text-sm text-gray-400 mt-1">Add contractors in the Contractors section to see performance data here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => <ContractorCard key={c.contractor_id} contractor={c} rank={i + 1} />)}
        </div>
      )}
    </div>
  )
}

function ContractorCard({ contractor: c, rank }) {
  const [expanded, setExpanded] = useState(false)
  const [jobsPanel, setJobsPanel] = useState(null) // null | 'all' | 'open'

  const scoreColor =
    c.performance_score >= 80 ? 'text-green-600 bg-green-50 border-green-200' :
    c.performance_score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-600 bg-red-50 border-red-200'

  const ringColor =
    c.performance_score >= 80 ? '#16a34a' :
    c.performance_score >= 50 ? '#d97706' : '#dc2626'

  const togglePanel = (panel, e) => {
    e.stopPropagation()
    setJobsPanel(prev => prev === panel ? null : panel)
  }

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n)

  const panelJobs = jobsPanel === 'open'
    ? (c.jobs || []).filter(j => j.status === 'open' || j.status === 'in_progress')
    : jobsPanel === 'reviews' ? [] : (c.jobs || [])

  const statusBadge = s => {
    if (s === 'completed') return 'bg-green-100 text-green-700'
    if (s === 'in_progress') return 'bg-blue-100 text-blue-700'
    if (s === 'open') return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(x => !x)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left">
        {/* Rank */}
        <span className="text-lg font-bold text-gray-300 w-6 shrink-0">#{rank}</span>

        {/* Score ring */}
        <div className="shrink-0">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="18" fill="none" stroke="#f3f4f6" strokeWidth="4" />
            <circle cx="24" cy="24" r="18" fill="none"
              stroke={ringColor} strokeWidth="4"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={2 * Math.PI * 18 * (1 - c.performance_score / 100)}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
            <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="bold" fill={ringColor}>
              {c.performance_score}
            </text>
          </svg>
        </div>

        {/* Name + trade */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{c.full_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {c.company_name ? `${c.company_name} · ` : ''}
            <span className="capitalize">{c.trade || 'General'}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          <button onClick={e => togglePanel('all', e)}
            className={`text-center px-2 py-1 rounded-lg transition-colors ${jobsPanel === 'all' ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-gray-100'}`}>
            <p className="text-sm font-bold text-gray-800">{c.total_jobs}</p>
            <p className="text-xs text-indigo-500 underline underline-offset-2 cursor-pointer">Jobs</p>
          </button>
          <Stat label="Completion" value={c.completion_rate !== null ? `${c.completion_rate}%` : '—'} />
          <Stat label="Avg cost" value={c.avg_cost ? `£${c.avg_cost.toLocaleString()}` : '—'} />
          <button onClick={e => togglePanel('open', e)}
            className={`text-center px-2 py-1 rounded-lg transition-colors ${jobsPanel === 'open' ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-gray-100'}`}>
            <p className={`text-sm font-bold ${c.open_jobs > 2 ? 'text-red-600' : 'text-gray-800'}`}>{c.open_jobs}</p>
            <p className="text-xs text-indigo-500 underline underline-offset-2 cursor-pointer">Open</p>
          </button>
          {c.review_count > 0 && (
            <button onClick={e => togglePanel('reviews', e)}
              className={`text-center px-2 py-1 rounded-lg transition-colors ${jobsPanel === 'reviews' ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-gray-100'}`}>
              <p className="text-sm font-bold text-amber-500">{c.avg_stars} ★</p>
              <p className="text-xs text-indigo-500 underline underline-offset-2 cursor-pointer">{c.review_count} review{c.review_count !== 1 ? 's' : ''}</p>
            </button>
          )}
        </div>

        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Jobs panel */}
      {jobsPanel && jobsPanel !== 'reviews' && (
        <div className="px-5 pb-4 border-t border-indigo-100 bg-indigo-50">
          <p className="text-xs font-semibold text-indigo-600 pt-3 pb-2 uppercase tracking-wide">
            {jobsPanel === 'open' ? 'Open / In Progress Jobs' : 'All Jobs'}
          </p>
          {panelJobs.length === 0 ? (
            <p className="text-xs text-gray-400 pb-2">No jobs to show.</p>
          ) : (
            <div className="space-y-2">
              {panelJobs.map(j => (
                <div key={j.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-indigo-100 text-sm">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${statusBadge(j.status)}`}>{j.status.replace('_', ' ')}</span>
                  <span className="flex-1 font-medium text-gray-800 truncate">{j.title}</span>
                  <span className="flex items-center gap-1 shrink-0 text-xs">
                    {j.property_id ? (
                      <a href={`/properties/${j.property_id}`} onClick={e => e.stopPropagation()}
                        className="text-indigo-500 hover:underline truncate max-w-[120px]">
                        {j.property_address || 'Property'}
                      </a>
                    ) : j.property_address ? (
                      <span className="text-gray-400">{j.property_address}</span>
                    ) : null}
                    {j.unit && j.property_id && j.unit_id && <span className="text-gray-300">·</span>}
                    {j.unit && j.property_id && j.unit_id ? (
                      <a href={`/properties/${j.property_id}/units/${j.unit_id}`} onClick={e => e.stopPropagation()}
                        className="text-indigo-400 hover:underline">
                        {j.unit}
                      </a>
                    ) : j.unit ? (
                      <span className="text-gray-400">{j.unit}</span>
                    ) : null}
                  </span>
                  {j.actual_cost && <span className="text-xs text-gray-500 shrink-0">£{j.actual_cost.toLocaleString()}</span>}
                  {j.created_at && <span className="text-xs text-gray-400 shrink-0">{j.created_at}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reviews panel */}
      {jobsPanel === 'reviews' && (
        <div className="px-5 pb-4 border-t border-amber-100 bg-amber-50">
          <p className="text-xs font-semibold text-amber-600 pt-3 pb-2 uppercase tracking-wide">
            Reviews · avg {c.avg_stars} ★
          </p>
          <div className="space-y-2">
            {(c.reviews || []).map(r => (
              <div key={r.id} className="bg-white rounded-lg px-3 py-2.5 border border-amber-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400 text-sm tracking-tight">{stars(r.stars)}</span>
                  <span className="text-xs text-gray-400">{r.reviewer_name} · {r.reviewer_type} · {r.created_at}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatBox label="Total Jobs" value={c.total_jobs} />
            <StatBox label="Completed" value={c.completed_jobs} />
            <StatBox label="Completion Rate" value={c.completion_rate !== null ? `${c.completion_rate}%` : 'N/A'} />
            <StatBox label="Avg Job Cost" value={c.avg_cost ? `£${c.avg_cost.toLocaleString()}` : 'N/A'} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {c.contact_name && (
              <span className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg">
                👤 {c.contact_name}
              </span>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`}
                className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                📞 {c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`}
                className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                ✉️ {c.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
      <p className="text-base font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
