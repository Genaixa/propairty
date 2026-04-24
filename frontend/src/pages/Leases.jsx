import { useEffect, useState } from 'react'
import { PageHeader } from '../components/Illustration'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import Badge from '../components/Badge'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Leases() {
  const [leases, setLeases] = useState([])
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [sortCol, setSortCol] = useState('start_date')
  const [sortDir, setSortDir] = useState('desc')
  const [units, setUnits] = useState([])
  const [form, setForm] = useState({ unit_id: '', tenant_id: '', start_date: '', end_date: '', monthly_rent: '', deposit: '', rent_day: 1, is_periodic: false })

  useEffect(() => {
    load()
    api.get('/properties').then(r => setProperties(r.data))
    api.get('/tenants').then(r => setTenants(r.data))
  }, [])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name, property_id: p.id })))

  const load = () => api.get('/leases').then(r => setLeases(r.data))

  const save = async e => {
    e.preventDefault()
    const payload = { ...form, unit_id: parseInt(form.unit_id), tenant_id: parseInt(form.tenant_id), monthly_rent: parseFloat(form.monthly_rent), deposit: form.deposit ? parseFloat(form.deposit) : null }
    if (editing) {
      await api.put(`/leases/${editing.id}`, payload)
      setEditing(null)
    } else {
      await api.post('/leases', payload)
      setShowForm(false)
    }
    load()
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
  const unitName = id => { const u = allUnits.find(u => u.id === id); return u ? `${u.propertyName} · ${u.name}` : '—' }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortedLeases = [...leases].sort((a, b) => {
    let av, bv
    if (sortCol === 'tenant')      { av = tenantName(a.tenant_id); bv = tenantName(b.tenant_id) }
    else if (sortCol === 'unit')   { av = unitName(a.unit_id);     bv = unitName(b.unit_id) }
    else if (sortCol === 'rent')   { av = a.monthly_rent;          bv = b.monthly_rent }
    else if (sortCol === 'deposit'){ av = a.deposit || 0;          bv = b.deposit || 0 }
    else if (sortCol === 'status') { av = a.status;                bv = b.status }
    else                           { av = a[sortCol] || '';        bv = b[sortCol] || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-5 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  return (
    <div>
      <PageHeader title="Leases" subtitle="Active and upcoming tenancy agreements" />
      <div className="flex justify-between items-center mb-4">
        <div />
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Lease
        </button>
      </div>

      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">{editing ? 'Edit Lease' : 'New Lease'}</h3>
            <form onSubmit={save} className="space-y-4">
              <select value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select unit…</option>
                {allUnits.map(u => <option key={u.id} value={u.id}>{u.propertyName} · {u.name}</option>)}
              </select>
              <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select tenant…</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" placeholder="Start date" value={form.start_date} onChange={e => setForm({...form,start_date:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input type="date" placeholder="End date" value={form.end_date} onChange={e => setForm({...form,end_date:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Monthly rent £" value={form.monthly_rent} onChange={e => setForm({...form,monthly_rent:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input type="number" placeholder="Deposit £" value={form.deposit} onChange={e => setForm({...form,deposit:e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_periodic} onChange={e => setForm({...form,is_periodic:e.target.checked})} />
                Periodic tenancy (no fixed end date)
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh col="tenant" label="Tenant" />
              <SortTh col="unit" label="Unit" />
              <SortTh col="start_date" label="Start" />
              <SortTh col="end_date" label="End" />
              <SortTh col="rent" label="Rent/mo" />
              <SortTh col="deposit" label="Deposit" />
              <SortTh col="status" label="Status" />
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedLeases.map(l => {
              const tenant = tenants.find(t => t.id === l.tenant_id)
              const unit = allUnits.find(u => u.id === l.unit_id)
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium">
                    {tenant
                      ? <Link to={`/tenants/${tenant.id}`} className="text-indigo-600 hover:underline">{tenant.full_name}</Link>
                      : <span className="text-gray-900">{tenantName(l.tenant_id)}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {unit
                      ? <Link to={`/properties/${unit.property_id}/units/${unit.id}`} className="hover:text-indigo-600">{unit.propertyName} · {unit.name}</Link>
                      : unitName(l.unit_id)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{fmt(l.start_date)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{l.is_periodic ? 'Periodic' : fmt(l.end_date)}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-700">£{l.monthly_rent?.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-gray-500">{l.deposit ? `£${l.deposit?.toLocaleString()}` : '—'}</td>
                  <td className="px-5 py-3.5"><Badge value={l.status} /></td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openEdit(l)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline">Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
