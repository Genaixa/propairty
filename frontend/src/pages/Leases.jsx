import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Illustration'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import Badge from '../components/Badge'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_OPTIONS = [
  { value: 'all',        label: 'All' },
  { value: 'active',     label: 'Active' },
  { value: 'expired',    label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

function CfoStrip({ group, allUnits }) {
  const propUnits = allUnits.filter(u => u.property_id === Number(group.propId))
  const activeLeases = group.leases.filter(l => l.status === 'active')
  const activeRent = activeLeases.reduce((s, l) => s + (l.monthly_rent || 0), 0)
  const depositsHeld = activeLeases.reduce((s, l) => s + (l.deposit || 0), 0)
  const vacantUnits = propUnits.filter(u => u.status === 'vacant')
  const voidCost = vacantUnits.reduce((s, u) => s + (u.monthly_rent || 0), 0)

  const today = new Date()
  const in90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const expiring = activeLeases.filter(l => {
    if (!l.end_date || l.is_periodic) return false
    const end = new Date(l.end_date)
    return end >= today && end <= in90
  })

  const cols = [
    {
      label: 'Monthly roll',
      value: `£${activeRent.toLocaleString()}`,
      sub: `£${(activeRent * 12).toLocaleString()} / year`,
      color: 'text-emerald-700',
    },
    {
      label: 'Annual roll',
      value: `£${(activeRent * 12).toLocaleString()}`,
      sub: `${activeLeases.length} active lease${activeLeases.length !== 1 ? 's' : ''}`,
      color: 'text-emerald-600',
    },
    {
      label: 'Deposits held',
      value: `£${depositsHeld.toLocaleString()}`,
      sub: 'tenant deposit liability',
      color: 'text-indigo-600',
    },
    {
      label: 'Void cost',
      value: voidCost > 0 ? `£${voidCost.toLocaleString()}/mo` : '£0',
      sub: voidCost > 0 ? `${vacantUnits.length} vacant unit${vacantUnits.length !== 1 ? 's' : ''}` : 'Fully let',
      color: voidCost > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      label: 'Expiring ≤ 90d',
      value: expiring.length > 0 ? `${expiring.length} lease${expiring.length !== 1 ? 's' : ''}` : '—',
      sub: expiring.length > 0 ? 'renewal needed' : 'none due soon',
      color: expiring.length > 0 ? 'text-rose-600' : 'text-gray-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-indigo-100 border-b border-indigo-100 bg-gradient-to-r from-slate-50 to-white">
      {cols.map(c => (
        <div key={c.label} className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{c.label}</p>
          <p className={`text-sm font-bold ${c.color}`}>{c.value}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

export default function Leases() {
  const [leases, setLeases] = useState([])
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [sortCol, setSortCol] = useState('unit')
  const [sortDir, setSortDir] = useState('asc')
  const [groupFilters, setGroupFilters] = useState({})
  const [propFilter, setPropFilter] = useState('all')
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ unit_id: '', tenant_id: '', start_date: '', end_date: '', monthly_rent: '', deposit: '', rent_day: 1, is_periodic: false })

  useEffect(() => {
    load()
    api.get('/properties').then(r => setProperties(r.data))
    api.get('/tenants').then(r => setTenants(r.data))
  }, [])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name, property_id: p.id })))
  const sortedTenants = [...tenants].sort((a, b) => {
    const sA = a.full_name?.split(' ').slice(-1)[0]?.toLowerCase() || ''
    const sB = b.full_name?.split(' ').slice(-1)[0]?.toLowerCase() || ''
    return sA.localeCompare(sB)
  })

  const load = () => api.get('/leases').then(r => setLeases(r.data))

  const save = async e => {
    e.preventDefault()
    setFormError('')
    const payload = { ...form, unit_id: parseInt(form.unit_id), tenant_id: parseInt(form.tenant_id), monthly_rent: parseFloat(form.monthly_rent), deposit: form.deposit ? parseFloat(form.deposit) : null }
    try {
      if (editing) {
        await api.put(`/leases/${editing.id}`, payload)
        setEditing(null)
      } else {
        await api.post('/leases', payload)
        setShowForm(false)
      }
      load()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save lease.')
    }
  }

  function openEdit(l) {
    setForm({
      unit_id: String(l.unit_id),
      tenant_id: String(l.tenant_id),
      start_date: l.start_date?.slice(0, 10) || '',
      end_date: l.end_date?.slice(0, 10) || '',
      monthly_rent: String(l.monthly_rent),
      deposit: l.deposit ? String(l.deposit) : '',
      rent_day: l.rent_day || 1,
      is_periodic: l.is_periodic || false,
    })
    setEditing(l)
  }

  const tenantName = id => tenants.find(t => t.id === id)?.full_name || '—'

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const getGroupFilter = propId => groupFilters[propId] ?? 'active'
  const setGroupFilter = (propId, val) => setGroupFilters(prev => ({ ...prev, [propId]: val }))

  const sortVal = (l, col) => {
    if (col === 'unit')    return l._unit?.name || ''
    if (col === 'tenant')  return tenantName(l.tenant_id)
    if (col === 'start')   return l.start_date || ''
    if (col === 'end')     return l.end_date || ''
    if (col === 'rent')    return l.monthly_rent || 0
    if (col === 'deposit') return l.deposit || 0
    if (col === 'status')  return l.status || ''
    return ''
  }

  // Group ALL leases by property (no status pre-filter — each group has its own filter)
  const propertyGroups = (() => {
    const groups = {}
    leases.forEach(l => {
      const unit = allUnits.find(u => u.id === l.unit_id)
      const propId = unit?.property_id ?? 'unknown'
      const propName = unit?.propertyName ?? 'Unknown Property'
      if (!groups[propId]) groups[propId] = { name: propName, leases: [] }
      groups[propId].leases.push({ ...l, _unit: unit })
    })
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([propId, g]) => ({ propId, name: g.name, leases: g.leases }))
  })()

  return (
    <div>
      <PageHeader title="Leases" subtitle="Active and upcoming tenancy agreements" />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Property selector dropdown */}
        <div className="relative">
          <select
            value={propFilter}
            onChange={e => setPropFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm">
            <option value="all">All properties</option>
            {propertyGroups.map(g => (
              <option key={g.propId} value={String(g.propId)}>{g.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-xs text-gray-400">
          {propFilter === 'all' ? `${propertyGroups.length} propert${propertyGroups.length !== 1 ? 'ies' : 'y'}` : ''}
        </span>
        <div className="ml-auto">
          <button onClick={() => setShowForm(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
            + New Lease
          </button>
        </div>
      </div>

      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editing ? 'Edit Lease' : 'New Lease'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); setFormError('') }} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">&times;</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Unit *</label>
                <select value={form.unit_id} onChange={e => { setForm({ ...form, unit_id: e.target.value }); setFormError('') }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" required>
                  <option value="">Select unit…</option>
                  {properties.map(p => (
                    <optgroup key={p.id} label={p.name}>
                      {(p.units || []).map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name}{u.status === 'occupied' ? ' (currently occupied)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Tenant *</label>
                <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" required>
                  <option value="">Select tenant…</option>
                  {sortedTenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Start Date *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Monthly Rent *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">£</span>
                    <input type="number" step="0.01" min="0" value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })}
                      className="w-full pl-7 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Deposit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">£</span>
                    <input type="number" step="0.01" min="0" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })}
                      placeholder="Optional"
                      className="w-full pl-7 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_periodic} onChange={e => setForm({ ...form, is_periodic: e.target.checked })} className="rounded" />
                Periodic tenancy (no fixed end date)
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">Save</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); setFormError('') }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {propertyGroups.filter(g => propFilter === 'all' || String(g.propId) === propFilter).map(group => {
          const sf = getGroupFilter(group.propId)
          const displayLeases = group.leases
            .filter(l => sf === 'all' || l.status === sf)
            .sort((a, b) => {
              const av = sortVal(a, sortCol), bv = sortVal(b, sortCol)
              if (av < bv) return sortDir === 'asc' ? -1 : 1
              if (av > bv) return sortDir === 'asc' ? 1 : -1
              return 0
            })

          return (
            <div key={group.propId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Property header with per-group status filter */}
              <div className="flex items-center gap-2 px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex-wrap">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <Link to={`/properties/${group.propId}`} className="text-sm font-semibold text-indigo-700 hover:underline">{group.name}</Link>

                {/* Per-group status filter pills */}
                <div className="flex gap-1 ml-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setGroupFilter(group.propId, opt.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        sf === opt.value
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <span className="ml-auto text-xs text-indigo-400 shrink-0">
                  {displayLeases.length} {sf !== 'all' ? sf : ''} lease{displayLeases.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Mini CFO strip */}
              <CfoStrip group={group} allUnits={allUnits} />

              {/* Leases table */}
              {displayLeases.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">No {sf !== 'all' ? sf : ''} leases for this property.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      {[
                        { key: 'unit',    label: 'Unit' },
                        { key: 'tenant',  label: 'Tenant' },
                        { key: 'start',   label: 'Start' },
                        { key: 'end',     label: 'End' },
                        { key: 'rent',    label: 'Rent/mo' },
                        { key: 'deposit', label: 'Deposit' },
                        { key: 'status',  label: 'Status' },
                        { key: '',        label: '' },
                      ].map(({ key, label }) => (
                        <th key={label}
                          onClick={() => key && toggleSort(key)}
                          className={`text-left px-5 py-2.5 text-xs uppercase tracking-wide whitespace-nowrap select-none ${
                            key ? 'cursor-pointer font-semibold hover:text-gray-700' : ''
                          } ${sortCol === key && key ? 'text-indigo-600' : 'text-gray-400 font-medium'}`}>
                          {label}
                          {key && (
                            <span className="ml-1 inline-block">
                              {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-200">↕</span>}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayLeases.map(l => {
                      const tenant = tenants.find(t => t.id === l.tenant_id)
                      const unit = l._unit
                      return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3.5 text-gray-700 font-medium whitespace-nowrap">
                            {unit
                              ? <Link to={`/properties/${unit.property_id}/units/${unit.id}`} className="hover:text-indigo-600 transition-colors">{unit.name}</Link>
                              : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            {tenant
                              ? <Link to={`/tenants/${tenant.id}`} className="text-indigo-600 hover:underline font-medium">{tenant.full_name}</Link>
                              : <span className="text-gray-900 font-medium">{tenantName(l.tenant_id)}</span>}
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmt(l.start_date)}</td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                            {l.is_periodic ? <span className="italic text-gray-400">Periodic</span> : fmt(l.end_date)}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-700 whitespace-nowrap">£{l.monthly_rent?.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{l.deposit ? `£${l.deposit?.toLocaleString()}` : '—'}</td>
                          <td className="px-5 py-3.5"><Badge value={l.status} /></td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => openEdit(l)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer">Edit</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}

        {propertyGroups.filter(g => propFilter === 'all' || String(g.propId) === propFilter).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium mb-1">No leases yet</p>
            <p className="text-sm">Click + New Lease to add your first tenancy.</p>
          </div>
        )}
      </div>
    </div>
  )
}
