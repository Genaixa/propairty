import { useEffect, useState } from 'react'
import api from '../lib/api'

const TRADES = ['Plumber', 'Electrician', 'Gas Engineer', 'Builder', 'Roofer', 'Painter/Decorator', 'Carpenter', 'Locksmith', 'Cleaner', 'Gardener', 'General Maintenance', 'Other']

const priorityBadge = p => ({
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
}[p] || 'bg-gray-100 text-gray-500')

const statusBadge = s => ({
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
}[s] || 'bg-gray-100 text-gray-500')

export default function Contractors() {
  const [tab, setTab] = useState('contractors')
  const [contractors, setContractors] = useState([])
  const [jobs, setJobs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', company_name: '', trade: '', email: '', phone: '', notes: '' })
  const [editId, setEditId] = useState(null)
  const [assignModal, setAssignModal] = useState(null) // job object
  const [assignForm, setAssignForm] = useState({ contractor_id: '', estimated_cost: '', actual_cost: '', invoice_ref: '' })
  const [assignMsg, setAssignMsg] = useState('')
  const [portalModal, setPortalModal] = useState(null) // contractor object
  const [portalPassword, setPortalPassword] = useState('')
  const [portalMsg, setPortalMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [cr, jr] = await Promise.all([api.get('/contractors'), api.get('/contractors/jobs')])
    setContractors(cr.data)
    setJobs(jr.data)
  }

  async function saveContractor(e) {
    e.preventDefault()
    if (editId) {
      await api.put(`/contractors/${editId}`, form)
    } else {
      await api.post('/contractors', form)
    }
    setShowForm(false)
    setEditId(null)
    setForm({ full_name: '', company_name: '', trade: '', email: '', phone: '', notes: '' })
    load()
  }

  function startEdit(c) {
    setForm({ full_name: c.full_name, company_name: c.company_name || '', trade: c.trade || '', email: c.email || '', phone: c.phone || '', notes: c.notes || '' })
    setEditId(c.id)
    setShowForm(true)
  }

  async function removeContractor(id) {
    await api.delete(`/contractors/${id}`)
    load()
  }

  async function handlePortalEnable(e) {
    e.preventDefault()
    setPortalMsg('')
    try {
      await api.post(`/contractor/enable/${portalModal.id}`, { password: portalPassword })
      setPortalMsg('Portal enabled. Contractor can now log in at /contractor/login')
      setPortalPassword('')
      load()
    } catch (err) {
      setPortalMsg(err.response?.data?.detail || 'Failed to enable portal')
    }
  }

  async function handlePortalDisable(contractorId) {
    try {
      await api.post(`/contractor/disable/${contractorId}`)
      load()
    } catch {}
  }

  async function handleAssign(e) {
    e.preventDefault()
    setAssignMsg('')
    try {
      const payload = {}
      if (assignForm.contractor_id) payload.contractor_id = parseInt(assignForm.contractor_id)
      if (assignForm.estimated_cost) payload.estimated_cost = parseFloat(assignForm.estimated_cost)
      if (assignForm.actual_cost) payload.actual_cost = parseFloat(assignForm.actual_cost)
      if (assignForm.invoice_ref) payload.invoice_ref = assignForm.invoice_ref
      await api.put(`/contractors/assign/${assignModal.id}`, payload)
      setAssignMsg('Updated successfully.')
      load()
    } catch (err) {
      setAssignMsg(err.response?.data?.detail || 'Failed to update')
    }
  }

  const totalSpend = jobs.reduce((s, j) => s + (j.actual_cost || 0), 0)
  const totalEstimated = jobs.reduce((s, j) => s + (j.estimated_cost || 0), 0)
  const openJobs = jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length
  const unassigned = jobs.filter(j => !j.contractor_id && (j.status === 'open' || j.status === 'in_progress')).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Contractors</h2>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ full_name: '', company_name: '', trade: '', email: '', phone: '', notes: '' }) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Contractor
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Contractors', value: contractors.length, color: 'text-indigo-600' },
          { label: 'Open Jobs', value: openJobs, color: 'text-yellow-600' },
          { label: 'Unassigned', value: unassigned, color: unassigned > 0 ? 'text-red-600' : 'text-gray-600' },
          { label: 'Total Spend', value: `£${totalSpend.toLocaleString()}`, color: 'text-gray-900' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        {[['contractors', 'Contractors'], ['jobs', 'Jobs & Costs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Contractors list */}
      {tab === 'contractors' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name / Company', 'Trade', 'Contact', 'Jobs', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contractors.map(c => {
                const cJobs = jobs.filter(j => j.contractor_id === c.id)
                const cSpend = cJobs.reduce((s, j) => s + (j.actual_cost || 0), 0)
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{c.full_name}</p>
                      {c.company_name && <p className="text-xs text-gray-500">{c.company_name}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.trade ? <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{c.trade}</span> : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p className="text-xs">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      <p>{cJobs.length} job{cJobs.length !== 1 ? 's' : ''}</p>
                      {cSpend > 0 && <p className="text-xs text-gray-400">£{cSpend.toLocaleString()} spent</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 items-center flex-wrap">
                        <button onClick={() => startEdit(c)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                        <button onClick={() => removeContractor(c.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                        {c.portal_enabled ? (
                          <button onClick={() => handlePortalDisable(c.id)} className="text-xs bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600 px-2 py-0.5 rounded-full border border-green-200">
                            Portal ✓
                          </button>
                        ) : (
                          <button onClick={() => { setPortalModal(c); setPortalPassword(''); setPortalMsg('') }}
                            className="text-xs bg-gray-50 text-gray-500 hover:bg-orange-50 hover:text-orange-600 px-2 py-0.5 rounded-full border border-gray-200">
                            Enable Portal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {contractors.length === 0 && (
                <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-400">No contractors yet. Add your first contractor above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs & costs */}
      {tab === 'jobs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Job', 'Property', 'Contractor', 'Estimated', 'Actual', 'Invoice', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map(j => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{j.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityBadge(j.priority)}`}>{j.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{j.property}<br/>{j.unit}</td>
                  <td className="px-4 py-3">
                    {j.contractor_name
                      ? <div><p className="text-gray-900 font-medium">{j.contractor_name}</p>{j.contractor_company && <p className="text-xs text-gray-400">{j.contractor_company}</p>}</div>
                      : <span className="text-xs text-red-500 font-medium">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{j.estimated_cost != null ? `£${j.estimated_cost.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{j.actual_cost != null ? `£${j.actual_cost.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{j.invoice_ref || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(j.status)}`}>{j.status.replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setAssignModal(j); setAssignForm({ contractor_id: j.contractor_id || '', estimated_cost: j.estimated_cost || '', actual_cost: j.actual_cost || '', invoice_ref: j.invoice_ref || '' }); setAssignMsg('') }}
                      className="text-xs text-indigo-600 hover:underline font-medium">
                      {j.contractor_id ? 'Update' : 'Assign'}
                    </button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">No maintenance jobs yet.</td></tr>
              )}
            </tbody>
            {jobs.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="3" className="px-4 py-2.5 text-xs font-medium text-gray-500">Totals</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-700">£{totalEstimated.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-gray-900">£{totalSpend.toLocaleString()}</td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Add/edit contractor modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-5">{editId ? 'Edit Contractor' : 'Add Contractor'}</h3>
            <form onSubmit={saveContractor} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                  <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                  <input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Smith Plumbing Ltd" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Trade</label>
                  <select value={form.trade} onChange={e => setForm({...form, trade: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select trade…</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="07700 900000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="john@smithplumbing.co.uk" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Preferred for emergency callouts, etc." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                  {editId ? 'Save Changes' : 'Add Contractor'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enable portal modal */}
      {portalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Enable Contractor Portal</h3>
            <p className="text-sm text-gray-500 mb-5">
              {portalModal.full_name}{portalModal.email ? ` · ${portalModal.email}` : ''}
            </p>
            {!portalModal.email && (
              <p className="text-sm text-red-500 mb-4">This contractor has no email address. Add one first before enabling portal access.</p>
            )}
            <form onSubmit={handlePortalEnable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Set Portal Password</label>
                <input
                  type="password"
                  value={portalPassword}
                  onChange={e => setPortalPassword(e.target.value)}
                  required minLength={8}
                  disabled={!portalModal.email}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  placeholder="Min 6 characters"
                />
              </div>
              <p className="text-xs text-gray-400">
                The contractor will log in at <strong>/contractor/login</strong> using their email and this password.
              </p>
              {portalMsg && (
                <p className={`text-sm ${portalMsg.includes('enabled') ? 'text-green-600' : 'text-red-500'}`}>{portalMsg}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={!portalModal.email}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40">
                  Enable Portal
                </button>
                <button type="button" onClick={() => setPortalModal(null)}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign contractor modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Assign Contractor</h3>
            <p className="text-sm text-gray-500 mb-5">{assignModal.title} · {assignModal.property}, {assignModal.unit}</p>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contractor</label>
                <select value={assignForm.contractor_id} onChange={e => setAssignForm({...assignForm, contractor_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Unassigned</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` (${c.company_name})` : ''}{c.trade ? ` — ${c.trade}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost (£)</label>
                  <input type="number" step="0.01" value={assignForm.estimated_cost} onChange={e => setAssignForm({...assignForm, estimated_cost: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Actual Cost (£)</label>
                  <input type="number" step="0.01" value={assignForm.actual_cost} onChange={e => setAssignForm({...assignForm, actual_cost: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Reference</label>
                <input value={assignForm.invoice_ref} onChange={e => setAssignForm({...assignForm, invoice_ref: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="INV-2024-001" />
              </div>
              {assignMsg && <p className={`text-sm ${assignMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{assignMsg}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
