import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

function apiGet(p)      { return axios.get(`${API_BASE}/api/public${p}`) }
function apiPost(p, d)  { return axios.post(`${API_BASE}/api/public${p}`, d) }
function photoSrc(url)  { return !url ? null : url.startsWith('http') ? url : `${API_BASE}${url}` }
function fmtRent(n)     { return `£${Number(n).toLocaleString('en-GB')}` }
function fmtWeekly(n)   { return `£${Math.round(Number(n) * 12 / 52).toLocaleString('en-GB')} pw` }

const PAGE_SIZE = 24

// ── Amenity/room lookup tables (mirrors UnitDetail.jsx) ──────────────────
const AMENITY_ICONS = {
  wifi:'📶', parking:'🚗', washing_machine:'🫧', tumble_dryer:'♻️',
  dishwasher:'🍽️', tv:'📺', central_heating:'🌡️', air_conditioning:'❄️',
  garden:'🌿', balcony:'🏙️', storage:'📦', fireplace:'🔥',
  full_kitchen:'🍳', microwave:'📻', oven:'🔲', hob:'🟠', fridge_freezer:'🧊', kettle_toaster:'☕',
  shower:'🚿', bath:'🛁', ensuite:'🚪', electric_shower:'⚡',
  lift:'🛗', concierge:'🏨', intercom:'📞', bike_storage:'🚲', communal_garden:'🌳', ev_charging:'🔌',
  gas_incl:'💨', electric_incl:'💡', water_incl:'💧', broadband_incl:'🌐', council_tax_incl:'📋',
  furnished:'🛋️', part_furnished:'🪑', unfurnished:'🏚️', beds_incl:'🛏️', desk:'🖥️',
}
const AMENITY_LABELS = {
  wifi:'WiFi', parking:'Parking', washing_machine:'Washing machine', tumble_dryer:'Tumble dryer',
  dishwasher:'Dishwasher', tv:'TV', central_heating:'Central heating', air_conditioning:'Air conditioning',
  garden:'Garden / outdoor space', balcony:'Balcony', storage:'Storage', fireplace:'Fireplace',
  full_kitchen:'Fully equipped kitchen', microwave:'Microwave', oven:'Oven', hob:'Hob',
  fridge_freezer:'Fridge / freezer', kettle_toaster:'Kettle & toaster',
  shower:'Shower', bath:'Bath', ensuite:'En-suite', electric_shower:'Electric shower',
  lift:'Lift / elevator', concierge:'Porter / concierge', intercom:'Intercom',
  bike_storage:'Bike storage', communal_garden:'Communal garden', ev_charging:'EV charging',
  gas_incl:'Gas included', electric_incl:'Electricity included', water_incl:'Water included',
  broadband_incl:'Broadband included', council_tax_incl:'Council tax included',
  furnished:'Furnished', part_furnished:'Part furnished', unfurnished:'Unfurnished',
  beds_incl:'Bed(s) included', desk:'Desk / workspace',
}
const ROOM_ICON_MAP = {
  master_bedroom:'🛏️', bedroom:'🛏️', living_room:'🛋️', kitchen:'🍳', kitchen_diner:'🍽️',
  dining_room:'🪑', bathroom:'🛁', ensuite:'🚿', wc:'🚽', study:'🖥️',
  utility:'🫧', hallway:'🚪', storage:'📦', conservatory:'🌿', garage:'🚗',
  garden:'🌳', balcony:'🏙️', other:'🔲',
}

const HERO_BG = 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1600'

// ── Geocoding (postcodes.io) ──────────────────────────────────────────────
const _geo = {}
async function geocode(postcode) {
  const k = postcode.replace(/\s+/g, '').toUpperCase()
  if (_geo[k] !== undefined) return _geo[k]
  try {
    const r = await axios.get(`https://api.postcodes.io/postcodes/${encodeURIComponent(k)}`, { timeout: 5000 })
    if (r.data.status === 200) {
      const { latitude: lat, longitude: lng } = r.data.result
      return (_geo[k] = [lat, lng])
    }
  } catch {}
  return (_geo[k] = null)
}

// Haversine distance in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── UK regions ────────────────────────────────────────────────────────────
const UK_REGIONS = {
  London:           ['London'],
  'North East':     ['Newcastle','Gateshead','Sunderland','Middlesbrough','Durham'],
  'North West':     ['Manchester','Liverpool','Preston','Blackpool','Chester','Salford'],
  Yorkshire:        ['Leeds','Sheffield','Bradford','York','Hull','Halifax'],
  Midlands:         ['Birmingham','Nottingham','Leicester','Coventry','Derby','Wolverhampton'],
  'East of England':['Cambridge','Norwich','Ipswich','Peterborough','Chelmsford'],
  'South East':     ['Brighton','Oxford','Reading','Southampton','Portsmouth','Canterbury','Maidstone'],
  'South West':     ['Bristol','Bath','Exeter','Plymouth','Swindon','Gloucester'],
  Scotland:         ['Edinburgh','Glasgow','Aberdeen','Dundee','Inverness'],
  Wales:            ['Cardiff','Swansea','Newport','Wrexham'],
}
const REGION_ORDER = [...Object.keys(UK_REGIONS), 'Other']
function getRegion(city) {
  for (const [r, cs] of Object.entries(UK_REGIONS))
    if (cs.some(c => city?.toLowerCase().includes(c.toLowerCase()))) return r
  return 'Other'
}

// Nearby towns by region (for "discover" links)
const NEARBY = {
  'North East': ['Newcastle','Sunderland','Durham','Middlesbrough','Gateshead'],
  'North West': ['Manchester','Liverpool','Salford','Chester','Preston'],
  Yorkshire:    ['Leeds','Sheffield','York','Bradford','Hull'],
  Midlands:     ['Birmingham','Nottingham','Leicester','Coventry','Derby'],
  'South East': ['Brighton','Oxford','Southampton','Reading','Portsmouth'],
  'South West': ['Bristol','Bath','Exeter','Plymouth','Swindon'],
  Scotland:     ['Edinburgh','Glasgow','Aberdeen','Dundee'],
  London:       ['London'],
  Wales:        ['Cardiff','Swansea','Newport'],
}

// ── Shortlist ─────────────────────────────────────────────────────────────
function loadShortlist() {
  try { return new Set(JSON.parse(localStorage.getItem('propairty_shortlist') || '[]')) }
  catch { return new Set() }
}
function saveShortlist(s) { localStorage.setItem('propairty_shortlist', JSON.stringify([...s])) }

// ── Public user auth ──────────────────────────────────────────────────────
function pubStorageKey(slug) { return `propairty_public_${slug}` }
function getPubToken(slug) {
  try { return JSON.parse(localStorage.getItem(pubStorageKey(slug)) || 'null')?.access_token } catch { return null }
}
function apiGetAuth(p, token) { return axios.get(`${API_BASE}/api/public${p}`, { headers: { Authorization: `Bearer ${token}` } }) }
function apiPostAuth(p, d, token) { return axios.post(`${API_BASE}/api/public${p}`, d, { headers: { Authorization: `Bearer ${token}` } }) }
function apiDelAuth(p, token) { return axios.delete(`${API_BASE}/api/public${p}`, { headers: { Authorization: `Bearer ${token}` } }) }

// ── Brand helpers ─────────────────────────────────────────────────────────
const D = '#4f46e5'
const bb = c => ({ backgroundColor: c || D })
const bt = c => ({ color: c || D })
const bg = c => { const x = c || D; return { background: `linear-gradient(135deg,${x}ee,${x}99)` } }

function useBrand(color) {
  useEffect(() => {
    document.documentElement.style.setProperty('--brand', color || D)
    return () => document.documentElement.style.removeProperty('--brand')
  }, [color])
}

function useSeo(title, desc, img, url) {
  useEffect(() => {
    if (title) document.title = title
    const set = (n, v, prop) => {
      const sel = prop ? `meta[property="${n}"]` : `meta[name="${n}"]`
      let el = document.head.querySelector(sel)
      if (!el) { el = document.createElement('meta'); el.setAttribute(prop ? 'property' : 'name', n); document.head.appendChild(el) }
      el.setAttribute('content', v)
    }
    if (desc) { set('description', desc); set('og:description', desc, true) }
    if (title) { set('og:title', title, true) }
    if (img)   { set('og:image', img, true); set('twitter:card', 'summary_large_image') }
    set('og:type', 'website', true)
    const u = url || window.location.href
    set('og:url', u, true)
  }, [title, desc, img, url])
}

