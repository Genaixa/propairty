import { useEffect, useState } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'

export default function Leases() {
  const [leases, setLeases] = useState([])
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [units, setUnits] = useState([])
  const [form, setForm] = useState({ unit_id: '', tenant_id: '', start_date: '', end_date: '', monthly_rent: '', deposit: '', rent_day: 1, is_periodic: false })

  useEffect(() => {
    api.get('/leases').then(r => setLeases(r.data))
    api.get('/properties').then(r => setProperties(r.data))
    api.get('/tenants').then(r => setTenants(r.data))
  }, [])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name })))

  const save = async e => {
    e.preventDefault()
    await api.post('/leases', { ...form, unit_id: parseInt(form.unit_id), tenant_id: parseInt(form.tenant_id), monthly_rent: parseFloat(form.monthly_rent), deposit: form.deposit ? parseFloat(form.deposit) : null })
    api.get('/leases').then(r => setLeases(r.data))
    setShowForm(false)
  }

  const tenantName = id => tenants.find(t => t.id === id)?.full_name || '—'
  const unitName = id => { const u = allUnits.find(u => u.id === id); return u ? `${u.propertyName} · ${u.name}` : '—' }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Leases</h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Lease
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">New Lease</h3>
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
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Tenant','Unit','Start','End','Rent/mo','Deposit','Status'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leases.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{tenantName(l.tenant_id)}</td>
                <td className="px-5 py-3.5 text-gray-500">{unitName(l.unit_id)}</td>
                <td className="px-5 py-3.5 text-gray-500">{l.start_date}</td>
                <td className="px-5 py-3.5 text-gray-500">{l.is_periodic ? 'Periodic' : (l.end_date || '—')}</td>
                <td className="px-5 py-3.5 font-semibold text-gray-700">£{l.monthly_rent}</td>
                <td className="px-5 py-3.5 text-gray-500">{l.deposit ? `£${l.deposit}` : '—'}</td>
                <td className="px-5 py-3.5"><Badge value={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
