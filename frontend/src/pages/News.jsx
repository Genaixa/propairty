import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const SCORE_META = {
  5: { label: 'Must read',  color: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-500' },
  4: { label: 'Important',  color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  3: { label: 'Relevant',   color: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  2: { label: 'Useful',     color: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400' },
  1: { label: 'Background', color: 'bg-gray-50 text-gray-500 border-gray-200',    dot: 'bg-gray-300' },
}

export default function News() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [minScore, setMinScore] = useState(1)

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    try {
      const r = await api.get('/news')
      setData(r.data)
    } catch {}
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )

  const { articles = [], cached_at, is_fresh } = data || {}
  const filtered = articles.filter(a => (a.score || 3) >= minScore)

  const counts = [5,4,3,2,1].map(s => ({ score: s, n: articles.filter(a => (a.score||3) === s).length }))

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Property News" subtitle="Latest industry news · ranked by relevance to letting agents">
        {cached_at && (
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium
            ${is_fresh ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {is_fresh ? '● Live' : '● Refreshing soon'}
          </span>
        )}
      </PageHeader>

      {/* Warming up */}
      {articles.length === 0 && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📰</div>
          <p className="text-sm text-gray-500 font-medium">Fetching and ranking the latest property news…</p>
          <p className="text-xs text-gray-400 mt-1">The background refresh is running. Check back in a moment.</p>
        </div>
      )}

      {articles.length > 0 && (
        <>
          {/* Score filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Show:</span>
            {[5,4,3,2,1].map(s => {
              const m = SCORE_META[s]
              const active = minScore <= s
              const n = counts.find(c => c.score === s)?.n || 0
              return (
                <button
                  key={s}
                  onClick={() => setMinScore(s === minScore ? 1 : s)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors
                    ${minScore === s ? m.color + ' ring-1 ring-offset-0' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${m.dot}`}></span>
                  {m.label}
                  {n > 0 && <span className="opacity-60">({n})</span>}
                </button>
              )
            })}
            {minScore > 1 && (
              <button onClick={() => setMinScore(1)} className="text-xs text-gray-400 hover:text-gray-600">× Clear</button>
            )}
          </div>

          {/* Articles */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Headlines</h2>
              <p className="text-xs text-gray-400">{filtered.length} article{filtered.length !== 1 ? 's' : ''} · sorted by importance</p>
            </div>
            <div className="divide-y divide-gray-100">
              {filtered.map((a, i) => {
                const m = SCORE_META[a.score || 3]
                return (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                    {/* Score indicator */}
                    <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${m.dot}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {a.title}
                      </p>
                      {a.summary && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${m.color}`}>
                          {m.label}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {a.source}
                        </span>
                      </div>
                      {a.published && (
                        <p className="text-xs text-gray-400">{a.published.slice(0, 16)}</p>
                      )}
                    </div>
                  </a>
                )
              })}
              {filtered.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No articles at this filter level.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