// ── Icons ─────────────────────────────────────────────────────────────────
const I = {
  Bed:    () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Bath:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 12a2 2 0 01-2-2V7a2 2 0 012-2h3m13 7a2 2 0 002-2V7a2 2 0 00-2-2h-3M4 12v5a2 2 0 002 2h12a2 2 0 002-2v-5" /></svg>,
  Sofa:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 10a2 2 0 00-2 2v5a2 2 0 002 2h18a2 2 0 002-2v-5a2 2 0 00-2-2M3 10V8a2 2 0 012-2h14a2 2 0 012 2v2" /></svg>,
  Pin:    () => <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Heart:  ({f}) => <svg className="w-5 h-5" fill={f?'currentColor':'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  User:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Share:  () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
  Chev:   ({d}) => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={d==='l'?'M15 19l-7-7 7-7':'M9 5l7 7-7 7'} /></svg>,
  Grid:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  List:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Map:    () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  Bell:   () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Phone:  () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  X:      () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
}

// ── Badges ────────────────────────────────────────────────────────────────
function unitBadges(unit, propType) {
  const badges = []
  const daysSinceListed = unit.date_listed
    ? Math.floor((Date.now() - new Date(unit.date_listed)) / 86400000)
    : null
  if (unit.previous_rent && unit.previous_rent > unit.monthly_rent)
    badges.push({ label: 'Reduced', color: 'bg-green-100 text-green-700' })
  if (daysSinceListed !== null && daysSinceListed <= 7)
    badges.push({ label: 'New', color: 'bg-blue-100 text-blue-700' })
  if (propType === 'HMO')
    badges.push({ label: 'House share', color: 'bg-amber-100 text-amber-700' })
  if (unit.occupancy_type === 'students')
    badges.push({ label: 'Student friendly', color: 'bg-purple-100 text-purple-700' })
  return badges
}


// ── Error boundary (catches Leaflet/render crashes in modal) ─────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, info) { console.error('PropertyModal crash:', e, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <p className="text-4xl mb-4">⚠️</p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-5">Unable to display this property. Please try again.</p>
            <button onClick={() => { this.setState({ error: null }); this.props.onClose?.() }}
              className="w-full text-white font-semibold py-3 rounded-xl text-sm" style={{ backgroundColor: '#4f46e5' }}>
              Close
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ════════════════════════════════════════════════════════════════════════════
export default function PublicSite({ slug }) {
  const [org, setOrg]           = useState(null)
  const [props, setProps]       = useState([])
  const [notFound, setNotFound] = useState(false)
  const [selected, setSelected] = useState(null)
  const [page, setPage]         = useState(1)

  // Shortlist
  const [shortlist, setShortlist]               = useState(loadShortlist)
  const [showShortlistOnly, setShowShortlistOnly] = useState(false)

  // View
  const [viewMode, setViewMode] = useState('list') // grid | list | map

  // Filters
  const [regionFilter, setRegionFilter] = useState('All')
  const [bedsFilter, setBedsFilter]     = useState('Any')
  const [typeFilter, setTypeFilter]     = useState('Any')
  const [minRent, setMinRent]           = useState('')
  const [maxRent, setMaxRent]           = useState('')
  const [sortBy, setSortBy]             = useState('default')
  const [searchText, setSearchText]     = useState('')

  // Radius search
  const [radiusCenter, setRadiusCenter] = useState('')   // postcode or city
  const [radiusMiles, setRadiusMiles]   = useState('5')
  const [radiusActive, setRadiusActive] = useState(false)
  const [radiusCoords, setRadiusCoords] = useState(null) // [lat, lng]
  const [radiusLoading, setRadiusLoading] = useState(false)
  const [radiusError, setRadiusError]   = useState('')

  // Map geocodes: postcode → [lat, lng]
  const [geoMap, setGeoMap] = useState({})

  // Badge filter
  const [badgeFilter, setBadgeFilter] = useState(new Set())


  // Save search modal
  const [showSaveSearch, setShowSaveSearch]   = useState(false)
  const [saveEmail, setSaveEmail]             = useState('')
  const [saveLabel, setSaveLabel]             = useState('')
  const [saveSending, setSaveSending]         = useState(false)
  const [saveDone, setSaveDone]               = useState(false)
  const [saveError, setSaveError]             = useState('')

  // Testimonials + mobile CTA scroll
  const [reviews, setReviews]                 = useState([])
  const [showMobileCta, setShowMobileCta]     = useState(false)

  // Public user account
  const [pubUser, setPubUser]                 = useState(null)
  const [showAuthModal, setShowAuthModal]     = useState(false)
  const [authTab, setAuthTab]                 = useState('login')
  const [pendingSaveId, setPendingSaveId]     = useState(null)
  const [showViewingModal, setShowViewingModal] = useState(false)
  const [showApplyModal, setShowApplyModal]   = useState(false)
  const [actionProperty, setActionProperty]   = useState(null)

  const brand = org?.brand_color || D
  useBrand(brand)

  const seoTitle = selected
    ? `${selected.name} — ${org?.name}`
    : org ? `${org.name} — Properties to Rent` : 'Properties to Rent'
  const seoDesc = selected
    ? `${selected.units?.length === 1 ? `${selected.units[0].bedrooms || 'Studio'} bed` : `${selected.units?.length} units`} in ${selected.city}${selected.units?.length ? ` from £${Math.min(...selected.units.map(u => u.monthly_rent)).toLocaleString('en-GB')}/mo` : ''}. Book a viewing with ${org?.name}.`
    : org?.tagline || `Find your perfect home with ${org?.name}.`
  const seoImg = selected?.photo_url
    ? photoSrc(selected.photo_url)
    : props[0]?.photo_url ? photoSrc(props[0].photo_url) : null
  const seoUrl = selected
    ? `${window.location.origin}${window.location.pathname}?property=${selected.id}`
    : window.location.href

  useSeo(seoTitle, seoDesc, seoImg, seoUrl)

  useEffect(() => {
    apiGet(`/${slug}`).then(r => setOrg(r.data)).catch(() => setNotFound(true))
    apiGet(`/${slug}/reviews`).then(r => setReviews((r.data?.reviews || []).filter(rv => rv.rating >= 4).slice(0, 3))).catch(() => {})
    const onScroll = () => setShowMobileCta(window.scrollY > 450)
    window.addEventListener('scroll', onScroll, { passive: true })
    apiGet(`/${slug}/properties`).then(r => {
      setProps(r.data)
      // Auto-open property from ?property=ID URL param
      const pid = parseInt(new URLSearchParams(window.location.search).get('property'))
      if (pid) {
        const match = r.data.find(p => p.id === pid)
        if (match) setSelected(match)
      }
    }).catch(() => {})
  }, [slug])

  // Load public user from stored token
  useEffect(() => {
    const token = getPubToken(slug)
    if (!token) return
    apiGetAuth(`/${slug}/account/me`, token).then(r => {
      setPubUser(r.data)
      if (r.data.saved_property_ids?.length) {
        setShortlist(prev => {
          const n = new Set(prev)
          r.data.saved_property_ids.forEach(id => n.add(id))
          saveShortlist(n)
          return n
        })
      }
    }).catch(() => { localStorage.removeItem(pubStorageKey(slug)) })
  }, [slug])

  // Geocode when map view active
  useEffect(() => {
    if (viewMode !== 'map') return
    props.forEach(async p => {
      if (!p.postcode || geoMap[p.postcode] !== undefined) return
      const c = await geocode(p.postcode)
      if (c) setGeoMap(prev => ({ ...prev, [p.postcode]: c }))
    })
  }, [viewMode, props])

  const toggleShortlist = useCallback((id, e) => {
    e?.stopPropagation()
    const token = getPubToken(slug)
    if (!token) {
      setPendingSaveId(id)
      setAuthTab('register')
      setShowAuthModal(true)
      return
    }
    setShortlist(prev => {
      const n = new Set(prev)
      const wasSaved = n.has(id)
      wasSaved ? n.delete(id) : n.add(id)
      saveShortlist(n)
      if (wasSaved) {
        apiDelAuth(`/${slug}/account/saved/${id}`, token).catch(() => {})
      } else {
        apiPostAuth(`/${slug}/account/saved/${id}`, {}, token).catch(() => {})
      }
      return n
    })
  }, [slug])

  async function activateRadius() {
    if (!radiusCenter.trim()) return
    setRadiusLoading(true)
    setRadiusError('')
    const c = await geocode(radiusCenter.trim())
    setRadiusLoading(false)
    if (!c) { setRadiusError(`Couldn't locate "${radiusCenter}" — try a full UK postcode.`); return }
    // Also geocode all property postcodes for distance filtering
    props.forEach(async p => {
      if (p.postcode && _geo[p.postcode.replace(/\s+/g,'').toUpperCase()] === undefined)
        await geocode(p.postcode)
    })
    setRadiusCoords(c)
    setRadiusActive(true)
    setPage(1)
  }

  function clearRadius() { setRadiusActive(false); setRadiusCoords(null); setRadiusCenter(''); setRadiusError('') }

  // Regions present in results
  const regions = useMemo(() => {
    const seen = new Set(props.map(p => getRegion(p.city)))
    return ['All', ...REGION_ORDER.filter(r => seen.has(r))]
  }, [props])

  const filtered = useMemo(() => {
    let list = props.filter(p => {
      if (showShortlistOnly && !shortlist.has(p.id)) return false
      if (regionFilter !== 'All' && getRegion(p.city) !== regionFilter) return false
      if (typeFilter !== 'Any' && p.property_type?.toLowerCase() !== typeFilter.toLowerCase()) return false
      const cheapest = Math.min(...p.units.map(u => u.monthly_rent))
      if (minRent && cheapest < +minRent) return false
      if (maxRent && cheapest > +maxRent) return false
      if (bedsFilter !== 'Any') {
        const b = parseInt(bedsFilter)
        if (!p.units.some(u => bedsFilter === '4+' ? u.bedrooms >= 4 : u.bedrooms === b)) return false
      }
      if (searchText) {
        const q = searchText.toLowerCase()
        if (![p.name, p.city, p.postcode, p.address_line1, p.description].some(s => s?.toLowerCase().includes(q))) return false
      }
      if (radiusActive && radiusCoords) {
        const gc = _geo[p.postcode?.replace(/\s+/g,'').toUpperCase()]
        if (!gc) return false
        if (distanceMiles(radiusCoords[0], radiusCoords[1], gc[0], gc[1]) > +radiusMiles) return false
      }
      if (badgeFilter.size > 0) {
        const daysNew = u => u.date_listed ? Math.floor((Date.now()-new Date(u.date_listed))/86400000) : null
        const passes = p.units.some(u => {
          if (badgeFilter.has('new') && daysNew(u) !== null && daysNew(u) <= 7) return true
          if (badgeFilter.has('reduced') && u.previous_rent && u.previous_rent > u.monthly_rent) return true
          if (badgeFilter.has('hmo') && p.property_type === 'HMO') return true
          if (badgeFilter.has('students') && u.occupancy_type === 'students') return true
          return false
        })
        if (!passes) return false
      }
      return true
    })

    if (sortBy === 'price_asc')    list = [...list].sort((a,b) => Math.min(...a.units.map(u=>u.monthly_rent)) - Math.min(...b.units.map(u=>u.monthly_rent)))
    if (sortBy === 'price_desc')   list = [...list].sort((a,b) => Math.min(...b.units.map(u=>u.monthly_rent)) - Math.min(...a.units.map(u=>u.monthly_rent)))
    if (sortBy === 'newest')       list = [...list].sort((a,b) => {
      const da = Math.min(...a.units.map(u => u.date_listed ? new Date(u.date_listed) : 0))
      const db_ = Math.min(...b.units.map(u => u.date_listed ? new Date(u.date_listed) : 0))
      return db_ - da
    })
    if (sortBy === 'most_reduced') list = [...list].sort((a,b) => {
      const saving = p => {
        const u = p.units.find(u => u.previous_rent && u.previous_rent > u.monthly_rent)
        return u ? u.previous_rent - u.monthly_rent : 0
      }
      return saving(b) - saving(a)
    })
    return list
  }, [props, regionFilter, typeFilter, minRent, maxRent, bedsFilter, searchText, sortBy, showShortlistOnly, shortlist, radiusActive, radiusCoords, radiusMiles, badgeFilter])

  const useRegionGroups = sortBy === 'default' && !showShortlistOnly && regionFilter === 'All' && viewMode !== 'map' && !radiusActive
  const grouped = useMemo(() => {
    if (!useRegionGroups) return null
    const m = {}
    filtered.forEach(p => { const r = getRegion(p.city); if (!m[r]) m[r] = []; m[r].push(p) })
    return m
  }, [filtered, useRegionGroups])
  const sortedRegions = grouped
    ? Object.keys(grouped).sort((a,b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b))
    : null
  // Always computed from full props so "Search by area" links persist when filters are active
  const allRegions = useMemo(() => {
    const m = {}
    props.forEach(p => { const r = getRegion(p.city); if (!m[r]) m[r] = []; m[r].push(p) })
    return Object.keys(m).sort((a,b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b))
  }, [props])

  // Pagination (not used in region-grouped mode)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(() => {
    if (useRegionGroups) return filtered
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filtered, page, useRegionGroups])

  function clearFilters() {
    setRegionFilter('All'); setBedsFilter('Any'); setTypeFilter('Any')
    setMinRent(''); setMaxRent(''); setSearchText(''); setSortBy('default')
    setShowShortlistOnly(false); clearRadius(); setBadgeFilter(new Set()); setPage(1)
  }

  function toggleBadge(key) {
    setBadgeFilter(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
    setPage(1)
  }

  const hasFilters = regionFilter !== 'All' || bedsFilter !== 'Any' || typeFilter !== 'Any'
    || minRent || maxRent || searchText || showShortlistOnly || radiusActive || badgeFilter.size > 0

  async function submitSaveSearch(e) {
    e.preventDefault()
    setSaveSending(true); setSaveError('')
    const filters = { bedsFilter, typeFilter, minRent, maxRent, regionFilter, searchText }
    try {
      await apiPost(`/${slug}/save-search`, { email: saveEmail, label: saveLabel || buildFilterLabel(), filters })
      setSaveDone(true)
    } catch (ex) {
      setSaveError(ex.response?.data?.detail || 'Failed to save — try again.')
    }
    setSaveSending(false)
  }

  function buildFilterLabel() {
    const parts = []
    if (bedsFilter !== 'Any') parts.push(bedsFilter === '0' ? 'Studio' : `${bedsFilter}-bed`)
    if (typeFilter !== 'Any') parts.push(typeFilter)
    if (regionFilter !== 'All') parts.push(regionFilter)
    if (maxRent) parts.push(`up to £${maxRent}/mo`)
    if (searchText) parts.push(searchText)
    return parts.join(', ') || 'All properties'
  }

  if (notFound) return <NotFoundPage />
  if (!org)     return <LoadingPage />

  const logoUrl = org.logo_url ? photoSrc(org.logo_url) : null
  const cardProps = { onSelect: p => { setSelected(p); setPage(page) }, shortlist, onToggleShortlist: toggleShortlist, brand, viewMode }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <a href={`/site/${slug}`} className="flex items-center gap-3 group shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt={org.name} className="h-10 w-auto max-w-[140px] object-contain group-hover:opacity-80 transition-opacity" />
              : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 group-hover:opacity-90 transition-opacity shadow-sm" style={bb(brand)}>{org.name[0]}</div>
            }
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight group-hover:opacity-80 transition-opacity">{org.name}</h1>
              <p className="text-xs text-gray-400">{org.tagline || 'Letting Agent'}</p>
            </div>
          </a>
          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { href: `/site/${slug}`, label: 'Properties' },
              { href: `/site/${slug}/about`, label: 'About' },
              { href: `/site/${slug}/landlords`, label: 'Landlords' },
              { href: `/site/${slug}/blog`, label: 'Blog' },
            ].map(({href, label}) => (
              <a key={label} href={href} className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowShortlistOnly(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${showShortlistOnly ? 'bg-rose-600 text-white border-rose-600' : 'border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-600'}`}>
              <I.Heart f={showShortlistOnly} />
              <span className="hidden sm:inline">Shortlist</span>
              {shortlist.size > 0 && <span className="font-bold">({shortlist.size})</span>}
            </button>
            <button onClick={() => { setShowSaveSearch(true); setSaveDone(false); setSaveError('') }}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
              <I.Bell />Alert me
            </button>
            {org.phone && (
              <a href={`tel:${org.phone}`} className="hidden md:flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600">
                <I.Phone />{org.phone}
              </a>
            )}
            {pubUser
              ? <a href={`/site/${slug}/account`}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                  {pubUser.full_name?.split(' ')[0] || 'My account'}
                </a>
              : <a href={`/site/${slug}/login`}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  Sign in
                </a>
            }
            <a href={`/site/${slug}/contact`} className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity" style={bb(brand)}>
              Contact
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{height: 400}}>
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0" style={{background: `linear-gradient(135deg, ${brand}e6 0%, ${brand}99 55%, rgba(0,0,0,0.55) 100%)`}} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white text-center px-4 sm:px-6 py-10">
          <p className="text-white/60 text-sm font-medium mb-3 tracking-wide">{org.name}</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-lg"
            style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
            {props.length > 0
              ? `${props.length} propert${props.length !== 1 ? 'ies' : 'y'} to rent`
              : 'Properties to rent'}
          </h2>
          <p className="text-white/75 mb-8 text-sm sm:text-base drop-shadow max-w-lg leading-relaxed">
            {org.tagline || `Browse the full lettings portfolio and book a viewing online.`}
          </p>
          <div className="w-full max-w-xl relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><I.Search /></span>
            <input type="text" placeholder="Search city, postcode or property name…"
              value={searchText} onChange={e => { setSearchText(e.target.value); setPage(1) }}
              className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 text-sm font-medium shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/40" />
          </div>
        </div>
      </div>

      {/* ── HERO STAT STRIP ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 divide-x divide-gray-100 grid grid-cols-3">
          <a href="#properties" className="group flex flex-col items-center justify-center py-4 px-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors" style={props.length > 0 ? {} : {}}>{props.length > 0 ? props.length : '—'}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">properties available</p>
            <p className="text-xs text-indigo-500 font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Browse now →</p>
          </a>
          <a href={`/site/${slug}/contact`} className="group flex flex-col items-center justify-center py-4 px-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors">Online</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">book a viewing</p>
            <p className="text-xs text-indigo-500 font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Book now →</p>
          </a>
          <button onClick={() => { setShowSaveSearch(true); setSaveDone(false) }} className="group flex flex-col items-center justify-center py-4 px-2 hover:bg-gray-50 transition-colors cursor-pointer w-full">
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors">Alerts</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">instant email alerts</p>
            <p className="text-xs text-indigo-500 font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Set up →</p>
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[57px] z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 space-y-2">

          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Region dropdown */}
            <select value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setPage(1) }}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {regions.map(r => <option key={r} value={r}>{r === 'All' ? 'All areas' : r}</option>)}
            </select>

            <select value={bedsFilter} onChange={e => { setBedsFilter(e.target.value); setPage(1) }}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="Any">Any beds</option>
              <option value="0">Studio</option>
              <option value="1">1 bed</option>
              <option value="2">2 beds</option>
              <option value="3">3 beds</option>
              <option value="4+">4+ beds</option>
            </select>

            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="Any">Any type</option>
              <option value="residential">Residential</option>
              <option value="HMO">HMO / Shared</option>
              <option value="commercial">Commercial</option>
            </select>

            <div className="flex items-center gap-1">
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">£</span>
                <input type="number" placeholder="Min" value={minRent} onChange={e => { setMinRent(e.target.value); setPage(1) }}
                  className="text-xs font-medium border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 w-20 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700" /></div>
              <span className="text-gray-300 text-xs">–</span>
              <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">£</span>
                <input type="number" placeholder="Max" value={maxRent} onChange={e => { setMaxRent(e.target.value); setPage(1) }}
                  className="text-xs font-medium border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 w-20 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700" /></div>
            </div>

            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}
              className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="default">Sort: Default</option>
              <option value="newest">Most recent</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="most_reduced">Most reduced</option>
            </select>

            {/* Result count */}
            <span className="text-xs font-medium text-gray-500">
              <span className="font-bold text-gray-800">{filtered.length}</span> propert{filtered.length!==1?'ies':'y'}
            </span>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-medium hover:underline" style={bt(brand)}>
                Clear all
              </button>
            )}

            {/* View toggle */}
            <div className="ml-auto flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {[['grid',<I.Grid/>,'Grid'],['list',<I.List/>,'List'],['map',<I.Map/>,'Map']].map(([m,ic,t]) => (
                <button key={m} onClick={() => setViewMode(m)} title={`${t} view`}
                  className={`p-1.5 transition-colors ${viewMode===m?'text-white':'text-gray-500 hover:bg-gray-50'}`}
                  style={viewMode===m ? bb(brand) : {}}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Badge filters + radius row */}
          <div className="flex flex-wrap gap-2 items-center pb-0.5">
            {[
              { key:'new', label:'New listing', cls:'bg-blue-100 text-blue-700 border-blue-200' },
              { key:'reduced', label:'Price reduced', cls:'bg-green-100 text-green-700 border-green-200' },
              { key:'hmo', label:'House share', cls:'bg-amber-100 text-amber-700 border-amber-200' },
              { key:'students', label:'Student friendly', cls:'bg-purple-100 text-purple-700 border-purple-200' },
            ].map(({ key, label, cls }) => (
              <button key={key} onClick={() => toggleBadge(key)}
                className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${badgeFilter.has(key) ? 'text-white border-transparent' : `${cls} hover:opacity-80`}`}
                style={badgeFilter.has(key) ? bb(brand) : {}}>
                {label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <span className="text-xs text-gray-500 font-medium shrink-0">Within</span>
              <select value={radiusMiles} onChange={e => setRadiusMiles(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {['1','3','5','10','15','20','30'].map(m => <option key={m} value={m}>{m} miles</option>)}
              </select>
              <span className="text-xs text-gray-500 shrink-0">of</span>
              <input type="text" placeholder="Postcode or town…" value={radiusCenter}
                onChange={e => setRadiusCenter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && activateRadius()}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700" />
              {radiusActive ? (
                <button onClick={clearRadius} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                  <I.X />Clear
                </button>
              ) : (
                <button onClick={activateRadius} disabled={radiusLoading || !radiusCenter.trim()}
                  className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  style={bb(brand)}>
                  {radiusLoading ? 'Locating…' : 'Apply'}
                </button>
              )}
              {radiusActive && <span className="text-xs text-green-600 font-medium">✓ {radiusMiles}mi of "{radiusCenter}"</span>}
              {radiusError && <span className="text-xs text-red-500">{radiusError}</span>}
            </div>
          </div>

        </div>
      </div>

      {/* ── RESULTS ─────────────────────────────────────────────── */}
      <main id="properties" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-700">No properties match your search</h2>
            <p className="text-gray-400 mt-2 text-sm">Try adjusting your filters or broadening your search.</p>
            <button onClick={clearFilters} className="mt-5 text-sm font-semibold hover:underline" style={bt(brand)}>Clear all filters</button>
          </div>
        ) : viewMode === 'map' ? (
          <MapView properties={filtered} geoMap={geoMap} setGeoMap={setGeoMap} onSelect={setSelected} shortlist={shortlist} onToggleShortlist={toggleShortlist} brand={brand} />
        ) : useRegionGroups && grouped ? (
          <div className="space-y-10">
            {sortedRegions.map(region => (
              <section key={region}>
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-base font-bold text-gray-900 whitespace-nowrap">{region}</h3>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">{grouped[region].length} propert{grouped[region].length!==1?'ies':'y'}</span>
                </div>
                <PropertyGrid properties={grouped[region]} {...cardProps} />
              </section>
            ))}
          </div>
        ) : (
          <>
            <PropertyGrid properties={paginated} {...cardProps} />
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                  <I.Chev d="l" />
                </button>
                {Array.from({length: totalPages}, (_,i) => i+1).filter(p => p===1||p===totalPages||Math.abs(p-page)<=2).reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx-1] > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, []).map((p, i) =>
                  p === '…' ? <span key={`e${i}`} className="text-gray-400 px-1">…</span> :
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page===p?'text-white':'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={page===p ? bb(brand) : {}}>
                    {p}
                  </button>
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                  <I.Chev d="r" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── BROWSE QUICK LINKS ─────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Browse by type</h3>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['1 bed','1','Any'],['2 beds','2','Any'],['3 beds','3','Any'],['4+ beds','4+','Any'],
              ['Studios','0','Any'],['Houses','Any','residential'],['Shared HMO','Any','HMO'],
            ].map(([label, beds, type]) => {
              const active = (beds !== 'Any' && bedsFilter === beds) || (type !== 'Any' && typeFilter === type)
              return (
                <button key={label}
                  onClick={() => { if (active) { setBedsFilter('Any'); setTypeFilter('Any') } else { if (beds !== 'Any') setBedsFilter(beds); if (type !== 'Any') setTypeFilter(type) } setPage(1) }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white'}`}>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Nearby towns — always from full props, not filtered */}
          {allRegions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Search by area</h3>
              <div className="flex flex-wrap gap-2">
                {allRegions.flatMap(r => (NEARBY[r] || []).slice(0, 3)).slice(0, 12).map(town => {
                  const active = searchText.toLowerCase() === town.toLowerCase()
                  return (
                    <button key={town}
                      onClick={() => { setSearchText(active ? '' : town); setPage(1) }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white'}`}>
                      {town}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── TESTIMONIALS ────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="bg-slate-50 border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-8">What our tenants & landlords say</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, s) => (
                      <svg key={s} className={`w-4 h-4 ${s < r.rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                    ))}
                  </div>
                  {r.body && <p className="text-sm text-gray-600 leading-relaxed mb-3 italic">"{r.body}"</p>}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={bb(brand)}>
                      {r.reviewer_name?.[0]?.toUpperCase() || 'T'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{r.reviewer_name || 'Anonymous'}</p>
                      <p className="text-xs text-gray-400 capitalize">{r.reviewer_type || 'Tenant'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center mt-6">
              <a href={`/site/${slug}/reviews`} className="text-sm font-semibold hover:underline" style={bt(brand)}>Read all reviews →</a>
            </p>
          </div>
        </div>
      )}

      {/* ── TRUST STRIP ─────────────────────────────────────────── */}
      <div className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-6">Professional memberships &amp; accreditations</p>
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4">
            {[
              { abbr: 'TPO',  name: 'The Property Ombudsman',   sub: 'Regulated member' },
              { abbr: 'CMP',  name: 'Client Money Protection',  sub: 'CMP accredited' },
              { abbr: 'TSA',  name: 'Trading Standards',        sub: 'Approved agent' },
              { abbr: 'TDS',  name: 'Tenancy Deposit Scheme',   sub: 'Deposit registered' },
              { abbr: 'ICO',  name: 'ICO Registered',           sub: 'Data protection' },
            ].map(b => (
              <div key={b.abbr} className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 min-w-[180px]">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-300 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-xs font-black text-gray-600 tracking-tight leading-none">{b.abbr}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{b.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="text-white" style={bb(brand)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h2 className="text-2xl font-bold mb-2">Can't find what you're looking for?</h2>
          <p className="text-white/80 mb-6 text-sm max-w-md mx-auto">Save your search and we'll email you when a matching property is listed.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={() => { setShowSaveSearch(true); setSaveDone(false) }}
              className="bg-white font-semibold px-6 py-3 rounded-lg text-sm hover:bg-opacity-90 transition-colors shadow-sm flex items-center gap-2"
              style={bt(brand)}>
              <I.Bell />Save this search
            </button>
            {org.phone && (
              <a href={`tel:${org.phone}`} className="border border-white/30 text-white font-semibold px-6 py-3 rounded-lg text-sm hover:bg-white/10">
                Call {org.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              {logoUrl && <img src={logoUrl} alt={org.name} className="h-8 w-auto mb-3 opacity-80" />}
              <p className="text-sm font-semibold text-white">{org.name}</p>
              {org.tagline && <p className="text-xs text-gray-500 mt-1">{org.tagline}</p>}
              {org.address_text && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{org.address_text}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">Quick links</p>
              <div className="space-y-2 text-xs">
                {[
                  [`/site/${slug}`, 'Properties to rent'],
                  [`/site/${slug}/about`, 'About us'],
                  [`/site/${slug}/landlords`, 'Landlord services'],
                  [`/site/${slug}/valuation`, 'Free valuation'],
                  [`/site/${slug}/tenant-advice`, 'Tenant advice'],
                  [`/site/${slug}/blog`, 'News & Blog'],
                  [`/site/${slug}/reviews`, 'Reviews'],
                ].map(([href, label]) => (
                  <a key={label} href={href} className="block hover:text-white transition-colors">{label}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">Contact</p>
              <div className="space-y-2 text-xs">
                {org.email && <a href={`/site/${slug}/contact`} className="block hover:text-white">{org.email}</a>}
                {org.phone && <a href={`tel:${org.phone}`} className="block hover:text-white">{org.phone}</a>}
                {org.website_url && <a href={org.website_url} target="_blank" rel="noopener noreferrer" className="block hover:text-white">{org.website_url.replace(/^https?:\/\//,'')}</a>}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>&copy; {new Date().getFullYear()} {org.name}. All rights reserved.</p>
            <div className="flex gap-4">
              <a href={`/site/${slug}/terms`} className="hover:text-white">Terms</a>
              <a href={`/site/${slug}/privacy`} className="hover:text-white">Privacy</a>
              <a href={`/site/${slug}/sitemap`} className="hover:text-white">Sitemap</a>
              <span>Powered by <a href="https://propairty.co.uk" className="text-indigo-400 hover:text-indigo-300 font-medium">PropAIrty</a></span>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp float merged into PublicChat pair below */}

      {/* ── STICKY MOBILE CTA ───────────────────────────────────── */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 sm:hidden transition-all duration-300 ${showMobileCta ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <div className="bg-white border-t border-gray-200 shadow-2xl px-4 py-3 flex gap-3">
          <a href={`/site/${slug}/contact`}
            className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50">
            Contact us
          </a>
          <a href={`/site/${slug}/contact`}
            className="flex-1 text-center text-white text-sm font-bold py-2.5 rounded-xl transition-opacity hover:opacity-90"
            style={bb(brand)}>
            Book a viewing
          </a>
        </div>
      </div>

      {/* ── PROPERTY MODAL ──────────────────────────────────────── */}
      {selected && (
        <ErrorBoundary key={selected.id} onClose={() => setSelected(null)}>
          <PropertyModal property={selected} slug={slug} org={org} brand={brand}
            shortlisted={shortlist.has(selected.id)} onToggleShortlist={toggleShortlist}
            onClose={() => setSelected(null)} allProps={props} onSelectSimilar={setSelected}
            onBookViewing={p => { setActionProperty(p); setShowViewingModal(true) }}
            onApply={p => { setActionProperty(p); setShowApplyModal(true) }} />
        </ErrorBoundary>
      )}

      {/* ── SAVE SEARCH MODAL ───────────────────────────────────── */}
      {showSaveSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowSaveSearch(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><I.Bell />Save search alert</h3>
              <button onClick={() => setShowSaveSearch(false)} className="text-gray-400 hover:text-gray-600"><I.X /></button>
            </div>
            {saveDone ? (
              <div className="text-center py-4">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-bold text-gray-900">Alert saved!</p>
                <p className="text-sm text-gray-500 mt-2">We'll email you at <strong>{saveEmail}</strong> when new matching properties are listed.</p>
                <p className="text-xs text-gray-400 mt-2">Check your inbox for a confirmation with current matches.</p>
                <button onClick={() => setShowSaveSearch(false)} className="mt-4 text-sm font-semibold hover:underline" style={bt(brand)}>Done</button>
              </div>
            ) : (
              <form onSubmit={submitSaveSearch} className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-100">
                  <p className="font-semibold text-gray-800 mb-1">Current search filters:</p>
                  <p>{buildFilterLabel()}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alert name (optional)</label>
                  <input value={saveLabel} onChange={e => setSaveLabel(e.target.value)}
                    placeholder={buildFilterLabel()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Your email *</label>
                  <input required type="email" value={saveEmail} onChange={e => setSaveEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                {saveError && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
                <button type="submit" disabled={saveSending}
                  className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60"
                  style={bb(brand)}>
                  {saveSending ? 'Saving…' : 'Save alert — notify me of new listings'}
                </button>
                <p className="text-xs text-center text-gray-400">You can unsubscribe at any time via the link in any alert email.</p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── AI CHAT WIDGET (Wendy / Mendy) ──────────────────────── */}
      <PublicChat slug={slug} org={org} brand={brand} onOpenProperty={p => setSelected(p)} props={props} />

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <AuthModal slug={slug} brand={brand} tab={authTab} onTabChange={setAuthTab}
          onSuccess={user => {
            setPubUser(user)
            setShowAuthModal(false)
            if (pendingSaveId) {
              const token = getPubToken(slug)
              if (token) {
                apiPostAuth(`/${slug}/account/saved/${pendingSaveId}`, {}, token).catch(() => {})
                setShortlist(prev => { const n = new Set(prev); n.add(pendingSaveId); saveShortlist(n); return n })
              }
              setPendingSaveId(null)
            }
          }}
          onClose={() => { setShowAuthModal(false); setPendingSaveId(null) }} />
      )}

      {/* ── BOOK VIEWING MODAL ── */}
      {showViewingModal && actionProperty && (
        <ViewingApplyModal
          slug={slug} brand={brand} property={actionProperty} mode="viewing"
          pubUser={pubUser}
          onClose={() => setShowViewingModal(false)} />
      )}

      {/* ── APPLY MODAL ── */}
      {showApplyModal && actionProperty && (
        <ViewingApplyModal
          slug={slug} brand={brand} property={actionProperty} mode="apply"
          pubUser={pubUser}
          onClose={() => setShowApplyModal(false)} />
      )}
    </div>
  )
}


// ── Public AI Chat Widget ─────────────────────────────────────────────────
function PublicChat({ slug, org, brand, onOpenProperty, props: allProps }) {
  const [open, setOpen]         = useState(false)
  const [msgs, setMsgs]         = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [unread, setUnread]     = useState(false)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)
  const agentName               = 'Wendy'

  // Greeting on first open
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        content: `Hi! I'm ${agentName}, your AI letting agent for ${org?.name || 'this agency'}. 😊\n\nI can help you find a property, answer questions about any listing, or help you book a viewing. What are you looking for?`
      }])
    }
    if (open) { setUnread(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  // Show unread dot after 3s if chat closed and no greeting yet
  useEffect(() => {
    if (!open && msgs.length === 0) {
      const t = setTimeout(() => setUnread(true), 3000)
      return () => clearTimeout(t)
    }
  }, [])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    const next = [...msgs, { role: 'user', content: userMsg }]
    setMsgs(next)
    setLoading(true)
    try {
      const r = await axios.post(`${API_BASE}/api/public/${slug}/chat`, {
        messages: next.map(m => ({ role: m.role, content: m.content }))
      })
      setMsgs(prev => [...prev, { role: 'assistant', content: r.data.reply }])
    } catch (ex) {
      const detail = ex.response?.data?.detail || 'Something went wrong — please try again.'
      setMsgs(prev => [...prev, { role: 'assistant', content: `Sorry, ${detail}` }])
    }
    setLoading(false)
  }

  // Parse assistant messages for property name mentions → show mini-card
  function getMatchingProp(text) {
    if (!allProps?.length) return null
    for (const p of allProps) {
      if (text.toLowerCase().includes(p.name.toLowerCase())) return p
    }
    return null
  }

  const SUGGESTIONS = [
    '2-bed under £1,200/mo',
    'Pet-friendly properties',
    'Furnished studios',
    'How does referencing work?',
    'Book a viewing',
  ]

  return (
    <>
      {/* Floating button pair */}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-center gap-2">
        {/* AI Chat — top */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white font-bold transition-all hover:scale-110 active:scale-95 relative"
            style={bb(brand)}
            aria-label="Chat with our AI agent">
            {open
              ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
            }
            {unread && !open && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"/>
            )}
          </button>
          <span className="text-[10px] font-semibold text-gray-500 bg-white/90 rounded-full px-1.5 py-0.5 shadow-sm">AI Chat</span>
        </div>
        {/* WhatsApp — bottom */}
        {org?.phone && (
          <div className="flex flex-col items-center gap-1">
            <a href={`https://wa.me/${org.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer"
              style={{backgroundColor:'#25D366'}}
              title="WhatsApp us">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
            <span className="text-[10px] font-semibold text-gray-500 bg-white/90 rounded-full px-1.5 py-0.5 shadow-sm">WhatsApp</span>
          </div>
        )}
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 120px)', height: 520 }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={bb(brand)}>
            <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center font-bold text-white text-sm shrink-0">
              {agentName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">{agentName}</p>
              <p className="text-white/75 text-xs">AI letting agent · {org?.name}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-300 shrink-0" title="Online"/>
            <button onClick={() => setOpen(false)} className="ml-1 p-1 rounded-full hover:bg-white/20 transition-colors text-white shrink-0" aria-label="Close chat">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'none' }}>
            {msgs.map((m, i) => {
              const isUser = m.role === 'user'
              const matchProp = !isUser ? getMatchingProp(m.content) : null
              return (
                <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`} style={isUser ? bb(brand) : {}}>
                    {m.content}
                  </div>
                  {matchProp && (
                    <button
                      onClick={() => onOpenProperty(matchProp)}
                      className="mt-1.5 max-w-[85%] bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all text-left flex items-center gap-2 p-2">
                      {matchProp.photo_url
                        ? <img src={photoSrc(matchProp.photo_url)} className="w-12 h-12 rounded-lg object-cover shrink-0" alt=""/>
                        : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">🏠</div>
                      }
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{matchProp.name}</p>
                        <p className="text-xs text-gray-500 truncate">{matchProp.city}</p>
                        <p className="text-xs font-bold" style={bt(brand)}>
                          £{Math.min(...matchProp.units.map(u => u.monthly_rent)).toLocaleString('en-GB')}/mo
                        </p>
                      </div>
                      <span className="text-xs shrink-0 mr-1" style={bt(brand)}>View →</span>
                    </button>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="flex items-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
                  ))}
                </div>
              </div>
            )}
            {/* Suggestion chips (only before first user message) */}
            {msgs.length === 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-gray-100 px-3 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask me anything…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': brand }}
                disabled={loading}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
                style={bb(brand)}>
                <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-300 text-center mt-1.5">AI · may make mistakes · powered by PropAIrty</p>
          </div>
        </div>
      )}
    </>
  )
}


// ── Map view ──────────────────────────────────────────────────────────────
function MapView({ properties, geoMap, setGeoMap, onSelect, shortlist, onToggleShortlist, brand }) {
  useEffect(() => {
    properties.forEach(async p => {
      if (!p.postcode || geoMap[p.postcode] !== undefined) return
      const c = await geocode(p.postcode)
      if (c) setGeoMap(prev => ({ ...prev, [p.postcode]: c }))
    })
  }, [properties])

  const geocoded = properties.filter(p => geoMap[p.postcode])
  const pending  = properties.length - geocoded.length
  const center   = geocoded.length > 0
    ? [geocoded.reduce((s,p)=>s+geoMap[p.postcode][0],0)/geocoded.length, geocoded.reduce((s,p)=>s+geoMap[p.postcode][1],0)/geocoded.length]
    : [54.0,-2.0]

  return (
    <div>
      {pending > 0 && (
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"/>
          Locating {pending} propert{pending!==1?'ies':'y'} on map…
        </p>
      )}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{height:520}}>
        <MapContainer center={center} zoom={6} style={{height:'100%',width:'100%'}}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geocoded.map(p => {
            const [lat,lng] = geoMap[p.postcode]
            const minR = Math.min(...p.units.map(u=>u.monthly_rent))
            return (
              <Marker key={p.id} position={[lat,lng]}>
                <Popup>
                  <div className="min-w-[160px]">
                    {p.photo_url && <img src={photoSrc(p.photo_url)} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2"/>}
                    <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.city} {p.postcode}</p>
                    <p className="text-sm font-bold mt-1" style={bt(brand)}>{fmtRent(minR)}/mo</p>
                    <button onClick={() => onSelect(p)} className="mt-2 w-full text-xs font-semibold text-white py-1.5 rounded-lg" style={{backgroundColor:brand}}>View details</button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}


// ── Share button ──────────────────────────────────────────────────────────
function ShareButton({ propertyId, propertyName, className = '' }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const url = `${window.location.origin}${window.location.pathname.replace(/\?.*$/, '')}?property=${propertyId}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${propertyName} — ${url}`)}`

  useEffect(() => {
    if (!open) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => { setCopied(false); setOpen(false) }, 1800)
  }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }} className={`flex items-center justify-center ${className}`} title="Share">
        <I.Share />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 w-44">
          <button onClick={copy}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            {copied
              ? <><span className="text-green-500">✓</span> Copied!</>
              : <><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy link</>
            }
          </button>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}


// ── Property grid / list ──────────────────────────────────────────────────
function PropertyGrid({ properties, onSelect, shortlist, onToggleShortlist, brand, viewMode }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {properties.map(p => (
          <PropertyListRow key={p.id} property={p} onSelect={onSelect}
            shortlisted={shortlist.has(p.id)} onToggleShortlist={onToggleShortlist} brand={brand} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {properties.map(p => (
        <PropertyCard key={p.id} property={p} onSelect={onSelect}
          shortlisted={shortlist.has(p.id)} onToggleShortlist={onToggleShortlist} brand={brand} />
      ))}
    </div>
  )
}


// ── List row ──────────────────────────────────────────────────────────────
function PropertyListRow({ property, onSelect, shortlisted, onToggleShortlist, brand }) {
  const [expanded, setExpanded] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const cheapestUnit = property.units.reduce((a,b) => a.monthly_rent < b.monthly_rent ? a : b, property.units[0])
  const minR   = cheapestUnit?.monthly_rent || 0
  const bedCounts = [...new Set(property.units.map(u=>u.bedrooms))].sort((a,b)=>a-b)
  const maxBath= Math.max(...property.units.map(u=>u.bathrooms))
  const maxRec = Math.max(...property.units.map(u=>u.reception_rooms||0))
  const bedLabel = bedCounts.length > 1
    ? `${bedCounts[0]===0?'Studio':bedCounts[0]}–${bedCounts[bedCounts.length-1]} bed`
    : bedCounts[0]===0 ? 'Studio' : `${bedCounts[0]} bed`
  const photos = useMemo(() => {
    const all = (property.photos||[]).map(photoSrc).filter(Boolean)
    if (!all.length && property.photo_url) all.push(photoSrc(property.photo_url))
    return all
  }, [property])
  const photo  = photos[imgIdx] || null
  const badges = unitBadges(cheapestUnit||{}, property.property_type)
  const typeLabel = {residential:'Residential',HMO:'HMO / Shared',commercial:'Commercial'}[property.property_type]||property.property_type

  return (
    <div onClick={() => onSelect(property)}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex overflow-hidden group">
      <div className="relative w-36 sm:w-48 shrink-0 bg-gray-100 overflow-hidden self-stretch" style={{minHeight: 140}}>
        {photo
          ? <img src={photo} alt={property.name} className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"/>
          : <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-200">🏠</div>
        }
        {photos.length > 1 && (<>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>Math.max(0,i-1))}} disabled={imgIdx===0}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-10">
            <I.Chev d="l"/>
          </button>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>Math.min(photos.length-1,i+1))}} disabled={imgIdx===photos.length-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-10">
            <I.Chev d="r"/>
          </button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full z-10">{imgIdx+1}/{photos.length}</span>
        </>)}
        <button onClick={e => onToggleShortlist(property.id,e)}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow transition-colors z-10 ${shortlisted?'bg-rose-500 text-white':'bg-white/90 text-gray-400 hover:text-rose-500'}`}>
          <span className="scale-75"><I.Heart f={shortlisted}/></span>
        </button>
      </div>
      <div className="flex-1 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-2 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-0.5">
            <p className="font-bold text-gray-900 text-sm">{property.name}</p>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{typeLabel}</span>
            {badges.map(b=><span key={b.label} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.color}`}>{b.label}</span>)}
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1"><I.Pin/>{property.address_line1}, {property.city} {property.postcode}</p>
          {property.description && (
            <div className="hidden sm:block mt-1">
              <p className={`text-xs text-gray-400 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {property.description}
              </p>
              {property.description.length > 140 && (
                <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                  className="text-xs font-medium mt-0.5 hover:underline" style={bt(brand)}>
                  {expanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </div>
          )}
          <div className="flex gap-3 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500"><I.Bed/>{bedLabel}</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500"><I.Bath/>{maxBath} bath</span>
            {maxRec>0&&<span className="inline-flex items-center gap-1 text-xs text-gray-500"><I.Sofa/>{maxRec} rec</span>}
            {cheapestUnit?.furnished&&<span className="text-xs text-gray-400">{FURNISHED_LABEL[cheapestUnit.furnished]||cheapestUnit.furnished}</span>}
            {property.units.length>1&&<span className="text-xs font-medium" style={bt(brand)}>{property.units.length} units available</span>}
          </div>
          {cheapestUnit?.available_from && (
            <p className="text-xs text-gray-400 mt-1">
              Available {new Date(cheapestUnit.available_from) <= new Date() ? 'now' : new Date(cheapestUnit.available_from).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
            </p>
          )}
        </div>
        <div className="text-left sm:text-right shrink-0">
          {property.units.length>1&&<p className="text-xs text-gray-400">from</p>}
          <p className="text-lg font-bold" style={bt(brand)}>{fmtRent(minR)}/mo</p>
          <p className="text-xs text-gray-400">{fmtWeekly(minR)}</p>
          {cheapestUnit?.previous_rent&&cheapestUnit.previous_rent>minR&&(
            <p className="text-xs text-gray-400 line-through">{fmtRent(cheapestUnit.previous_rent)}/mo</p>
          )}
          <p className="text-xs font-medium mt-0.5" style={bt(brand)}>View details →</p>
        </div>
      </div>
    </div>
  )
}


// ── Property card ─────────────────────────────────────────────────────────
function PropertyCard({ property, onSelect, shortlisted, onToggleShortlist, brand }) {
  const [imgIdx, setImgIdx] = useState(0)
  const cheapestUnit = property.units.reduce((a,b) => a.monthly_rent < b.monthly_rent ? a : b, property.units[0])
  const minR   = cheapestUnit?.monthly_rent || 0
  const bedCounts = [...new Set(property.units.map(u=>u.bedrooms))].sort((a,b)=>a-b)
  const maxBath= Math.max(...property.units.map(u=>u.bathrooms))
  const maxRec = Math.max(...property.units.map(u=>u.reception_rooms||0))
  const bedLabel = bedCounts.length > 1
    ? `${bedCounts[0]===0?'Studio':bedCounts[0]}–${bedCounts[bedCounts.length-1]} bed`
    : bedCounts[0]===0 ? 'Studio' : `${bedCounts[0]} bed${bedCounts[0]!==1?'s':''}`
  const photos = useMemo(() => {
    const all = (property.photos||[]).map(photoSrc).filter(Boolean)
    if (!all.length && property.photo_url) all.push(photoSrc(property.photo_url))
    return all
  }, [property])
  const photo  = photos[imgIdx] || null
  const badges = unitBadges(cheapestUnit || {}, property.property_type)
  const typeLabel = {residential:'Residential',HMO:'HMO / Shared',commercial:'Commercial'}[property.property_type] || property.property_type

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all duration-200 group flex flex-col">
      <div className="relative h-48 bg-gray-100 overflow-hidden shrink-0 cursor-pointer" onClick={() => onSelect(property)}>
        {photo
          ? <img src={photo} alt={property.name} className="w-full h-full object-cover object-center transition-opacity duration-300"/>
          : <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
        }
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">{typeLabel}</span>
        {photos.length > 1 && (
          <span className="absolute bottom-3 left-3 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            {imgIdx+1}/{photos.length}
          </span>
        )}
        {photos.length > 1 && (<>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>Math.max(0,i-1))}} disabled={imgIdx===0}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0">
            <I.Chev d="l"/>
          </button>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>Math.min(photos.length-1,i+1))}} disabled={imgIdx===photos.length-1}
            className="absolute right-10 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0">
            <I.Chev d="r"/>
          </button>
        </>)}
        {property.units.length > 1 && (
          <span className="absolute top-3 right-12 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm" style={bb(brand)}>{property.units.length} units</span>
        )}
        <button onClick={e => onToggleShortlist(property.id,e)}
          className={`absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors ${shortlisted?'bg-rose-500 text-white':'bg-white/90 text-gray-400 hover:text-rose-500'}`}>
          <I.Heart f={shortlisted}/>
        </button>
        <ShareButton propertyId={property.id} propertyName={property.name} className="absolute bottom-3 right-12 w-8 h-8 rounded-full bg-white/90 shadow-md text-gray-400 hover:text-indigo-600 transition-colors" />
      </div>

      <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => onSelect(property)}>
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex gap-1.5 mb-2">
            {badges.map(b => <span key={b.label} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.color}`}>{b.label}</span>)}
          </div>
        )}

        <p className="font-bold text-gray-900 text-sm leading-snug">{property.name}</p>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          <I.Pin/>{property.address_line1}, {property.city} {property.postcode}
        </p>

        {property.description && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-2 flex-1">{property.description}</p>
        )}

        {/* Spec chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            <I.Bed/>{bedLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            <I.Bath/>{maxBath} bath{maxBath!==1?'s':''}
          </span>
          {maxRec > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              <I.Sofa/>{maxRec} reception{maxRec!==1?'s':''}
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between">
          <div>
            {property.units.length > 1 && <p className="text-xs text-gray-400">from</p>}
            <p className="text-base font-bold" style={bt(brand)}>{fmtRent(minR)}/mo</p>
            <p className="text-xs text-gray-400">{fmtWeekly(minR)}</p>
          </div>
          {cheapestUnit?.previous_rent && cheapestUnit.previous_rent > minR && (
            <div className="text-right">
              <p className="text-xs text-gray-400 line-through">{fmtRent(cheapestUnit.previous_rent)}/mo</p>
              <p className="text-xs font-semibold text-green-600">Save £{Math.round(cheapestUnit.previous_rent - minR)}/mo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── EPC chart ─────────────────────────────────────────────────────────────
const EPC_BANDS = [
  { r:'A', color:'#008054', score:'92-100' },
  { r:'B', color:'#19b459', score:'81-91' },
  { r:'C', color:'#8dce46', score:'69-80' },
  { r:'D', color:'#ffd500', score:'55-68' },
  { r:'E', color:'#fcaa65', score:'39-54' },
  { r:'F', color:'#ef8023', score:'21-38' },
  { r:'G', color:'#e9153b', score:'1-20' },
]

function EpcChart({ current, potential }) {
  if (!current) return null
  const curIdx = EPC_BANDS.findIndex(b => b.r === current)
  const potIdx = potential ? EPC_BANDS.findIndex(b => b.r === potential) : -1

  return (
    <div className="space-y-1">
      {EPC_BANDS.map((band, i) => {
        const isCurrent = band.r === current
        const isPotential = potential && band.r === potential && potential !== current
        const width = 100 - i * 8  // staircase widths
        return (
          <div key={band.r} className="flex items-center gap-2">
            <div className="relative flex items-center" style={{width: `${width}%`, minWidth: 60}}>
              <div className="h-6 flex items-center px-2 rounded-sm text-white text-xs font-bold w-full"
                style={{backgroundColor: band.color, opacity: i < curIdx ? 0.35 : 1}}>
                {band.r}
              </div>
              {isCurrent && (
                <div className="absolute -right-14 flex items-center">
                  <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-r-[10px] border-t-transparent border-b-transparent" style={{borderRightColor: band.color}}/>
                  <div className="text-white text-xs font-bold px-2 py-0.5 rounded-sm" style={{backgroundColor: band.color}}>Current</div>
                </div>
              )}
              {isPotential && (
                <div className="absolute -right-14 flex items-center">
                  <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-r-[10px] border-t-transparent border-b-transparent" style={{borderRightColor: band.color}}/>
                  <div className="text-white text-xs font-bold px-2 py-0.5 rounded-sm" style={{backgroundColor: band.color}}>Potential</div>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap" style={{marginLeft: 64}}>{band.score}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Key Facts panel ───────────────────────────────────────────────────────
const EPC_COLORS = { A:'bg-green-600', B:'bg-green-500', C:'bg-lime-500', D:'bg-yellow-400 text-gray-800', E:'bg-orange-400', F:'bg-orange-600', G:'bg-red-600' }
const FURNISHED_LABEL = { furnished:'Furnished', unfurnished:'Unfurnished', 'part-furnished':'Part furnished' }

function KeyFacts({ unit, property, brand }) {
  if (!unit) return null

  const avail = unit.available_from
    ? new Date(unit.available_from).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : 'Now'

  const depositAmt = unit.deposit_amount
    ? `£${unit.deposit_amount.toLocaleString('en-GB')} (${unit.deposit_weeks} weeks)`
    : null

  // Total floor area from rooms
  let totalSqm = null
  if (unit.rooms?.length > 0) {
    const sum = unit.rooms.reduce((acc, r) => acc + (r.size_sqm || 0), 0)
    if (sum > 0) totalSqm = sum
  }

  const facts = [
    { label: 'Available',      value: avail },
    { label: 'Floor area',     value: totalSqm ? `~${totalSqm} m²  (${Math.round(totalSqm * 10.764)} sq ft)` : null },
    { label: 'Deposit',        value: depositAmt },
    { label: 'Furnishing',     value: unit.furnished ? FURNISHED_LABEL[unit.furnished] || unit.furnished : null },
    { label: 'Tenure',         value: property.tenure || null },
    { label: 'Council tax',    value: property.council_tax_band ? `Band ${property.council_tax_band}` : null },
    { label: 'Bills included', value: property.bills_included ? 'Yes — bills included' : null },
    { label: 'Property type',  value: { residential:'Residential', HMO:'HMO / House share', commercial:'Commercial' }[property.property_type] || property.property_type },
    { label: 'Bedrooms',       value: unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms} bedroom${unit.bedrooms !== 1 ? 's' : ''}` },
    { label: 'Bathrooms',      value: `${unit.bathrooms} bathroom${unit.bathrooms !== 1 ? 's' : ''}` },
    { label: 'Receptions',     value: unit.reception_rooms > 0 ? `${unit.reception_rooms} reception${unit.reception_rooms !== 1 ? 's' : ''}` : null },
  ].filter(f => f.value)

  return (
    <div className="space-y-3">
      {/* Key facts table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key facts</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {facts.map(f => (
            <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-gray-500">{f.label}</span>
              <span className={`text-xs font-semibold ${f.label === 'Bills included' ? 'text-green-600' : 'text-gray-800'}`}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* EPC chart */}
      {property.epc_rating && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Energy Performance Certificate</h3>
          </div>
          <div className="p-4">
            <EpcChart current={property.epc_rating} potential={property.epc_potential} />
          </div>
        </div>
      )}
    </div>
  )
}


// ── Mortgage / Affordability calculator ──────────────────────────────────
function AffordabilityCalc({ monthlyRent, brand }) {
  const [salary, setSalary] = useState('')
  const result = salary ? {
    maxRent: Math.round(+salary / 30),
    canAfford: Math.round(+salary / 30) >= monthlyRent,
  } : null

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Affordability checker</h3>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Your gross annual salary (£)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span>
            <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
              placeholder="30000"
              className="w-full border border-gray-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.canAfford ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`font-semibold ${result.canAfford ? 'text-green-700' : 'text-amber-700'}`}>
              {result.canAfford ? '✓ This property looks affordable' : '⚠ This may be above your budget'}
            </p>
            <p className={`text-xs mt-1 ${result.canAfford ? 'text-green-600' : 'text-amber-600'}`}>
              Most letting agents require annual income ≥ 30× monthly rent. Your max is <strong>£{result.maxRent.toLocaleString('en-GB')}/mo</strong>.
              This property is <strong>£{monthlyRent.toLocaleString('en-GB')}/mo</strong>.
            </p>
          </div>
        )}
        <p className="text-xs text-gray-400">Standard letting agent requirement: annual income ≥ 30× monthly rent (e.g. £2,000/mo needs £60,000/yr).</p>
      </div>
    </div>
  )
}

