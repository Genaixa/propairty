import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, photoSrc, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

export default function PublicAbout() {
  const { slug } = useParams()
  const [about, setAbout] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}/about`).then(r => setAbout(r.data)).catch(() => {})
  }, [slug])

  const brand = about?.brand_color || D

  if (!about) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/>
    </div>
  )

  const team = about.team || []
  const hours = about.opening_hours || []
  const areas = about.areas || []

  return (
    <PublicLayout slug={slug} org={about} brand={brand}>
      <PageHero title={`About ${about.name}`} subtitle={about.tagline} page="about" brand={brand} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-14">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Est.', value: about.founded_year || '—' },
            { label: 'Properties managed', value: about.properties_count > 0 ? `${about.properties_count}` : '—' },
            { label: 'Areas covered', value: areas.length || '—' },
            { label: 'Team members', value: team.length || '—' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm">
              <p className="text-3xl font-extrabold mb-1" style={bt(brand)}>{s.value}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* About text */}
        {about.about_text && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-5">Our story</h2>
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
              {about.about_text}
            </div>
          </section>
        )}

        {/* Team */}
        {team.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Meet the team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {team.map((member, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
                  {member.photo_url
                    ? <img src={photoSrc(member.photo_url)} alt={member.name}
                        className="w-16 h-16 rounded-full object-cover shrink-0" />
                    : <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0" style={bb(brand)}>
                        {member.name?.[0]}
                      </div>
                  }
                  <div>
                    <p className="font-bold text-gray-900">{member.name}</p>
                    <p className="text-sm font-medium mb-2" style={bt(brand)}>{member.role}</p>
                    {member.bio && <p className="text-xs text-gray-500 leading-relaxed">{member.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Areas & Opening hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {areas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Areas we cover</h2>
              <div className="flex flex-wrap gap-2">
                {areas.map(a => (
                  <span key={a} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">{a}</span>
                ))}
              </div>
            </section>
          )}

          {hours.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Opening hours</h2>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
                {hours.map((h, i) => (
                  <div key={i} className="flex justify-between px-4 py-3 text-sm">
                    <span className="font-medium text-gray-700">{h.day}</span>
                    <span className="text-gray-500">{h.hours}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* CTA */}
        <section className="rounded-2xl text-white text-center py-12 px-6" style={bb(brand)}>
          <h2 className="text-2xl font-bold mb-2">Ready to find your next home?</h2>
          <p className="text-white/80 mb-6">Browse our latest available properties.</p>
          <a href={`/site/${slug}`} className="bg-white font-semibold px-8 py-3 rounded-xl text-sm inline-block hover:bg-opacity-90 transition-colors shadow-sm" style={bt(brand)}>
            View properties
          </a>
        </section>
      </div>
    </PublicLayout>
  )
}
