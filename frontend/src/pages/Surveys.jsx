import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const STARS = [1, 2, 3, 4, 5]

function StarDisplay({ rating }) {
  return (
    <span className="text-lg">
      {STARS.map(i => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  )
}

export default function Surveys() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/surveys').then(r => { setData(r.data); setLoading(false) })
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  const { average_rating, total_responses, total_sent, surveys } = data
  const responseRate = total_sent > 0 ? Math.round((total_responses / total_sent) * 100) : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Tenant Satisfaction" subtitle="Auto-sent surveys when maintenance jobs are closed" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-indigo-600">
            {average_rating ? (
              <span>{average_rating} <span className="text-yellow-400 text-2xl">★</span></span>
            ) : '—'}
          </div>
          <div className="text-sm text-gray-500 mt-1">Average Rating</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-gray-900">{total_responses}</div>
          <div className="text-sm text-gray-500 mt-1">Responses</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-gray-900">{responseRate}%</div>
          <div className="text-sm text-gray-500 mt-1">Response Rate ({total_sent} sent)</div>
        </div>
      </div>

      {total_responses > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Rating Distribution</h2>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const count = surveys.filter(s => s.rating === star).length
              const pct = total_responses > 0 ? (count / total_responses) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-gray-600 font-medium">{star}</span>
                  <span className="text-yellow-400">★</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="bg-yellow-400 rounded-full h-3 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-gray-500 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Recent Responses</h2>
        </div>
        {surveys.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No responses yet. Surveys are sent automatically when maintenance jobs are closed.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Tenant</th>
                <th className="px-4 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-left">Rating</th>
                <th className="px-4 py-3 text-left">Comment</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {surveys.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.tenant_name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{s.job_title}</td>
                  <td className="px-4 py-3"><StarDisplay rating={s.rating} /></td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs">
                    {s.comment ? <span className="italic">"{s.comment}"</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.responded_at ? new Date(s.responded_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