// ── Map error boundary ────────────────────────────────────────────────────
class MapErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: false } }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <p className="text-xs text-gray-400">Map unavailable</p>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Property modal ────────────────────────────────────────────────────────
function PropertyModal({ property, slug, org, brand, shortlisted, onToggleShortlist, onClose, allProps, onSelectSimilar, onBookViewing, onApply }) {
  const [form, setForm]     = useState({full_name:'',email:'',phone:'',message:'',unit_id:property.units[0]?.id??''})
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')
  const [sending, setSending] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [galleryTab, setGalleryTab] = useState('photos') // photos | floorplan | tour
  const [mapCoords, setMapCoords] = useState(null)
  const [copied, setCopied] = useState(false)

  const photos = (property.photos||[]).map(photoSrc).filter(Boolean)
  if (!photos.length && property.photo_url) photos.push(photoSrc(property.photo_url))
  const floorplanUrl = property.floorplan_url ? photoSrc(property.floorplan_url) : null
  const tourUrl = property.virtual_tour_url || null

  // Geocode property for mini-map
  useEffect(() => {
    if (property.postcode) {
      geocode(property.postcode).then(c => { if (c) setMapCoords(c) })
    }
  }, [property.postcode])

  function share(type) {
    const url = `${window.location.origin}/site/${slug}?property=${property.id}`
    if (type === 'copy') {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else if (type === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this property: ${property.name} — ${url}`)}`, '_blank')
    } else if (type === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent(property.name)}&body=${encodeURIComponent(`I found this property you might like:\n\n${property.name}\n${property.address_line1}, ${property.city}\n\n${url}`)}`)
    }
  }

  useEffect(() => { document.body.style.overflow='hidden'; return ()=>{document.body.style.overflow=''} },[])
  useEffect(() => {
    const h = e => {
      if (e.key==='ArrowLeft')  setPhotoIdx(i=>Math.max(0,i-1))
      if (e.key==='ArrowRight') setPhotoIdx(i=>Math.min(photos.length-1,i+1))
      if (e.key==='Escape')     onClose()
    }
    window.addEventListener('keydown',h)
    return ()=>window.removeEventListener('keydown',h)
  },[photos.length,onClose])

  async function submit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await apiPost(`/${slug}/enquiry`,{...form,property_id:property.id,unit_id:form.unit_id?parseInt(form.unit_id):null})
      setSent(true)
    } catch(ex) { setError(ex.response?.data?.detail||'Failed to send — please try again.') }
    setSending(false)
  }

  const selUnit   = property.units.find(u=>u.id===parseInt(form.unit_id))||property.units[0]
  const typeLabel = {residential:'Residential',HMO:'HMO / Shared',commercial:'Commercial'}[property.property_type]||property.property_type
  const badges    = unitBadges(selUnit||{}, property.property_type)
  const amenities = selUnit?.amenities || []
  const rooms     = selUnit?.rooms || []
  const similar   = allProps
    ? allProps.filter(p => p.id !== property.id && (p.city === property.city || p.postcode?.slice(0,2) === property.postcode?.slice(0,2))).slice(0, 5)
    : []

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 sm:my-8 overflow-hidden">

        {/* ── Gallery — tabs: Photos / Floorplan / Tour ── */}
        <div className="bg-gray-900">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 pt-2">
            {[
              ['photos', `📷 ${photos.length} photo${photos.length!==1?'s':''}`],
              ...(floorplanUrl ? [['floorplan', '📐 Floorplan']] : []),
              ...(tourUrl ? [['tour', '🎥 Virtual tour']] : []),
            ].map(([tab, label]) => (
              <button key={tab} onClick={() => setGalleryTab(tab)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-t-lg transition-colors ${galleryTab===tab?'bg-white text-gray-900':'text-white/60 hover:text-white'}`}>
                {label}
              </button>
            ))}
            {/* Shortlist + share + close always visible */}
            <div className="ml-auto flex gap-2 pb-1">
              <ShareButton propertyId={property.id} propertyName={property.name} className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-500 hover:text-indigo-600 shadow-md transition-colors" />
              <button onClick={e=>onToggleShortlist(property.id,e)}
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors ${shortlisted?'bg-rose-500 text-white':'bg-white/90 text-gray-500 hover:text-rose-500'}`}>
                <I.Heart f={shortlisted}/>
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white shadow-md font-bold text-sm">✕</button>
            </div>
          </div>

          {/* Photo tab */}
          {galleryTab === 'photos' && (
            <>
              <div className="relative h-64 sm:h-72 overflow-hidden">
                {photos[photoIdx]
                  ? <img src={photos[photoIdx]} alt={property.name} className="w-full h-full object-cover object-center transition-opacity duration-200"/>
                  : <div className="w-full h-full flex items-center justify-center text-6xl text-gray-700">🏠</div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"/>
                {photos.length > 1 && (<>
                  <button onClick={()=>setPhotoIdx(i=>Math.max(0,i-1))} disabled={photoIdx===0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 disabled:opacity-20 transition-colors">
                    <I.Chev d="l"/>
                  </button>
                  <button onClick={()=>setPhotoIdx(i=>Math.min(photos.length-1,i+1))} disabled={photoIdx===photos.length-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 disabled:opacity-20 transition-colors">
                    <I.Chev d="r"/>
                  </button>
                  <span className="absolute top-3 left-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {photoIdx+1} / {photos.length}
                  </span>
                </>)}
                <div className="absolute bottom-4 left-4 text-white">
                  <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-semibold mb-1.5 inline-block">{typeLabel}</span>
                  <h2 className="text-lg sm:text-xl font-bold drop-shadow leading-tight">{property.name}</h2>
                  <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5">
                    <I.Pin/>{property.address_line1}{property.address_line2?`, ${property.address_line2}`:''}, {property.city} {property.postcode}
                  </p>
                </div>
              </div>
              {photos.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-gray-900" style={{scrollbarWidth:'none'}}>
                  {photos.map((src, i) => (
                    <button key={i} onClick={()=>setPhotoIdx(i)}
                      className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${i===photoIdx?'border-white opacity-100':'border-transparent opacity-50 hover:opacity-80'}`}>
                      <img src={src} alt={`Photo ${i+1}`} className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Floorplan tab */}
          {galleryTab === 'floorplan' && floorplanUrl && (
            <div className="relative h-72 overflow-hidden bg-white flex items-center justify-center p-4">
              <img src={floorplanUrl} alt="Floorplan" className="max-h-full max-w-full object-contain"/>
            </div>
          )}

          {/* Virtual tour tab */}
          {galleryTab === 'tour' && tourUrl && (
            <div className="relative h-72 overflow-hidden bg-black">
              <iframe src={tourUrl} className="w-full h-full" allowFullScreen title="Virtual tour"/>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Property ref + listed date */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400">Ref: <span className="font-mono font-semibold text-gray-600">{property.reference_number || `PROP-${String(property.id).padStart(4,'0')}`}</span></span>
            {property.units[0]?.date_listed && (
              <span className="text-xs text-gray-400">
                Listed: {new Date(property.units[0].date_listed) <= new Date(Date.now()-7*86400000)
                  ? new Date(property.units[0].date_listed).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
                  : `${Math.floor((Date.now()-new Date(property.units[0].date_listed))/86400000)} days ago`}
              </span>
            )}
            {property.bills_included && <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">Bills included</span>}
          </div>

          {/* Share bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Share:</span>
            <button onClick={() => share('copy')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
              {copied ? '✓ Copied!' : '🔗 Copy link'}
            </button>
            <button onClick={() => share('whatsapp')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
              💬 WhatsApp
            </button>
            <button onClick={() => share('email')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
              ✉️ Email
            </button>
            <a href={`${API_BASE}/api/public/${slug}/property/${property.id}/brochure.pdf`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-white hover:opacity-90"
              style={bb(brand)}>
              📄 Download brochure
            </a>
          </div>

          {/* ── CTAs ── */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onBookViewing?.(property)}
              className="flex-1 text-center text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
              style={bb(brand)}>
              Book a viewing
            </button>
            <button onClick={() => onApply?.(property)}
              className="flex-1 text-center font-bold py-3 rounded-xl text-sm border-2 hover:bg-gray-50 transition-colors"
              style={{borderColor:brand,color:brand}}>
              Apply now
            </button>
            {org.phone && (
              <a href={`tel:${org.phone}`}
                className="flex items-center gap-2 font-semibold py-3 px-4 rounded-xl text-sm border-2 hover:bg-gray-50 transition-colors"
                style={{borderColor:brand,color:brand}}>
                <I.Phone />{org.phone}
              </a>
            )}
          </div>

          {property.description && <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>}

          {/* ── Feature highlights ── */}
          {property.features && property.features.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key features</h3>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {property.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={bb(brand)}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Amenities ── */}
          {amenities.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Amenities & features</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {amenities.map(key => (
                  <div key={key} className="flex items-center gap-2 text-xs text-gray-700">
                    <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                    <span>{AMENITY_LABELS[key] || key.replace(/_/g,' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Property specification (rooms) ── */}
          {rooms.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Property specification</h3>
                <span className="text-xs text-gray-400">{rooms.length} room{rooms.length!==1?'s':''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {rooms.map((room, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>
                      <span>{room.label || room.type.replace(/_/g,' ')}</span>
                    </span>
                    {room.size_sqm && (
                      <span className="text-xs text-gray-400 font-mono">{room.size_sqm} m²</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Key Facts ── */}
          <KeyFacts unit={selUnit} property={property} brand={brand} />

          {/* Units */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Available units · {property.units.length} option{property.units.length!==1?'s':''}
            </h3>
            <div className="space-y-2">
              {property.units.map(u => {
                const ub = unitBadges(u, property.property_type)
                const isSelected = parseInt(form.unit_id)===u.id
                return (
                  <label key={u.id} className="flex items-start justify-between rounded-xl px-4 py-3 text-sm cursor-pointer border-2 transition-colors"
                    style={isSelected?{borderColor:brand,backgroundColor:`${brand}11`}:{borderColor:'#f3f4f6',backgroundColor:'#f9fafb'}}>
                    <input type="radio" name="unit" value={u.id} checked={isSelected}
                      onChange={e=>setForm(f=>({...f,unit_id:e.target.value}))} className="sr-only"/>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{u.name}</p>
                        {ub.map(b=><span key={b.label} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${b.color}`}>{b.label}</span>)}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><I.Bed/>{u.bedrooms===0?'Studio':`${u.bedrooms} bed`}</span>
                        <span className="flex items-center gap-1"><I.Bath/>{u.bathrooms} bath</span>
                        {u.reception_rooms>0&&<span className="flex items-center gap-1"><I.Sofa/>{u.reception_rooms} rec</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-base" style={bt(brand)}>{fmtRent(u.monthly_rent)}/mo</p>
                      <p className="text-xs text-gray-400">{fmtWeekly(u.monthly_rent)}</p>
                      {u.previous_rent&&u.previous_rent>u.monthly_rent&&(
                        <p className="text-xs text-gray-400 line-through">{fmtRent(u.previous_rent)}/mo</p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ── Utilities, rights & restrictions ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Utilities, rights &amp; restrictions</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { icon:'💡', label:'Electric supply',       val:'Ask agent' },
                { icon:'💧', label:'Water supply',          val:'Ask agent' },
                { icon:'🌡️', label:'Heating',               val:property.bills_included?'Included in rent':'Ask agent' },
                { icon:'🌐', label:'Broadband',             val:null, link:{ href:`https://checker.ofcom.org.uk/en-gb/broadband-coverage?postcode=${encodeURIComponent(property.postcode||'')}`, text:'Check Ofcom broadband checker →' } },
                { icon:'🚰', label:'Sewerage',              val:'Ask agent' },
                { icon:'🚗', label:'Parking',               val: (() => { const amenities = selUnit?.amenities || []; return amenities.includes('parking') ? (property.bills_included ? 'Included' : 'Available — ask agent for cost') : 'Not included' })() },
                { icon:'🏛️', label:'Listed building',       val:'Ask agent' },
                { icon:'🌊', label:'Flood risk',            val:null, link:{ href:`https://check-long-term-flood-risk.service.gov.uk/postcode?postcode=${encodeURIComponent(property.postcode||'')}`, text:'Check government flood risk →' } },
                { icon:'⚖️', label:'Rights of way',         val:'Ask agent' },
                { icon:'📋', label:'Restrictions',          val:'Ask agent' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2">
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{row.icon}</span>{row.label}
                  </span>
                  {row.link
                    ? <a href={row.link.href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:underline" style={bt(brand)}>{row.link.text}</a>
                    : <span className="text-xs font-medium text-gray-700">{row.val}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* ── Deposit & holding deposit ── */}
          {selUnit && (() => {
            const weekly = Math.round(selUnit.monthly_rent * 12 / 52)
            const depWeeks = selUnit.deposit_weeks || 5
            const depAmt = Math.round(weekly * depWeeks)
            return (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">Deposit information</h3>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Holding deposit</p>
                    <p className="text-xs text-gray-500">Paid to reserve the property while referencing is completed. Credited against first month's rent.</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 ml-3 shrink-0">£{weekly.toLocaleString('en-GB')}</span>
                </div>
                <div className="flex items-start justify-between border-t border-blue-100 pt-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Security deposit</p>
                    <p className="text-xs text-gray-500">{depWeeks} weeks' rent · held in a government-approved TDS/DPS scheme</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 ml-3 shrink-0">£{depAmt.toLocaleString('en-GB')}</span>
                </div>
              </div>
            )
          })()}

          {/* ── Mini map ── */}
          {mapCoords && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{height: 200}}>
              <MapErrorBoundary>
                <MapContainer center={mapCoords} zoom={15} style={{height:'100%',width:'100%'}} zoomControl={false} scrollWheelZoom={false}>
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={mapCoords}>
                    <Popup>{property.name}<br/>{property.address_line1}</Popup>
                  </Marker>
                </MapContainer>
              </MapErrorBoundary>
            </div>
          )}

          {/* ── Affordability calculator ── */}
          <AffordabilityCalc monthlyRent={selUnit?.monthly_rent || 0} brand={brand} />

          {/* ── What's nearby ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">What's nearby</h3>
              {property.postcode && (
                <span className="text-xs text-gray-400">{property.postcode}</span>
              )}
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { icon:'🗺️', label:'Explore the area',    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((property.address_line1||'')+' '+(property.postcode||''))}` },
                { icon:'🚆', label:'Transport links',      href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(property.postcode||'')}` },
                { icon:'🏫', label:'Nearby schools',       href: `https://www.compare-school-performance.service.gov.uk/find-a-school-in-england?postcode=${encodeURIComponent(property.postcode||'')}&page-search=true` },
                { icon:'🌊', label:'Flood risk check',     href: `https://check-long-term-flood-risk.service.gov.uk/postcode?postcode=${encodeURIComponent(property.postcode||'')}` },
                { icon:'🌐', label:'Broadband checker',    href: `https://checker.ofcom.org.uk/en-gb/broadband-coverage?postcode=${encodeURIComponent(property.postcode||'')}` },
                { icon:'📋', label:'Council tax rates',    href: `https://www.gov.uk/council-tax` },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700 group">
                  <span className="text-base shrink-0">{l.icon}</span>
                  <span className="group-hover:underline">{l.label} →</span>
                </a>
              ))}
            </div>
            {mapCoords && (
              <div className="px-4 pb-4 text-xs text-gray-400 -mt-1">
                Co-ordinates: {mapCoords[0].toFixed(4)}°N, {mapCoords[1].toFixed(4)}°W · {property.city}
              </div>
            )}
          </div>

          {/* ── Similar properties ── */}
          {similar.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Similar properties nearby</h3>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {similar.map(p => {
                  const sPhoto = p.photos?.[0] ? photoSrc(p.photos[0]) : p.photo_url ? photoSrc(p.photo_url) : null
                  const sMinR  = p.units.length > 0 ? Math.min(...p.units.map(u=>u.monthly_rent)) : 0
                  const sBeds  = p.units.length > 0 ? Math.min(...p.units.map(u=>u.bedrooms)) : null
                  return (
                    <button key={p.id} onClick={() => onSelectSimilar(p)}
                      className="shrink-0 w-40 bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all text-left">
                      <div className="h-24 bg-gray-100 overflow-hidden">
                        {sPhoto
                          ? <img src={sPhoto} alt={p.name} className="w-full h-full object-cover object-center"/>
                          : <div className="w-full h-full flex items-center justify-center text-3xl text-gray-200">🏠</div>
                        }
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-800 line-clamp-1">{p.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1">{p.city}</p>
                        <p className="text-xs font-bold mt-1" style={bt(brand)}>{fmtRent(sMinR)}/mo</p>
                        {sBeds !== null && <p className="text-xs text-gray-400">{sBeds===0?'Studio':`${sBeds} bed`}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Supporting your tenancy ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Supporting your tenancy</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { icon:'🛡️', title:'Tenant insurance', desc:'Protect your belongings and liability from day one.', hint:'Contents & liability cover' },
                { icon:'💳', title:'Zero deposit option', desc:'Move in without a large lump-sum deposit using a deposit replacement guarantee.', hint:'Deposit-free renting' },
                { icon:'🔧', title:'Report a repair', desc:'Use our online portal to log maintenance issues 24/7 — we\'ll get it fixed fast.', hint:'Online maintenance reporting' },
                { icon:'🏅', title:'Propertymark CMP', desc:'Client Money Protection scheme member — your money is protected at all times.', hint:'ARLA Propertymark regulated' },
              ].map(s => (
                <div key={s.title} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xl shrink-0 mt-0.5">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800">{s.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0 hidden sm:block self-center">{s.hint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enquiry form */}
          <div className="border-t border-gray-100 pt-5">
            {/* Agent contact strip */}
            <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
              <div className="flex items-center gap-3 px-4 py-3 flex-wrap bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                  {org.email && (
                    <a href={`mailto:${org.email}`} className="text-xs text-gray-500 hover:text-indigo-600 transition-colors truncate block mt-0.5">{org.email}</a>
                  )}
                  {org.address_text && (
                    <p className="text-xs text-gray-400 mt-0.5">📍 {org.address_text}</p>
                  )}
                </div>
                {org.phone && (
                  <a href={`tel:${org.phone}`}
                    className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                    style={bb(brand)}>
                    <I.Phone />{org.phone}
                  </a>
                )}
              </div>
              {/* Opening hours */}
              {org.opening_hours?.length > 0 && (() => {
                const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
                const today = days[new Date().getDay()]
                const todayRow = org.opening_hours.find(h => h.day?.toLowerCase() === today.toLowerCase())
                return (
                  <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">🕐 Today's hours</span>
                    <span className="text-xs font-semibold text-gray-800">{todayRow ? todayRow.hours : 'Closed'}</span>
                  </div>
                )
              })()}
              {/* Trust badges */}
              <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2">
                {[
                  { label:'ARLA Propertymark', color:'#00a650', text:'#fff' },
                  { label:'DPS Protected',      color:'#1a5fa8', text:'#fff' },
                  { label:'Client Money Protected', color:'#6b21a8', text:'#fff' },
                  { label:'ICO Registered',     color:'#374151', text:'#fff' },
                ].map(b => (
                  <span key={b.label} className="text-xs font-bold px-2.5 py-1 rounded-md"
                    style={{ backgroundColor: b.color, color: b.text }}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            {sent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <p className="font-bold text-green-800">Enquiry sent!</p>
                <p className="text-sm text-green-700 mt-1">{org.name} will be in touch about <strong>{selUnit?.name}</strong>.</p>
                <button onClick={onClose} className="mt-4 text-sm text-green-700 font-medium hover:underline">Browse more properties</button>
              </div>
            ) : (
              <form id="modal-enquiry" onSubmit={submit} className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Request a viewing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
                    <input required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}
                      placeholder="Jane Smith" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                    <input required type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                      placeholder="jane@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
                  </div>
                </div>
                <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                  placeholder="Phone number (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
                <textarea rows={3} value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))}
                  placeholder="When are you available? Any questions?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"/>
                {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={sending} className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60" style={bb(brand)}>
                  {sending?'Sending…':'Send viewing request'}
                </button>
                <p className="text-xs text-center text-gray-400">Your details are shared only with {org.name}.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"/>
        <p className="text-gray-400 text-sm mt-4">Loading properties…</p>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center px-6">
        <p className="text-5xl mb-4">🏠</p>
        <h1 className="text-xl font-bold text-gray-800">Agency not found</h1>
        <p className="text-gray-500 text-sm mt-2">This agency doesn't exist or hasn't set up their PropAIrty site yet.</p>
        <a href="https://propairty.co.uk" className="mt-6 inline-block text-sm text-indigo-600 hover:underline font-medium">Visit PropAIrty →</a>
      </div>
    </div>
  )
}


// ── Shared role picker used by AuthModal + account pages ─────────────────
function RolePicker({ role, onChange }) {
  const opts = [
    { value: 'tenant',   emoji: '🔑', label: 'Looking to rent',   sub: 'Save properties, book viewings, apply' },
    { value: 'landlord', emoji: '🏠', label: 'I own a property',  sub: 'List your property, request a valuation' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${role === o.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <div className="text-xl mb-1">{o.emoji}</div>
          <p className={`text-xs font-bold leading-snug ${role === o.value ? 'text-indigo-700' : 'text-gray-800'}`}>{o.label}</p>
          <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{o.sub}</p>
        </button>
      ))}
    </div>
  )
}

// ── Auth Modal (sign in / register inline) ────────────────────────────────
function AuthModal({ slug, brand, tab, onTabChange, onSuccess, onClose }) {
  const [role, setRole] = useState('tenant')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const D2 = '#4f46e5'
  const bb2 = c => ({ backgroundColor: c || D2 })
  const bt2 = c => ({ color: c || D2 })

  function set(k) { return e => setForm(prev => ({ ...prev, [k]: e.target.value })) }

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const isLogin = tab === 'login'
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, full_name: form.full_name, phone: form.phone, role }
      const r = await apiPost(`/${slug}/account/${isLogin ? 'token' : 'register'}`, payload)
      localStorage.setItem(pubStorageKey(slug), JSON.stringify(r.data))
      onSuccess(r.data)
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-base font-bold text-gray-900">
            {tab === 'login' ? 'Sign in' : 'Create a free account'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 border-b border-gray-200 px-6">
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => { onTabChange(t); setError('') }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${tab === t ? 'text-gray-900 border-b-2' : 'text-gray-400 hover:text-gray-600'}`}
              style={tab === t ? { borderBottomColor: brand } : {}}>
              {t === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="p-6 space-y-3">
          {tab === 'register' && (
            <>
              <RolePicker role={role} onChange={setRole} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
                <input required value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.phone} onChange={set('phone')} placeholder="07700 900000" type="tel"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" value={form.password} onChange={set('password')}
              placeholder={tab === 'register' ? 'At least 8 characters' : ''}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            style={bb2(brand)}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <p className="text-center text-xs text-gray-400">
            {tab === 'login'
              ? <>No account? <button type="button" onClick={() => { onTabChange('register'); setError('') }} className="font-semibold hover:underline" style={bt2(brand)}>Register free</button></>
              : <>Already registered? <button type="button" onClick={() => { onTabChange('login'); setError('') }} className="font-semibold hover:underline" style={bt2(brand)}>Sign in</button></>
            }
          </p>
        </form>
      </div>
    </div>
  )
}


// ── Book Viewing / Apply Modal ────────────────────────────────────────────
function ViewingApplyModal({ slug, brand, property, mode, pubUser, onClose }) {
  const isViewing = mode === 'viewing'
  const [form, setForm] = useState({
    full_name: pubUser?.full_name || '',
    email: pubUser?.email || '',
    phone: pubUser?.phone || '',
    preferred_date: '',
    desired_move_in: '',
    monthly_budget: '',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const bb2 = c => ({ backgroundColor: c || '#4f46e5' })
  function set(k) { return e => setForm(prev => ({ ...prev, [k]: e.target.value })) }

  const minRent = property.units?.length ? Math.min(...property.units.map(u => u.monthly_rent)) : null

  async function submit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const path = isViewing ? `/${slug}/book-viewing` : `/${slug}/apply`
      const payload = isViewing
        ? { property_id: property.id, full_name: form.full_name, email: form.email, phone: form.phone, preferred_date: form.preferred_date, message: form.message }
        : { property_id: property.id, full_name: form.full_name, email: form.email, phone: form.phone, desired_move_in: form.desired_move_in, monthly_budget: form.monthly_budget, message: form.message }
      await apiPost(path, payload)
      setDone(true)
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Something went wrong — please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{isViewing ? 'Book a viewing' : 'Apply for this property'}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{property.name}{minRent ? ` · £${Number(minRent).toLocaleString('en-GB')}/mo` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">×</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-gray-900 mb-2">{isViewing ? 'Viewing request sent!' : 'Application submitted!'}</p>
            <p className="text-sm text-gray-500 mb-6">The agency will be in touch soon.</p>
            <button onClick={onClose}
              className="text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:opacity-90 transition-opacity"
              style={bb2(brand)}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-3 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
              <input required value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
              <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone number</label>
              <input value={form.phone} onChange={set('phone')} placeholder="07700 900000" type="tel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>

            {isViewing ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Preferred date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="date" value={form.preferred_date} onChange={set('preferred_date')}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Desired move-in date <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="date" value={form.desired_move_in} onChange={set('desired_move_in')}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monthly budget <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={form.monthly_budget} onChange={set('monthly_budget')} placeholder="e.g. £900–£1,000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={form.message} onChange={set('message')} rows={3}
                placeholder={isViewing ? 'Any questions or specific requirements…' : 'Tell us a bit about yourself…'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
            </div>

            {error && <p className="text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button type="submit" disabled={sending}
              className="w-full text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              style={bb2(brand)}>
              {sending ? 'Sending…' : isViewing ? 'Request viewing' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
