import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

export default function PublicAreas() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const [about, setAbout] = useState(null)
  const [props, setProps] = useState([])
  const brand = org?.brand_color || D

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}/about`).then(r => setAbout(r.data)).catch(() => {})
    axios.get(`${API_BASE}/api/public/${slug}/properties`).then(r => setProps(r.data)).catch(() => {})
  }, [slug])

  const areas = about?.areas || []

  // Group properties by area
  const byArea = {}
  props.forEach(p => {
    const key = p.city || 'Other'
    if (!byArea[key]) byArea[key] = []
    byArea[key].push(p)
  })

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Areas we cover" subtitle="Browse properties by neighbourhood and find out about each area." page="areas" brand={brand} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {areas.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-14">
            {areas.map(area => {
              const areaProps = byArea[area] || Object.entries(byArea).find(([k]) => k.toLowerCase().includes(area.toLowerCase()))?.[1] || []
              return (
                <button key={area}
                  onClick={() => { window.location.href = `/site/${slug}?search=${encodeURIComponent(area)}` }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:shadow-md hover:border-indigo-200 transition-all group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-3 group-hover:scale-110 transition-transform" style={bb(brand)}>
                    {area[0]}
                  </div>
                  <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{area}</p>
                  {areaProps.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{areaProps.length} propert{areaProps.length!==1?'ies':'y'}</p>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📍</p>
            <p className="text-gray-500">Area information coming soon.</p>
          </div>
        )}

        {/* Properties by area */}
        {Object.keys(byArea).length > 0 && (
          <div className="space-y-10">
            <h2 className="text-2xl font-bold text-gray-900">Properties by area</h2>
            {Object.entries(byArea).map(([city, cityProps]) => (
              <section key={city}>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-base font-bold text-gray-900">{city}</h3>
                  <div className="flex-1 h-px bg-gray-200"/>
                  <span className="text-xs text-gray-400">{cityProps.length} propert{cityProps.length!==1?'ies':'y'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cityProps.slice(0,6).map(p => {
                    const minR = Math.min(...p.units.map(u => u.monthly_rent))
                    return (
                      <a key={p.id} href={`/site/${slug}`}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all flex items-start gap-3 group">
                        {p.photo_url
                          ? <img src={`${API_BASE}${p.photo_url}`} alt={p.name} className="w-16 h-16 rounded-lg object-cover shrink-0"/>
                          : <div className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl bg-gray-100 shrink-0">🏠</div>
                        }
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-indigo-600 transition-colors">{p.name}</p>
                          <p className="text-xs text-gray-500 truncate">{p.address_line1}</p>
                          <p className="text-sm font-bold mt-1" style={bt(brand)}>£{minR.toLocaleString('en-GB')}/mo</p>
                        </div>
                      </a>
                    )
                  })}
                </div>
                {cityProps.length > 6 && (
                  <a href={`/site/${slug}?search=${encodeURIComponent(city)}`}
                    className="mt-3 inline-block text-sm font-semibold hover:underline" style={bt(brand)}>
                    View all {cityProps.length} in {city} →
                  </a>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
