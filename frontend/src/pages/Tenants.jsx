import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/Illustration'
import api from '../lib/api'

const EMPTY_FORM = { full_name: '', email: '', phone: '', whatsapp_number: '', date_of_birth: '', notes: '' }

function SortIcon({ col, sortCol, sortDir }) {
  const active = sortCol === col
  return (
    <span className="inline-flex flex-col ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" style={active ? { opacity: 1 } : {}}>
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0l5 6H0z" /></svg>
      <svg className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z" /></svg>
    </span>
  )
}

function Th({ col, label, sortCol, sortDir, onSort, className = '' }) {
  return (
    <th onClick={() => onSort(col)}
      className={`group text-left py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}>
      <span className="inline-flex items-center">
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  )
}

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [portalModal, setPortalModal] = useState(null)
  const [portalPw, setPortalPw] = useState('')
  const [portalMsg, setPortalMsg] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(null)
  const { t } = useTranslation()

  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')
  const [portalFilter, setPortalFilter] = useState('')

  const load = () => api.get('/tenants').then(r => setTenants(r.data))
  useEffect(() => { load() }, [])

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const totalPortal = tenants.filter(t => t.portal_enabled).length

  const displayed = useMemo(() => {
    let list = [...tenants]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.full_name.toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q)
      )
    }
    if (portalFilter === 'enabled') list = list.filter(t => t.portal_enabled)
    if (portalFilter === 'disabled') list = list.filter(t => !t.portal_enabled)

    if (sortCol) {
      list.sort((a, b) => {
        let va, vb
        if (sortCol === 'name') {
          const surname = n => { const p = n.trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).toLowerCase() }
          va = surname(a.full_name); vb = surname(b.full_name)
        } else if (sortCol === 'email') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase() }
        else if (sortCol === 'phone') { va = (a.phone || '').toLowerCase(); vb = (b.phone || '').toLowerCase() }
        else if (sortCol === 'portal') { va = a.portal_enabled ? 0 : 1; vb = b.portal_enabled ? 0 : 1 }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [tenants, search, portalFilter, sortCol, sortDir])

  const save = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/tenants', form)
      await load()
      setShowForm(false)
      setForm(EMPTY_FORM)
    } finally { setSaving(false) }
  }

  const enablePortal = async e => {
    e.preventDefault()
    try {
      await api.post(`/tenant/enable/${portalModal.id}`, { password: portalPw })
      await load()
      setPortalModal(null)
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  const tiles = [
    { key: null,      label: 'Tenants',       value: tenants.length,  color: 'text-indigo-600', ring: 'ring-indigo-400', bg: 'bg-indigo-50' },
    { key: 'enabled', label: 'Portal Active',  value: totalPortal,     color: 'text-violet-600', ring: 'ring-violet-400', bg: 'bg-violet-50' },
    { key: 'disabled',label: 'No Portal',      value: tenants.length - totalPortal, color: 'text-gray-500', ring: 'ring-gray-300', bg: 'bg-gray-50' },
  ]

  return (
    <div>
      <PageHeader title={t('tenants.title')} subtitle="All your tenants in one place">
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
          + {t('tenants.addTenant')}
        </button>
      </PageHeader>

      {/* ── Stat tiles ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {tiles.map(t => {
          const active = t.key !== null && portalFilter === t.key
          return (
            <button key={t.label}
              onClick={() => t.key === null ? setPortalFilter('') : setPortalFilter(f => f === t.key ? '' : t.key)}
              className={`flex-1 min-w-32 bg-white rounded-xl border px-5 py-3 text-left cursor-pointer transition-all
                ${active ? `ring-2 ${t.ring} border-transparent ${t.bg}` : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${t.color}`}>{t.value}</p>
              {active && <p className="text-xs text-gray-400 mt-0.5">Filtered · click to clear</p>}
            </button>
          )
        })}
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        {(search || portalFilter) && (
          <button onClick={() => { setSearch(''); setPortalFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{displayed.length} of {tenants.length}</span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <Th col="name"   label={t('tenants.fullName')} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="email"  label={t('tenants.email')}    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="phone"  label={t('tenants.phone')}    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
              <Th col="portal" label="Portal"                sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 && (
              <tr><td colSpan="4" className="px-5 py-12 text-center text-gray-400">
                {tenants.length === 0 ? 'No tenants yet.' : <>No tenants match your filters.{' '}
                  <button onClick={() => { setSearch(''); setPortalFilter('') }} className="text-indigo-600 hover:underline cursor-pointer">Clear filters</button></>}
              </td></tr>
            )}
            {displayed.map(tenant => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  <Link to={`/tenants/${tenant.id}`} className="flex items-center gap-3 group">
                    {tenant.avatar_url
                      ? <img src={tenant.avatar_url} alt={tenant.full_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">{tenant.full_name[0]}</div>
                    }
                    <span className="font-medium text-indigo-600 group-hover:underline">{tenant.full_name}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  {tenant.email
                    ? <a href={`mailto:${tenant.email}`} className="text-gray-600 hover:text-indigo-600 hover:underline">{tenant.email}</a>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {tenant.phone
                    ? <a href={`tel:${tenant.phone}`} className="text-gray-600 hover:text-indigo-600 hover:underline">{tenant.phone}</a>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {tenant.portal_enabled ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Enabled</span>
                      {confirmDisable === tenant.id ? (
                        <>
                          <span className="text-xs text-red-600 font-medium">Disable?</span>
                          <button onClick={async () => {
                            await api.post(`/tenant/disable/${tenant.id}`)
                            setConfirmDisable(null)
                            await load()
                          }} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer">Yes</button>
                          <button onClick={() => setConfirmDisable(null)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded cursor-pointer">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDisable(tenant.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline cursor-pointer">Disable</button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setPortalModal(tenant); setPortalPw(''); setPortalMsg('') }}
                      className="text-xs text-violet-600 hover:underline font-medium cursor-pointer">
                      Enable portal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add Tenant modal ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{t('tenants.addTenant')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-7 py-5 space-y-6">

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Info</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Sophie Clarke" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="sophie@email.co.uk" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="+44 7700 900000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input value={form.whatsapp_number} onChange={e => setForm({...form, whatsapp_number: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="+447700900000" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Portal */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Portal Access <span className="font-normal normal-case text-gray-300">optional</span></p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Portal Password</label>
                  <input type="password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} minLength={8}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Min 8 characters — leave blank to enable later" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes <span className="font-normal normal-case text-gray-300">optional</span></p>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                  placeholder="Any notes about this tenant…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

            </div>

            <div className="flex gap-3 px-7 py-5 border-t border-gray-100 shrink-0">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                {saving ? 'Adding…' : t('tenants.addTenant')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Enable portal modal ─────────────────────────────────────────── */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Tenant Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              Set a password for <span className="font-medium text-gray-800">{portalModal.full_name}</span>.
              They will log in at <span className="font-mono text-xs">/tenant/login</span> using {portalModal.email}.
            </p>
            <form onSubmit={enablePortal} className="space-y-4">
              <input type="password" placeholder="Password (min 8 characters)" value={portalPw}
                onChange={e => setPortalPw(e.target.value)} required minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {portalMsg && <p className="text-sm text-red-500">{portalMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700 cursor-pointer">Enable</button>
                <button type="button" onClick={() => setPortalModal(null)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
