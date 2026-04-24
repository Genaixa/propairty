import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '')
const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'

export default function Section13() {
  const [due, setDue] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [results, setResults] = useState({})

  useEffect(() => {
    api.get('/intelligence/section13-due').then(r => { setDue(r.data); setLoading(false) })
  }, [])

  const generate = async (lease) => {
    setGenerating(lease.lease_id)
    try {
      const r = await api.post('/intelligence/section13', {
        lease_id: lease.lease_id,
        new_rent: lease.suggested_rent,
        effective_date: lease.earliest_effective_date,
      })
      setResults(prev => ({ ...prev, [lease.lease_id]: r.data }))
    } catch (e) {
      setResults(prev => ({ ...prev, [lease.lease_id]: { error: e.response?.data?.detail || e.message } }))
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Section 13 Rent Review" subtitle="Housing Act 1988 statutory rent increase notices" />

      {due.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          No leases currently due for a Section 13 rent review.
        </div>
      ) : (
        <div className="space-y-4">
          {due.map(lease => {
            const result = results[lease.lease_id]
            return (
              <div key={lease.lease_id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{lease.tenant_name}</h3>
                    <p className="text-sm text-gray-500">{lease.property_address}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-600">
                      <span>Current: <strong>£{lease.current_rent}/mo</strong></span>
                      <span>Suggested: <strong className="text-indigo-600">£{lease.suggested_rent}/mo</strong></span>
                      <span>Increase: <strong className="text-green-600">+{lease.increase_pct}%</strong></span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Effective from: {fmt(lease.earliest_effective_date)} · Last review: {lease.last_review ? fmt(lease.last_review) : 'Never'}
                    </p>
                  </div>
                  {!result && (
                    <button
                      onClick={() => generate(lease)}
                      disabled={generating === lease.lease_id}
                      className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {generating === lease.lease_id ? 'Generating…' : 'Generate Notice'}
                    </button>
                  )}
                  {result && !result.error && (
                    <a
                      href={`${API_BASE}/api/intelligence/section13/${result.notice_id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
                {result?.error && <p className="mt-2 text-sm text-red-600">{result.error}</p>}
                {result && !result.error && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                    Notice generated — new rent £{result.new_rent}/mo effective {result.effective_date}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
