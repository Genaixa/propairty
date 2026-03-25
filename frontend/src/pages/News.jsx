import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function News() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/news')
      setData(r.data)
    } catch {}
    setLoading(false)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await api.post('/news/refresh')
      await load()
    } catch {}
    setRefreshing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-500">Fetching news and generating AI briefing…</p>
      </div>
    </div>
  )

  const { articles = [], curation = {}, cached_at } = data || {}
  const cachedTime = cached_at ? new Date(cached_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property News</h1>
          {cachedTime && <p className="text-xs text-gray-400 mt-0.5">Last updated {cachedTime} · refreshes every 4 hours</p>}
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 flex items-center gap-1.5">
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>

      {/* AI Briefing */}
      {curation.briefing && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-indigo-600 font-semibold text-sm">AI Briefing</span>
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Powered by AI</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{curation.briefing}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Highlights */}
        {curation.highlights?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Key Stories</h2>
              <p className="text-xs text-gray-400 mt-0.5">What matters most this update</p>
            </div>
            <div className="divide-y divide-gray-100">
              {curation.highlights.map((h, i) => (
                <div key={i} className="px-5 py-3.5">
                  <p className="text-sm font-medium text-gray-900">{h.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{h.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action flags */}
        {curation.flagged?.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 rounded-t-xl">
              <h2 className="text-sm font-semibold text-amber-800">Action Required</h2>
              <p className="text-xs text-amber-600 mt-0.5">Things to consider for your agency</p>
            </div>
            <div className="divide-y divide-gray-100">
              {curation.flagged.map((f, i) => (
                <div key={i} className="px-5 py-3.5 flex gap-3">
                  <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All articles */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">All Headlines</h2>
          <p className="text-xs text-gray-400 mt-0.5">{articles.length} articles from UK property press</p>
        </div>
        <div className="divide-y divide-gray-100">
          {articles.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="block px-5 py-3.5 hover:bg-gray-50 transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {a.title}
                  </p>
                  {a.summary && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {a.source}
                  </span>
                  {a.published && (
                    <p className="text-xs text-gray-400 mt-1">{a.published.slice(0, 16)}</p>
                  )}
                </div>
              </div>
            </a>
          ))}
          {articles.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No articles loaded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
