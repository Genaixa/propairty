import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, photoSrc, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

const CAT_COLORS = {
  market: 'bg-blue-100 text-blue-700',
  tips: 'bg-green-100 text-green-700',
  area: 'bg-purple-100 text-purple-700',
  landlord: 'bg-amber-100 text-amber-700',
  tenant: 'bg-rose-100 text-rose-700',
}

export default function PublicBlog() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const [posts, setPosts] = useState([])
  const [catFilter, setCatFilter] = useState('all')
  const brand = org?.brand_color || D

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}/blog`).then(r => setPosts(r.data)).catch(() => {})
  }, [slug])

  const cats = ['all', ...new Set(posts.map(p => p.category).filter(Boolean))]
  const filtered = catFilter === 'all' ? posts : posts.filter(p => p.category === catFilter)

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="News & Advice" subtitle={`Market insights, tenant tips and landlord guides from ${org?.name || 'our team'}.`} page="blog" brand={brand} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors capitalize ${catFilter===c ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={catFilter===c ? bb(brand) : {}}>
              {c === 'all' ? 'All posts' : c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-gray-500">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(p => (
              <a key={p.id} href={`/site/${slug}/blog/${p.slug}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group flex flex-col">
                {p.cover_url
                  ? <div className="h-44 overflow-hidden shrink-0">
                      <img src={photoSrc(p.cover_url)} alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                    </div>
                  : <div className="h-44 bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-5xl shrink-0">📰</div>
                }
                <div className="p-5 flex flex-col flex-1">
                  {p.category && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-3 capitalize ${CAT_COLORS[p.category] || 'bg-gray-100 text-gray-600'}`}>
                      {p.category}
                    </span>
                  )}
                  <h2 className="font-bold text-gray-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">{p.title}</h2>
                  {p.excerpt && <p className="text-sm text-gray-500 leading-relaxed flex-1 line-clamp-3">{p.excerpt}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    {p.published_at && (
                      <p className="text-xs text-gray-400">
                        {new Date(p.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    )}
                    <span className="text-xs font-semibold" style={bt(brand)}>Read more →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
