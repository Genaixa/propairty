import { useEffect, useState } from 'react'
import api from '../lib/api'

const STATUS_STYLE = {
  valid:         { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',  label: 'Valid' },
  expiring_soon: { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  label: 'Expiring Soon' },
  expired:       { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      label: 'Expired' },
  missing:       { dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',    label: 'No Record' },
}

const CERT_ORDER = ['gas_safety', 'eicr', 'epc', 'fire_risk', 'legionella', 'pat']
const CERT_SHORT = {
  gas_safety: 'Gas Safety', eicr: 'EICR', epc: 'EPC',
  fire_risk: 'Fire Risk', legionella: 'Legionella', pat: 'PAT',
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.missing
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default function Compliance() {
  const [summary, setSummary] = useState([])
  const [certs, setCerts] = useState([])
  const [properties, setProperties] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ property_id: '', cert_type: 'gas_safety', issue_date: '', expiry_date: '', contractor: '', reference: '', notes: '' })

  const load = async () => {
    const [s, c, p] = await Promise.all([
      api.get('/compliance/summary'),
      api.get('/compliance'),
      api.get('/properties'),
    ])
    setSummary(s.data)
    setCerts(c.data)
    setProperties(p.data)
  }

  useEffect(() => { load() }, [])

  const save = async e => {
    e.preventDefault()
    await api.post('/compliance', form)
    load()
    setShowForm(false)
    setForm({ property_id: '', cert_type: 'gas_safety', issue_date: '', expiry_date: '', contractor: '', reference: '', notes: '' })
  }

  const deleteCert = async id => {
    await api.delete(`/compliance/${id}`)
    load()
  }

  const alerts = certs.filter(c => c.status === 'expired' || c.status === 'expiring_soon')
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Compliance</h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Certificate
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">Add Certificate</h3>
            <form onSubmit={save} className="space-y-4">
              <select value={form.property_id} onChange={e => setForm({...form, property_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={form.cert_type} onChange={e => setForm({...form, cert_type: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(CERT_SHORT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Issue Date</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>
              {[['contractor','Contractor (optional)'],['reference','Reference / Cert Number (optional)'],['notes','Notes (optional)']].map(([k,l]) => (
                <input key={k} placeholder={l} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              ))}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className={`rounded-xl border p-4 mb-6 ${alerts.some(a => a.status === 'expired') ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <h3 className="font-semibold text-sm mb-2 text-gray-800">
            {alerts.filter(a => a.status === 'expired').length > 0 && `⛔ ${alerts.filter(a => a.status === 'expired').length} expired  `}
            {alerts.filter(a => a.status === 'expiring_soon').length > 0 && `⚠ ${alerts.filter(a => a.status === 'expiring_soon').length} expiring within 60 days`}
          </h3>
          <div className="space-y-1.5">
            {alerts.map(a => (
              <div key={a.id} className="flex justify-between items-center bg-white rounded-lg px-4 py-2 border border-gray-100 text-sm">
                <span className="font-medium text-gray-800">{a.property_name} — {a.cert_label}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${a.status === 'expired' ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                    {a.status === 'expired' ? `Expired ${a.expiry_date}` : `Expires ${a.expiry_date} (${a.days_until_expiry}d)`}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property compliance matrix */}
      <div className="space-y-4 mb-8">
        {summary.map(prop => (
          <div key={prop.property_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  prop.overall_status === 'valid' ? 'bg-green-500' :
                  prop.overall_status === 'attention' ? 'bg-amber-400' : 'bg-red-500'
                }`} />
                <span className="font-semibold text-gray-900">{prop.property_name}</span>
                <span className="text-xs text-gray-400 capitalize">{prop.property_type}</span>
              </div>
              <StatusBadge status={prop.overall_status === 'attention' ? 'expiring_soon' : prop.overall_status} />
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
              {CERT_ORDER.map(ctype => {
                const c = prop.certificates[ctype]
                if (!c) return null
                return (
                  <div key={ctype} className="px-4 py-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{CERT_SHORT[ctype]}</p>
                    <StatusBadge status={c.status} />
                    {c.expiry_date && (
                      <p className="text-xs text-gray-400 mt-1">{c.expiry_date}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Full certificates table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">All Certificates</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Property','Type','Issue Date','Expiry','Contractor','Status',''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {certs.map(c => (
              <tr key={c.id} className={`hover:bg-gray-50 ${c.status === 'expired' ? 'bg-red-50/40' : ''}`}>
                <td className="px-5 py-3 font-medium text-gray-900">{c.property_name}</td>
                <td className="px-5 py-3 text-gray-600">{c.cert_label}</td>
                <td className="px-5 py-3 text-gray-500">{c.issue_date}</td>
                <td className={`px-5 py-3 font-medium ${c.status === 'expired' ? 'text-red-600' : c.status === 'expiring_soon' ? 'text-amber-600' : 'text-gray-700'}`}>{c.expiry_date}</td>
                <td className="px-5 py-3 text-gray-400">{c.contractor || '—'}</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => deleteCert(c.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
