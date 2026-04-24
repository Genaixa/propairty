import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, photoSrc, useOrgData } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

export default function PublicBlogPost() {
  const { slug, postSlug } = useParams()
  const { org } = useOrgData(slug)
  const [post, setPost] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const brand = org?.brand_color || D

  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}/blog/${postSlug}`)
      .then(r => setPost(r.data))
      .catch(() => setNotFound(true))
  }, [slug, postSlug])

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-5xl mb-4">📄</p>
        <h1 className="text-xl font-bold text-gray-800">Post not found</h1>
        <a href={`/site/${slug}/blog`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">← Back to blog</a>
      </div>
    </div>
  )

  if (!post) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"/>
    </div>
  )

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      {/* Cover image */}
      {post.cover_url && (
        <div className="h-64 sm:h-80 overflow-hidden">
          <img src={photoSrc(post.cover_url)} alt={post.title} className="w-full h-full object-cover object-center"/>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <a href={`/site/${slug}`} className="hover:text-gray-600">Home</a>
          <span>/</span>
          <a href={`/site/${slug}/blog`} className="hover:text-gray-600">Blog</a>
          <span>/</span>
          <span className="text-gray-600 truncate">{post.title}</span>
        </nav>

        {post.category && (
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 mb-4 capitalize">
            {post.category}
          </span>
        )}

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">{post.title}</h1>

        {post.published_at && (
          <p className="text-sm text-gray-400 mb-8">
            Published {new Date(post.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
          </p>
        )}

        {post.excerpt && (
          <p className="text-lg text-gray-600 leading-relaxed mb-8 font-medium border-l-4 pl-5" style={{borderColor: brand}}>
            {post.excerpt}
          </p>
        )}

        {/* Body — rendered as HTML */}
        {post.body && (
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: post.body }} />
        )}

        <div className="mt-12 pt-8 border-t border-gray-200 flex items-center justify-between flex-wrap gap-4">
          <a href={`/site/${slug}/blog`} className="text-sm font-semibold hover:underline" style={bt(brand)}>
            ← Back to all posts
          </a>
          <a href={`/site/${slug}/contact`}
            className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            style={bb(brand)}>
            Contact us
          </a>
        </div>
      </div>
    </PublicLayout>
  )
}
