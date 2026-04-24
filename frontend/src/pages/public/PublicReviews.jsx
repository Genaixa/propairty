import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-4 h-4 ${i<=n?'text-amber-400':'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  )
}

export default function PublicReviews() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const [reviews, setReviews] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ reviewer_name:'', reviewer_type:'tenant', rating:5, body:'', property_name:'' })
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const brand = org?.brand_color || D

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}/reviews`).then(r => setReviews(r.data)).catch(() => {})
  }, [slug])

  const avg = reviews.length ? (reviews.reduce((s,r) => s+r.rating,0) / reviews.length).toFixed(1) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await axios.post(`${API_BASE}/api/public/${slug}/reviews`, form)
      setSubmitted(true)
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Failed to submit — try again.')
    }
    setSending(false)
  }

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Customer reviews" subtitle={avg ? `Rated ${avg}/5 based on ${reviews.length} review${reviews.length!==1?'s':''}` : "Hear what our tenants and landlords say about us."} page="reviews" brand={brand} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{reviews.length} review{reviews.length!==1?'s':''}</h2>
          <button onClick={() => setShowForm(v => !v)}
            className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            style={bb(brand)}>
            Leave a review
          </button>
        </div>

        {/* Leave review form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {submitted ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-3">🎉</p>
                <p className="font-bold text-gray-900">Thank you for your review!</p>
                <p className="text-sm text-gray-500 mt-2">It will appear here after moderation.</p>
                <button onClick={() => { setSubmitted(false); setShowForm(false) }}
                  className="mt-4 text-sm font-semibold hover:underline" style={bt(brand)}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-bold text-gray-900">Write a review</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
                    <input required value={form.reviewer_name} onChange={e => setForm(f => ({...f,reviewer_name:e.target.value}))}
                      placeholder="Jane Smith"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">I am a</label>
                    <select value={form.reviewer_type} onChange={e => setForm(f => ({...f,reviewer_type:e.target.value}))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                      <option value="tenant">Tenant</option>
                      <option value="landlord">Landlord</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Rating *</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setForm(f => ({...f,rating:n}))}
                        className={`text-2xl transition-transform hover:scale-110 ${n<=form.rating?'text-amber-400':'text-gray-200'}`}>★</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Property (optional)</label>
                  <input value={form.property_name} onChange={e => setForm(f => ({...f,property_name:e.target.value}))}
                    placeholder="Which property did you rent?"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Your review *</label>
                  <textarea required rows={4} value={form.body} onChange={e => setForm(f => ({...f,body:e.target.value}))}
                    placeholder="Tell us about your experience…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"/>
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>}
                <button type="submit" disabled={sending}
                  className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60" style={bb(brand)}>
                  {sending ? 'Submitting…' : 'Submit review'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">⭐</p>
            <p className="text-gray-500">No reviews yet — be the first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{r.reviewer_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{r.reviewer_type}{r.property_name ? ` · ${r.property_name}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Stars n={r.rating} />
                    {r.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(r.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
