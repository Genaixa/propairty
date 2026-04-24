/**
 * Shared layout wrapper for all public agency pages.
 * Provides: nav (logo + links) and footer.
 * Usage: <PublicLayout slug={slug} org={org} brand={brand} />
 */
import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'
export const bb = c => ({ backgroundColor: c || D })
export const bt = c => ({ color: c || D })

export function photoSrc(url) {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

export function useOrgData(slug) {
  const [org, setOrg] = useState(null)
  const [notFound, setNotFound] = useState(false)
  useEffect(() => {
    axios.get(`${API_BASE}/api/public/${slug}`)
      .then(r => setOrg(r.data))
      .catch(() => setNotFound(true))
  }, [slug])
  return { org, notFound }
}

// Curated Pexels backgrounds per page type
export const PAGE_HEROES = {
  about:           'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1600',
  contact:         'https://images.pexels.com/photos/936722/pexels-photo-936722.jpeg?auto=compress&cs=tinysrgb&w=1600',
  landlords:       'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?auto=compress&cs=tinysrgb&w=1600',
  areas:           'https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg?auto=compress&cs=tinysrgb&w=1600',
  tenant_advice:   'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1600',
  landlord_advice: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1600',
  reviews:         'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=1600',
  blog:            'https://images.pexels.com/photos/261579/pexels-photo-261579.jpeg?auto=compress&cs=tinysrgb&w=1600',
  valuation:       'https://images.pexels.com/photos/280229/pexels-photo-280229.jpeg?auto=compress&cs=tinysrgb&w=1600',
  default:         'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1600',
}

export function PageHero({ title, subtitle, page = 'default', brand, children }) {
  const bg = PAGE_HEROES[page] || PAGE_HEROES.default
  return (
    <div className="relative overflow-hidden" style={{ minHeight: 260 }}>
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 px-4 sm:px-6 text-white" style={{ minHeight: 260 }}>
        <h1 className="text-3xl sm:text-5xl font-extrabold mb-3 drop-shadow-lg tracking-tight">{title}</h1>
        {subtitle && <p className="text-white/85 text-base sm:text-lg max-w-xl drop-shadow">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

const NAV_LINKS = [
  { href: '', label: 'Properties' },
  { href: '/about', label: 'About us' },
  { href: '/landlords', label: 'Landlords' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

function usePublicSession(slug) {
  const [session, setSession] = useState(null)
  useEffect(() => {
    if (!slug) return
    try {
      const stored = JSON.parse(localStorage.getItem(`propairty_public_${slug}`) || 'null')
      if (stored?.access_token) setSession(stored)
    } catch {}
  }, [slug])
  return session
}

export default function PublicLayout({ slug, org, brand, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const session = usePublicSession(slug)
  const b = brand || org?.brand_color || D
  const logoUrl = org?.logo_url ? photoSrc(org.logo_url) : null
  const currentPath = window.location.pathname

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* NAV */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <a href={`/site/${slug}`} className="flex items-center gap-3 group shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt={org?.name} className="h-9 w-auto max-w-[120px] object-contain group-hover:opacity-80 transition-opacity" />
              : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={bb(b)}>{org?.name?.[0] || 'P'}</div>
            }
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">{org?.name || '…'}</p>
              <p className="text-xs text-gray-400">{org?.tagline || 'Letting Agent'}</p>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const target = `/site/${slug}${href}`
              const active = currentPath === target || (href && currentPath.startsWith(target))
              return (
                <a key={label} href={target}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                  style={active ? bb(b) : {}}>
                  {label}
                </a>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {org?.phone && (
              <a href={`tel:${org.phone}`} className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {org.phone}
              </a>
            )}
            {session
              ? <a href={`/site/${slug}/account`} className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  {session.full_name?.split(' ')[0] || 'My account'}
                </a>
              : <a href={`/site/${slug}/login`} className="hidden md:inline-flex text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Sign in</a>
            }
            <a href={`/site/${slug}/contact`}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
              style={bb(b)}>
              Contact us
            </a>
            {/* Mobile menu button */}
            <button className="md:hidden p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => setMenuOpen(v => !v)}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-2 space-y-1">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={label} href={`/site/${slug}${href}`}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <div className="border-t border-gray-100 pt-1 mt-1">
              {session
                ? <a href={`/site/${slug}/account`} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                    {session.full_name?.split(' ')[0] || 'My account'}
                  </a>
                : <a href={`/site/${slug}/login`} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Sign in</a>
              }
            </div>
          </div>
        )}
      </header>

      {/* PAGE CONTENT */}
      <main className="flex-1">{children}</main>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              {logoUrl && <img src={logoUrl} alt={org?.name} className="h-8 w-auto mb-3 opacity-80" />}
              <p className="text-sm font-semibold text-white">{org?.name}</p>
              {org?.tagline && <p className="text-xs text-gray-500 mt-1">{org.tagline}</p>}
              {org?.address_text && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{org.address_text}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">Quick links</p>
              <div className="space-y-2">
                {NAV_LINKS.map(({ href, label }) => (
                  <a key={label} href={`/site/${slug}${href}`} className="block text-xs hover:text-white transition-colors">{label}</a>
                ))}
                <a href={`/site/${slug}/valuation`} className="block text-xs hover:text-white transition-colors">Free valuation</a>
                <a href={`/site/${slug}/tenant-advice`} className="block text-xs hover:text-white transition-colors">Tenant advice</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">Client portals</p>
              <div className="space-y-2 mb-6">
                <a href={`/site/${slug}/login`} className="block text-xs hover:text-white transition-colors">Tenant login</a>
                <a href={`/site/${slug}/login`} className="block text-xs hover:text-white transition-colors">Landlord login</a>
              </div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">Get in touch</p>
              <div className="space-y-2 text-xs">
                {org?.email && <a href={`mailto:${org.email}`} className="block hover:text-white">{org.email}</a>}
                {org?.phone && <a href={`tel:${org.phone}`} className="block hover:text-white">{org.phone}</a>}
                {org?.website_url && <a href={org.website_url} target="_blank" rel="noopener noreferrer" className="block hover:text-white">{org.website_url.replace(/^https?:\/\//,'')}</a>}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>&copy; {new Date().getFullYear()} {org?.name}. All rights reserved.</p>
            <div className="flex gap-4">
              <a href={`/site/${slug}/terms`} className="hover:text-white">Terms</a>
              <a href={`/site/${slug}/privacy`} className="hover:text-white">Privacy</a>
              <a href={`/site/${slug}/sitemap`} className="hover:text-white">Sitemap</a>
              <span>Powered by <a href="https://propairty.co.uk" className="text-indigo-400 hover:text-indigo-300 font-medium">PropAIrty</a></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
