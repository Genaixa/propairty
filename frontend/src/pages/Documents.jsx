import { useEffect, useState } from 'react'
import api from '../lib/api'

const DOC_ICONS = {
  ast: '📝',
  section_21: '⚖️',
  section_8: '⚠️',
  rent_increase: '📈',
  deposit_receipt: '🏦',
}

const DOC_DESC = {
  ast: 'Full Assured Shorthold Tenancy Agreement with all standard clauses.',
  section_21: 'No-fault notice requiring possession after 2 months.',
  section_8: 'Notice seeking possession on grounds of rent arrears.',
  rent_increase: 'Section 13 notice of proposed rent increase.',
  deposit_receipt: 'Tenancy Deposit receipt and protection confirmation.',
}

export default function Documents() {
  const [leases, setLeases] = useState([])
  const [tenants, setTenants] = useState([])
  const [properties, setProperties] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [form, setForm] = useState({ lease_id: '', doc_type: 'ast', new_rent: '', effective_date: '', arrears_amount: '', custom_notes: '' })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/leases'),
      api.get('/tenants'),
      api.get('/properties'),
      api.get('/documents/types'),
    ]).then(([l, t, p, d]) => {
      setLeases(l.data)
      setTenants(t.data)
      setProperties(p.data)
      setDocTypes(d.data)
    })
  }, [])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name })))
  const tenantName = id => tenants.find(t => t.id === id)?.full_name || '—'
  const unitLabel = id => { const u = allUnits.find(u => u.id === id); return u ? `${u.propertyName} · ${u.name}` : '—' }

  const generate = async () => {
    if (!form.lease_id || !form.doc_type) return
    setGenerating(true)
    setError('')
    try {
      const payload = { lease_id: parseInt(form.lease_id), doc_type: form.doc_type }
      if (form.new_rent) payload.new_rent = parseFloat(form.new_rent)
      if (form.effective_date) payload.effective_date = form.effective_date
      if (form.arrears_amount) payload.arrears_amount = parseFloat(form.arrears_amount)
      if (form.custom_notes) payload.custom_notes = form.custom_notes

      const res = await api.post('/documents/generate', payload, { responseType: 'blob' })
      const cd = res.headers['content-disposition'] || ''
      const fname = cd.match(/filename="([^"]+)"/)?.[1] || 'document.pdf'
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate document.')
    }
    setGenerating(false)
  }

  const needsRentFields = form.doc_type === 'rent_increase'
  const needsArrears = form.doc_type === 'section_8'

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Generator</h2>
      <p className="text-gray-500 text-sm mb-8">Generate legally compliant UK tenancy documents as PDFs in seconds.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
            <h3 className="font-semibold text-gray-800 mb-5">Generate Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lease / Tenant</label>
                <select value={form.lease_id} onChange={e => setForm({...form, lease_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select lease…</option>
                  {leases.map(l => (
                    <option key={l.id} value={l.id}>
                      {tenantName(l.tenant_id)} — {unitLabel(l.unit_id)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Document Type</label>
                <select value={form.doc_type} onChange={e => setForm({...form, doc_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {docTypes.map(d => (
                    <option key={d.key} value={d.key}>{DOC_ICONS[d.key]} {d.label}</option>
                  ))}
                </select>
              </div>

              {needsRentFields && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New Monthly Rent (£)</label>
                    <input type="number" value={form.new_rent} onChange={e => setForm({...form, new_rent: e.target.value})}
                      placeholder="e.g. 1050" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Effective From</label>
                    <input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </>
              )}

              {needsArrears && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Arrears Amount (£)</label>
                  <input type="number" value={form.arrears_amount} onChange={e => setForm({...form, arrears_amount: e.target.value})}
                    placeholder="e.g. 1900" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}

              {(form.doc_type === 'section_8' || form.doc_type === 'rent_increase') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Additional Notes (optional)</label>
                  <textarea value={form.custom_notes} onChange={e => setForm({...form, custom_notes: e.target.value})}
                    rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              )}

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button onClick={generate} disabled={!form.lease_id || generating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors">
                {generating ? 'Generating PDF…' : '⬇ Generate & Download PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Document type cards */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm mb-4">Available Documents</h3>
          {docTypes.map(d => (
            <div key={d.key}
              onClick={() => setForm({...form, doc_type: d.key})}
              className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
                form.doc_type === d.key ? 'border-indigo-400 shadow-md bg-indigo-50/30' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{DOC_ICONS[d.key]}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{d.label}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{DOC_DESC[d.key]}</p>
                </div>
                {form.doc_type === d.key && (
                  <span className="ml-auto text-indigo-600 text-xs font-medium bg-indigo-100 px-2 py-1 rounded-full">Selected</span>
                )}
              </div>
            </div>
          ))}

          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-400">
            More document types coming soon — Inventory report, Inspection report, S13 Notice, Lease renewal…
          </div>
        </div>
      </div>
    </div>
  )
}
