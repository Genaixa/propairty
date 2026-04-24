import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import ProfileDropdown from '../../components/ProfileDropdown'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

function apiGet(p, token) {
  return axios.get(`${API_BASE}/api/public${p}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
}
function apiDel(p, token) {
  return axios.delete(`${API_BASE}/api/public${p}`, { headers: { Authorization: `Bearer ${token}` } })
}
function apiPost(p, token, body = {}) {
  return axios.post(`${API_BASE}/api/public${p}`, body, { headers: { Authorization: `Bearer ${token}` } })
}
function apiPatch(p, token, body = {}) {
  return axios.patch(`${API_BASE}/api/public${p}`, body, { headers: { Authorization: `Bearer ${token}` } })
}
function photoSrc(url) {
  return !url ? null : url.startsWith('http') ? url : `${API_BASE}${url}`
}

function storageKey(slug) { return `propairty_public_${slug}` }

const D = '#4f46e5'
const bb = c => ({ backgroundColor: c || D })
const bt = c => ({ color: c || D })
const bc = c => ({ borderColor: c || D })

// ── Status labels ─────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  enquiry: 'Enquiry sent',
  viewing_booked: 'Viewing booked',
  viewed: 'Viewed',
  referencing: 'Referencing',
  approved: 'Approved',
  tenancy_created: 'Tenancy created',
  rejected: 'Unsuccessful',
  withdrawn: 'Withdrawn',
}
const STATUS_COLOR = {
  enquiry: 'bg-blue-100 text-blue-700',
  viewing_booked: 'bg-violet-100 text-violet-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  referencing: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  tenancy_created: 'bg-emerald-200 text-emerald-800',
  rejected: 'bg-red-100 text-red-600',
  withdrawn: 'bg-gray-100 text-gray-500',
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Shared header ─────────────────────────────────────────────────────────────
function AccountHeader({ org, slug, brand, user, onLogout, onUpdateUser, onPassword }) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to={`/site/${slug}`} className="flex items-center gap-3">
          {org?.logo_url
            ? <img src={photoSrc(org.logo_url)} alt={org?.name} className="h-8 w-auto object-contain" />
            : <span className="font-bold text-lg" style={bt(brand)}>{org?.name}</span>
          }
        </Link>
        {user && (
          <ProfileDropdown
            me={user}
            onUpdate={onUpdateUser}
            onPassword={onPassword}
            onLogout={onLogout}
            accentRing="focus:ring-indigo-500"
            btnClass="bg-indigo-600 hover:bg-indigo-700"
          />
        )}
      </div>
    </header>
  )
}

// ── Saved property card ───────────────────────────────────────────────────────
function SavedCard({ prop, slug, brand, onRemove }) {
  const photo = photoSrc(prop.photo_url)
  const address = [prop.address_line1, prop.city].filter(Boolean).join(', ')
  const unit = prop.units?.[0]
  const rent = unit?.rent_pcm ? `£${Number(unit.rent_pcm).toLocaleString('en-GB')}/mo` : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      <Link to={`/site/${slug}/property/${prop.id}`} className="block">
        <div className="relative h-36 bg-gray-100">
          {photo
            ? <img src={photo} alt={prop.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🏠</div>
          }
          {rent && (
            <span className="absolute bottom-2 left-2 text-xs font-bold text-white px-2 py-0.5 rounded-full" style={bb(brand)}>
              {rent}
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="font-semibold text-gray-900 text-sm truncate group-hover:underline">{prop.name}</p>
          {address && <p className="text-xs text-gray-400 mt-0.5 truncate">{address}</p>}
        </div>
      </Link>
      <div className="px-4 pb-4 flex items-center justify-between">
        <Link to={`/site/${slug}/property/${prop.id}`}
          className="text-xs font-semibold" style={bt(brand)}>
          View details →
        </Link>
        <button onClick={onRemove}
          className="text-xs text-gray-300 hover:text-red-400 transition-colors">
          Remove
        </button>
      </div>
    </div>
  )
}

// ── Application / viewing row ─────────────────────────────────────────────────
function ApplicationRow({ app, slug, brand, onCancel }) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const photo = photoSrc(app.property_photo)
  const label = STATUS_LABEL[app.status] || app.status
  const colorClass = STATUS_COLOR[app.status] || 'bg-gray-100 text-gray-600'
  const isTerminal = ['rejected', 'withdrawn', 'tenancy_created'].includes(app.status)
  const isPending = app.status === 'viewing_booked' && !app.viewing_date
  const isUpcoming = app.status === 'viewing_booked' && app.viewing_date && new Date(app.viewing_date) > new Date()

  async function handleCancel() {
    if (!window.confirm('Cancel this application?')) return
    setCancelling(true)
    try {
      await onCancel(app.id)
      setCancelled(true)
    } catch {
      setCancelling(false)
    }
  }

  if (cancelled) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-4 items-start">
      {/* Property thumbnail */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {photo
          ? <img src={photo} alt={app.property_name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🏠</div>
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {app.property_name || 'Property'}
              {app.unit_name && <span className="text-gray-400 font-normal"> · {app.unit_name}</span>}
            </p>
            {app.property_address && (
              <p className="text-xs text-gray-400 truncate">{app.property_address}</p>
            )}
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${colorClass}`}>
            {label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          {isPending && (
            <span className="text-amber-600 font-semibold">Awaiting date confirmation from agency</span>
          )}
          {isUpcoming && (
            <span className="text-violet-600 font-semibold">Confirmed: {fmtDateTime(app.viewing_date)}</span>
          )}
          {app.status === 'viewing_booked' && app.viewing_date && !isUpcoming && (
            <span>Viewing was {fmtDate(app.viewing_date)}</span>
          )}
          {app.status !== 'viewing_booked' && app.viewing_date && (
            <span>Viewed: {fmtDate(app.viewing_date)}</span>
          )}
          {app.desired_move_in && (
            <span>Move in: {fmtDate(app.desired_move_in)}</span>
          )}
          {app.referencing_status && app.referencing_status !== 'not_started' && (
            <span>Referencing: <span className="capitalize">{app.referencing_status.replace('_', ' ')}</span></span>
          )}
          <span>Applied {fmtDate(app.created_at)}</span>
        </div>

        {!isTerminal && (
          <div className="mt-3">
            <button onClick={handleCancel} disabled={cancelling}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
              {cancelling ? 'Cancelling…' : 'Cancel application'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {count != null && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      {children}
    </section>
  )
}

// ── Tenant / applicant account ────────────────────────────────────────────────
function ApplicantAccount({ slug, brand, user, saved, applications, onRemoveSaved, onCancelApp, navigate }) {
  const viewings = applications.filter(a => a.status === 'viewing_booked')
  const active = applications.filter(a => !['rejected', 'withdrawn', 'tenancy_created', 'viewing_booked'].includes(a.status))
  const past = applications.filter(a => ['rejected', 'withdrawn', 'tenancy_created'].includes(a.status))

  const hasActivity = applications.length > 0 || saved.length > 0

  // Count upcoming confirmed viewings for the header badge
  const upcomingCount = viewings.filter(a => a.viewing_date && new Date(a.viewing_date) > new Date()).length

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0" style={bb(brand)}>
          {user?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{user?.full_name}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        <Link to={`/site/${slug}`}
          className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-xl border-2 transition-colors hover:bg-gray-50"
          style={{ ...bt(brand), ...bc(brand) }}>
          Browse properties
        </Link>
      </div>

      {/* Viewings — pending and upcoming */}
      {viewings.length > 0 && (
        <Section title="Viewings" count={viewings.length}>
          <div className="space-y-3">
            {viewings.map(a => <ApplicationRow key={a.id} app={a} slug={slug} brand={brand} onCancel={onCancelApp} />)}
          </div>
        </Section>
      )}

      {/* Active applications */}
      {active.length > 0 && (
        <Section title="Active applications" count={active.length}>
          <div className="space-y-3">
            {active.map(a => <ApplicationRow key={a.id} app={a} slug={slug} brand={brand} onCancel={onCancelApp} />)}
          </div>
        </Section>
      )}

      {/* Saved properties */}
      {saved.length > 0 && (
        <Section title="Saved properties" count={saved.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {saved.map(p => (
              <SavedCard key={p.id} prop={p} slug={slug} brand={brand}
                onRemove={e => onRemoveSaved(p.id, e)} />
            ))}
          </div>
        </Section>
      )}

      {/* Past applications */}
      {past.length > 0 && (
        <Section title="Past applications" count={past.length}>
          <div className="space-y-3">
            {past.map(a => <ApplicationRow key={a.id} app={a} slug={slug} brand={brand} onCancel={onCancelApp} />)}
          </div>
        </Section>
      )}

      {/* Empty state */}
      {!hasActivity && (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🏠</p>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Nothing here yet</h3>
          <p className="text-sm text-gray-400 mb-6">Browse properties, save your favourites and book viewings — they'll all appear here.</p>
          <Link to={`/site/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
            style={bb(brand)}>
            Browse properties
          </Link>
        </div>
      )}

      {/* Already a tenant? */}
      <div className="mt-4 bg-gray-50 rounded-2xl border border-gray-100 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Already moved in?</p>
          <p className="text-xs text-gray-400 mt-0.5">Sign in to your tenant portal for payments, documents and maintenance.</p>
        </div>
        <a href="/tenant/login"
          className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border-2 transition-colors hover:bg-white"
          style={{ ...bt(brand), ...bc(brand) }}>
          Tenant portal →
        </a>
      </div>
    </main>
  )
}

// ── Landlord account ──────────────────────────────────────────────────────────
function LandlordAccount({ slug, brand, user, org }) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0" style={bb(brand)}>
          {user?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-bold text-gray-900">{user?.full_name}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link to={`/site/${slug}/valuation`}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
          <p className="text-2xl mb-3">📊</p>
          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">Free rental valuation</h3>
          <p className="text-sm text-gray-500">Find out what your property could earn per month.</p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold gap-1" style={bt(brand)}>Request valuation →</span>
        </Link>

        <Link to={`/site/${slug}/landlords`}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
          <p className="text-2xl mb-3">📋</p>
          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">Landlord services</h3>
          <p className="text-sm text-gray-500">Full management, tenant find, compliance and rent collection.</p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold gap-1" style={bt(brand)}>Learn more →</span>
        </Link>

        <Link to={`/site/${slug}/contact`}
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
          <p className="text-2xl mb-3">💬</p>
          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">Talk to us</h3>
          <p className="text-sm text-gray-500">Have a property to let or want to switch managing agent?</p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold gap-1" style={bt(brand)}>Contact us →</span>
        </Link>

        <a href="/landlord/login"
          className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
          <p className="text-2xl mb-3">🔐</p>
          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">Already a managed landlord?</h3>
          <p className="text-sm text-gray-500">View financials, maintenance, compliance and monthly statements.</p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold gap-1" style={bt(brand)}>Landlord portal →</span>
        </a>
      </div>

      {org?.phone && (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 flex items-center gap-4">
          <span className="text-2xl">📞</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Speak to our lettings team</p>
            <a href={`tel:${org.phone}`} className="text-sm font-bold" style={bt(brand)}>{org.phone}</a>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Main account page ─────────────────────────────────────────────────────────
export default function PublicAccount({ slug: slugProp }) {
  const { slug: slugParam } = useParams()
  const slug = slugProp || slugParam
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [user, setUser] = useState(null)
  const [saved, setSaved] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const brand = org?.brand_color || D

  function getToken() {
    try { return JSON.parse(localStorage.getItem(storageKey(slug)) || 'null')?.access_token } catch { return null }
  }

  useEffect(() => {
    apiGet(`/${slug}`).then(r => setOrg(r.data)).catch(() => {})
    const token = getToken()
    if (!token) { navigate(`/site/${slug}/account/login`, { replace: true }); return }
    Promise.all([
      apiGet(`/${slug}/account/me`, token),
      apiGet(`/${slug}/account/saved`, token),
      apiGet(`/${slug}/account/applications`, token),
    ]).then(([me, sv, apps]) => {
      setUser(me.data)
      setSaved(sv.data)
      setApplications(apps.data)
    }).catch(() => {
      localStorage.removeItem(storageKey(slug))
      navigate(`/site/${slug}/account/login`, { replace: true })
    }).finally(() => setLoading(false))
  }, [slug])

  function logout() {
    localStorage.removeItem(storageKey(slug))
    localStorage.removeItem('propairty_shortlist')
    navigate(`/site/${slug}`)
  }

  async function removeSaved(propId, e) {
    e.stopPropagation()
    const token = getToken()
    try {
      await apiDel(`/${slug}/account/saved/${propId}`, token)
      setSaved(prev => prev.filter(p => p.id !== propId))
    } catch {}
  }

  async function cancelApp(applicantId) {
    const token = getToken()
    await apiPost(`/${slug}/account/applications/${applicantId}/cancel`, token)
    setApplications(prev => prev.map(a => a.id === applicantId ? { ...a, status: 'withdrawn' } : a))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AccountHeader
        org={org} slug={slug} brand={brand} user={user} onLogout={logout}
        onUpdateUser={async (patch) => { const token = getToken(); const r = await apiPatch(`/${slug}/account/me`, token, patch); setUser(u => ({ ...u, ...r.data })) }}
        onPassword={async ({ current, next }) => { const token = getToken(); await apiPost(`/${slug}/account/me/change-password`, token, { current_password: current, new_password: next }) }}
      />
      {user?.role === 'landlord'
        ? <LandlordAccount slug={slug} brand={brand} user={user} org={org} />
        : <ApplicantAccount slug={slug} brand={brand} user={user} saved={saved}
            applications={applications} onRemoveSaved={removeSaved} onCancelApp={cancelApp} navigate={navigate} />
      }
    </div>
  )
}
