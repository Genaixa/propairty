import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'


const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

export default function PublicPortalLogin() {
  const { slug } = useParams()
  const [org, setOrg] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}`).then(r => setOrg(r.data)).catch(() => {})
  }, [slug])

  const brand = org?.brand_color || '#4338ca'

  return (
    <div className="min-h-screen flex">
      {/* Login panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        {/* Header */}
        <div className="mb-8 text-center">
          <a href={`/site/${slug}`} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to {org?.name || 'agency'} website
          </a>
          {org?.logo_url
            ? <img src={org.logo_url} alt={org?.name} className="h-10 w-auto object-contain mx-auto mb-2" />
            : <h1 className="text-2xl font-bold" style={{ color: brand }}>{org?.name || '…'}</h1>
          }
          <p className="text-gray-400 text-sm">{org?.tagline || 'Letting Agent'}</p>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Client login</h2>
          <p className="text-gray-400 text-sm mb-8">Choose your portal to sign in</p>

          <div className="space-y-4">
            <a href="/tenant/login"
              className="flex items-center justify-between w-full px-5 py-4 rounded-xl border-2 border-violet-100 bg-violet-50 hover:border-violet-300 hover:bg-violet-100 transition-all group">
              <div>
                <p className="text-sm font-semibold text-violet-800">Tenant portal</p>
                <p className="text-xs text-violet-500 mt-0.5">Rent, maintenance, documents & more</p>
              </div>
              <svg className="w-5 h-5 text-violet-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>

            <a href="/landlord/login"
              className="flex items-center justify-between w-full px-5 py-4 rounded-xl border-2 border-emerald-100 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100 transition-all group">
              <div>
                <p className="text-sm font-semibold text-emerald-800">Landlord portal</p>
                <p className="text-xs text-emerald-500 mt-0.5">Properties, payments & statements</p>
              </div>
              <svg className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>

            <a href={`/site/${slug}/account/login`}
              className="flex items-center justify-between w-full px-5 py-4 rounded-xl border-2 border-amber-100 bg-amber-50 hover:border-amber-300 hover:bg-amber-100 transition-all group">
              <div>
                <p className="text-sm font-semibold text-amber-800">Applicant account</p>
                <p className="text-xs text-amber-600 mt-0.5">Save properties, book viewings & apply</p>
              </div>
              <svg className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>


</div>
      </div>
    </div>
  )
}
