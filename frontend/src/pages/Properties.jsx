import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/Illustration'
import api from '../lib/api'
import Badge from '../components/Badge'

const EPC_COLORS = {
  A: 'bg-green-600', B: 'bg-green-500', C: 'bg-lime-500',
  D: 'bg-yellow-400', E: 'bg-orange-400', F: 'bg-orange-600', G: 'bg-red-600',
}
const EPC_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 }

function SortIcon({ col, sortCol, sortDir }) {
  const active = sortCol === col
  return (
    <span className="inline-flex flex-col ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" style={active ? { opacity: 1 } : {}}>
      <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortDir === 'asc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0l5 6H0z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && sortDir === 'desc' ? 'text-indigo-600' : 'text-gray-400'}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}

function Th({ col, label, sortCol, sortDir, onSort, className = '' }) {
  return (
    <th
      onClick={() => onSort(col)}
      className={`group py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  )
}

export default function Properties() {
  const [properties, setProperties] = useState([])
  const [landlords, setLandlords] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [epcFilter, setEpcFilter] = useState('')
  const [vacancyFilter, setVacancyFilter] = useState('')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', address_line1: '', address_line2: '', city: '', postcode: '', property_type: 'residential', description: '', landlord_id: '', epc_rating: '' })

  useEffect(() => {
    api.get('/properties').then(r => setProperties(r.data))
    api.get('/landlord/landlords').then(r => setLandlords(r.data)).catch(() => {})
  }, [])

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const displayed = useMemo(() => {
    let list = [...properties]

    // ── Filter ──────────────────────────────────────────────────────────────
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address_line1 || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.postcode || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter) list = list.filter(p => p.property_type === typeFilter)
    if (epcFilter) list = list.filter(p => (p.epc_rating || '') === epcFilter)
    if (vacancyFilter === 'vacant') list = list.filter(p => p.units.some(u => u.status === 'vacant'))
    if (vacancyFilter === 'full') list = list.filter(p => p.units.every(u => u.status === 'occupied'))

    // ── Sort ─────────────────────────────────────────────────────────────────
    if (sortCol) {
      list.sort((a, b) => {
        let va, vb
        if (sortCol === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
        else if (sortCol === 'address') { va = (a.city || '').toLowerCase(); vb = (b.city || '').toLowerCase() }
        else if (sortCol === 'type') { va = a.property_type; vb = b.property_type }
        else if (sortCol === 'epc') { va = EPC_ORDER[a.epc_rating] ?? 99; vb = EPC_ORDER[b.epc_rating] ?? 99 }
        else if (sortCol === 'units') { va = a.units.length; vb = b.units.length }
        else if (sortCol === 'occupied') { va = a.units.filter(u => u.status === 'occupied').length; vb = b.units.filter(u => u.status === 'occupied').length }
        else if (sortCol === 'vacant') { va = a.units.filter(u => u.status === 'vacant').length; vb = b.units.filter(u => u.status === 'vacant').length }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [properties, search, typeFilter, epcFilter, vacancyFilter, sortCol, sortDir])

  const hasFilters = search || typeFilter || epcFilter || vacancyFilter

  const save = async e => {
    e.preventDefault()
    await api.post('/properties', { ...form, landlord_id: form.landlord_id ? parseInt(form.landlord_id) : null })
    const r = await api.get('/properties')
    setProperties(r.data)
    setShowForm(false)
    setForm({ name: '', address_line1: '', address_line2: '', city: '', postcode: '', property_type: 'residential', description: '', landlord_id: '', epc_rating: '' })
  }

  return (
    <div>
      <PageHeader title={t('properties.title')} subtitle="Manage your portfolio">
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
          + {t('properties.addProperty')}
        </button>
      </PageHeader>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">{t('properties.addProperty')}</h3>
            <form onSubmit={save} className="space-y-4">
              {[['name','Name'],['address_line1','Address'],['address_line2','Address Line 2 (optional)'],['city','City'],['postcode','Postcode']].map(([k,l]) => (
                <input key={k} placeholder={l} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required={k !== 'address_line2'}
                />
              ))}
              <select value={form.property_type} onChange={e => setForm({...form,property_type:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="residential">{t('properties.residential')}</option>
                <option value="HMO">{t('properties.hmo')}</option>
                <option value="commercial">{t('properties.commercial')}</option>
              </select>
              <select value={form.landlord_id} onChange={e => setForm({...form, landlord_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Assign to landlord (optional)</option>
                {landlords.map(l => <option key={l.id} value={l.id}>{l.full_name} — {l.email}</option>)}
              </select>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">EPC Rating (optional)</label>
                <div className="flex gap-1.5">
                  {['A','B','C','D','E','F','G'].map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, epc_rating: f.epc_rating === r ? '' : r }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                        form.epc_rating === r
                          ? `${EPC_COLORS[r]} text-white ring-2 ring-offset-1 ring-gray-400`
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">{t('common.save')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, address, city…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All types</option>
          <option value="residential">Residential</option>
          <option value="HMO">HMO</option>
          <option value="commercial">Commercial</option>
        </select>

        {/* EPC filter */}
        <select
          value={epcFilter}
          onChange={e => setEpcFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All EPC ratings</option>
          {['A','B','C','D','E','F','G'].map(r => (
            <option key={r} value={r}>EPC {r}</option>
          ))}
        </select>

        {/* Vacancy filter */}
        <select
          value={vacancyFilter}
          onChange={e => setVacancyFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">All occupancy</option>
          <option value="vacant">Has vacancies</option>
          <option value="full">Fully occupied</option>
        </select>

        {/* Clear button */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setEpcFilter(''); setVacancyFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}

        {/* Result count */}
        <span className="self-center text-xs text-gray-400 ml-auto">
          {displayed.length} of {properties.length}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium w-20"></th>
              <Th col="name"     label={t('properties.title')}   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-left px-5" />
              <Th col="address"  label={t('tenants.property')}   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-left px-5" />
              <Th col="type"     label={t('properties.type')}    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-left px-5" />
              <Th col="epc"      label="EPC"                      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center px-4" />
              <Th col="units"    label={t('properties.units')}   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center px-4" />
              <Th col="occupied" label={t('properties.occupied')} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center px-4" />
              <Th col="vacant"   label={t('properties.vacant')}  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-center px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map(p => {
              const occupied = p.units.filter(u => u.status === 'occupied').length
              const vacant = p.units.filter(u => u.status === 'vacant').length
              return (
                <tr key={p.id} onClick={() => navigate(`/properties/${p.id}`)}
                  className="hover:bg-indigo-50 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5">
                    {p.cover_photo
                      ? <img src={p.cover_photo} alt={p.name} className="w-16 h-12 object-cover rounded-lg" />
                      : <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                          </svg>
                        </div>
                    }
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{p.name}</td>
                  <td className="px-5 py-3 text-gray-500">{p.address_line1}, {p.city} <span className="text-gray-400">{p.postcode}</span></td>
                  <td className="px-5 py-3"><Badge value={p.property_type} /></td>
                  <td className="px-4 py-3 text-center">
                    {p.epc_rating
                      ? <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-white text-xs font-bold ${EPC_COLORS[p.epc_rating] || 'bg-gray-400'}`}>{p.epc_rating}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700 font-medium">{p.units.length}</td>
                  <td className="px-4 py-3 text-center font-medium">
                    <span className={occupied > 0 ? 'text-green-600' : 'text-gray-300'}>{occupied}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {vacant > 0
                      ? <span className="inline-flex items-center justify-center bg-amber-50 text-amber-600 rounded-full px-2 py-0.5 text-xs font-semibold">{vacant}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {displayed.length === 0 && (
          <div className="text-center py-14">
            {properties.length === 0
              ? <p className="text-gray-400 text-sm">{t('properties.noProperties')}</p>
              : <>
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
                  </svg>
                  <p className="text-gray-400 text-sm">No properties match your filters</p>
                  <button onClick={() => { setSearch(''); setTypeFilter(''); setEpcFilter(''); setVacancyFilter('') }}
                    className="mt-2 text-indigo-600 text-sm hover:underline cursor-pointer">Clear filters</button>
                </>
            }
          </div>
        )}
      </div>
    </div>
  )
}
