import { useEffect, useState } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'

export default function Properties() {
  const [properties, setProperties] = useState([])
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address_line1: '', address_line2: '', city: '', postcode: '', property_type: 'residential', description: '' })

  useEffect(() => { api.get('/properties').then(r => setProperties(r.data)) }, [])

  const save = async e => {
    e.preventDefault()
    await api.post('/properties', form)
    const r = await api.get('/properties')
    setProperties(r.data)
    setShowForm(false)
    setForm({ name: '', address_line1: '', address_line2: '', city: '', postcode: '', property_type: 'residential', description: '' })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Property
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">New Property</h3>
            <form onSubmit={save} className="space-y-4">
              {[['name','Name'],['address_line1','Address'],['address_line2','Address Line 2 (optional)'],['city','City'],['postcode','Postcode']].map(([k,l]) => (
                <input key={k} placeholder={l} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required={k !== 'address_line2'}
                />
              ))}
              <select value={form.property_type} onChange={e => setForm({...form,property_type:e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="residential">Residential</option>
                <option value="HMO">HMO</option>
                <option value="commercial">Commercial</option>
              </select>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {properties.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">{p.name}</h3>
              <Badge value={p.property_type} />
            </div>
            <p className="text-sm text-gray-500">{p.address_line1}, {p.city}</p>
            <p className="text-xs text-gray-400">{p.postcode}</p>
            <div className="mt-4 flex gap-4 text-sm">
              <span className="text-gray-600"><strong>{p.units.length}</strong> units</span>
              <span className="text-green-600"><strong>{p.units.filter(u => u.status === 'occupied').length}</strong> occupied</span>
              <span className="text-amber-500"><strong>{p.units.filter(u => u.status === 'vacant').length}</strong> vacant</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.address_line1}, {selected.city}, {selected.postcode}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-2">
              {selected.units.map(u => (
                <div key={u.id} className="flex justify-between items-center border border-gray-100 rounded-lg px-4 py-3">
                  <div>
                    <span className="font-medium text-sm text-gray-800">{u.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{u.bedrooms}bd · {u.bathrooms}ba</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">£{u.monthly_rent}/mo</span>
                    <Badge value={u.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
