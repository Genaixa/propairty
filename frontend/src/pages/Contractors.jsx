import { PageHeader } from '../components/Illustration'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

function Stars({ rating, count }) {
  if (rating == null) return <span className="text-xs text-gray-400">No reviews</span>
  const full = Math.round(rating)
  return (
    <div className="flex items-center gap-1">
      <span className="flex gap-0.5">
        {[1,2,3,4,5].map(n => (
          <span key={n} className={`text-sm ${n <= full ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
        ))}
      </span>
      <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({count})</span>
    </div>
  )
}

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
  const [reviewsModal, setReviewsModal] = useState(null) // { contractor, data }
  const [loadingReviews, setLoadingReviews] = useState(false)
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
  const [cSort, setCSort] = useState({ col: 'full_name', dir: 'asc' })
  const [jSort, setJSort] = useState({ col: 'created_at', dir: 'desc' })
  const [jobFilter, setJobFilter] = useState('all') // 'all' | 'open' | 'unassigned'
  const [searchParams, setSearchParams] = useSearchParams()
  const [tradeFilter, setTradeFilter] = useState(searchParams.get('trade') || '')

  function toggleSort(sort, setSort, col) {
    setSort(s => ({ col, dir: s.col === col ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  }

  function SortTh({ col, label, sort, setSort }) {
    return (
      <th onClick={() => toggleSort(sort, setSort, col)}
        className="text-left px-5 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
        {label} {sort.col === col ? (sort.dir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
      </th>
    )
  }

  function SortThSm({ col, label, sort, setSort }) {
    return (
      <th onClick={() => toggleSort(sort, setSort, col)}
        className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
        {label} {sort.col === col ? (sort.dir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
      </th>
    )
  }

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

  async function openReviews(contractor) {
    setLoadingReviews(true)
    setReviewsModal({ contractor, data: null })
    try {
      const r = await api.get(`/contractors/${contractor.id}/reviews`)
      setReviewsModal({ contractor, data: r.data })
    } catch {
      setReviewsModal({ contractor, data: { avg_rating: null, review_count: 0, reviews: [] } })
    } finally {
      setLoadingReviews(false)
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
      load()
      setAssignModal(null)
    } catch (err) {
      setAssignMsg(err.response?.data?.detail || 'Failed to update')
    }
  }

  // When a trade filter is active, scope stats to that trade's contractor IDs only
  const tradeContractorIds = tradeFilter
    ? new Set(contractors.filter(c => (c.trade || '').toLowerCase() === tradeFilter.toLowerCase()).map(c => c.id))
    : null
  const scopedJobs = tradeContractorIds
    ? jobs.filter(j => j.contractor_id && tradeContractorIds.has(j.contractor_id))
    : jobs

  const totalSpend     = scopedJobs.reduce((s, j) => s + (j.actual_cost || 0), 0)
  const totalEstimated = scopedJobs.reduce((s, j) => s + (j.estimated_cost || 0), 0)
  const openJobs  = scopedJobs.filter(j => j.status === 'open' || j.status === 'in_progress').length
  const unassigned = jobs.filter(j => !j.contractor_id && (j.status === 'open' || j.status === 'in_progress')).length

  const filteredContractors = tradeFilter
    ? contractors.filter(c => (c.trade || '').toLowerCase() === tradeFilter.toLowerCase())
    : contractors

  const sortedContractors = [...filteredContractors].sort((a, b) => {
    const cJobs = id => jobs.filter(j => j.contractor_id === id)
    let av, bv
    if      (cSort.col === 'full_name')   { av = a.full_name;          bv = b.full_name }
    else if (cSort.col === 'trade')       { av = a.trade || '';        bv = b.trade || '' }
    else if (cSort.col === 'jobs')        { av = cJobs(a.id).length;   bv = cJobs(b.id).length }
    else if (cSort.col === 'rating')      { av = a.avg_rating ?? -1;   bv = b.avg_rating ?? -1 }
    else                                  { av = a[cSort.col] || '';   bv = b[cSort.col] || '' }
    if (av < bv) return cSort.dir === 'asc' ? -1 : 1
    if (av > bv) return cSort.dir === 'asc' ? 1 : -1
    return 0
  })

  const filteredJobs = jobs.filter(j => {
    if (jobFilter === 'open') return j.status === 'open' || j.status === 'in_progress'
    if (jobFilter === 'unassigned') return !j.contractor_id && (j.status === 'open' || j.status === 'in_progress')
    return true
  })

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    // Always float unassigned to top
    const aUnassigned = !a.contractor_id ? 0 : 1
    const bUnassigned = !b.contractor_id ? 0 : 1
    if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned
    let av, bv
    if      (jSort.col === 'title')       { av = a.title;                   bv = b.title }
    else if (jSort.col === 'property')    { av = a.property || '';          bv = b.property || '' }
    else if (jSort.col === 'contractor')  { av = a.contractor_name || '';   bv = b.contractor_name || '' }
    else if (jSort.col === 'estimated')   { av = a.estimated_cost ?? -1;    bv = b.estimated_cost ?? -1 }
    else if (jSort.col === 'actual')      { av = a.actual_cost ?? -1;       bv = b.actual_cost ?? -1 }
    else if (jSort.col === 'status')      { av = a.status;                  bv = b.status }
    else                                  { av = a[jSort.col] || '';        bv = b[jSort.col] || '' }
    if (av < bv) return jSort.dir === 'asc' ? -1 : 1
    if (av > bv) return jSort.dir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div>
      <PageHeader title="Contractors" subtitle="Your trusted trades & service providers">
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ full_name: '', company_name: '', trade: '', email: '', phone: '', notes: '' }) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Contractor
        </button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Contractors</p>
          <p className="text-2xl font-bold mt-1 text-indigo-600">{contractors.length}</p>
        </div>
        <button
          onClick={() => { setTab('jobs'); setJobFilter('open') }}
          className={`rounded-xl border p-4 text-left transition-colors hover:border-yellow-400 hover:bg-yellow-50
            ${jobFilter === 'open' && tab === 'jobs' ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-gray-200'}`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide">Open Jobs</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">{openJobs}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click to filter</p>
        </button>
        <button
          onClick={() => { setTab('jobs'); setJobFilter('unassigned') }}
          className={`rounded-xl border p-4 text-left transition-colors hover:border-red-300 hover:bg-red-50
            ${jobFilter === 'unassigned' && tab === 'jobs' ? 'bg-red-50 border-red-400' : 'bg-white border-gray-200'}`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wide">Unassigned</p>
          <p className={`text-2xl font-bold mt-1 ${unassigned > 0 ? 'text-red-600' : 'text-gray-600'}`}>{unassigned}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click to filter</p>
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Spend</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">£{totalSpend.toLocaleString()}</p>
        </div>
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
          {tradeFilter && (
            <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <span className="text-xs font-medium text-indigo-800">
                Filtered by trade: <strong>{tradeFilter}</strong> · {filteredContractors.length} contractor{filteredContractors.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => { setTradeFilter(''); setSearchParams({}) }} className="text-xs text-indigo-500 hover:text-indigo-700 ml-1">× Clear</button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortTh col="full_name" label="Name / Company" sort={cSort} setSort={setCSort} />
                <SortTh col="trade" label="Trade" sort={cSort} setSort={setCSort} />
                <th className="text-left px-5 py-3 font-medium text-gray-500">Contact</th>
                <SortTh col="jobs" label="Jobs" sort={cSort} setSort={setCSort} />
                <SortTh col="rating" label="Rating" sort={cSort} setSort={setCSort} />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedContractors.map(c => {
                const cJobs = jobs.filter(j => j.contractor_id === c.id)
                const cSpend = cJobs.reduce((s, j) => s + (j.actual_cost || 0), 0)
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt={c.full_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                          : <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">{c.full_name[0]}</div>
                        }
                        <div>
                          <Link to={`/contractors/${c.id}`} className="font-medium text-gray-900 hover:text-indigo-600 hover:underline">{c.full_name}</Link>
                          {c.company_name && <p className="text-xs text-gray-500">{c.company_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.trade ? <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{c.trade}</span> : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {c.phone && <p><a href={`tel:${c.phone}`} className="hover:text-indigo-600">{c.phone}</a></p>}
                      {c.email && <p className="text-xs"><a href={`mailto:${c.email}`} className="hover:text-indigo-600">{c.email}</a></p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      <p>{cJobs.length} job{cJobs.length !== 1 ? 's' : ''}</p>
                      {cSpend > 0 && <p className="text-xs text-gray-400">£{cSpend.toLocaleString()} spent</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => openReviews(c)} className="hover:opacity-80 transition-opacity text-left">
                        <Stars rating={c.avg_rating} count={c.review_count} />
                      </button>
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
              {filteredContractors.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">
                  {tradeFilter ? `No ${tradeFilter} contractors yet. Add one above.` : 'No contractors yet. Add your first contractor above.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Jobs & costs */}
      {tab === 'jobs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {jobFilter !== 'all' && (
            <div className="px-4 py-2.5 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
              <span className="text-xs font-medium text-yellow-800">
                {jobFilter === 'open' ? 'Showing: Open jobs' : 'Showing: Unassigned jobs'} · {filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setJobFilter('all')} className="text-xs text-yellow-600 hover:text-yellow-800 ml-1">× Clear filter</button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortThSm col="title" label="Job" sort={jSort} setSort={setJSort} />
                <SortThSm col="property" label="Property" sort={jSort} setSort={setJSort} />
                <SortThSm col="contractor" label="Contractor" sort={jSort} setSort={setJSort} />
                <SortThSm col="estimated" label="Estimated" sort={jSort} setSort={setJSort} />
                <SortThSm col="actual" label="Actual" sort={jSort} setSort={setJSort} />
                <th className="text-left px-4 py-3 font-medium text-gray-500">Invoice</th>
                <SortThSm col="status" label="Status" sort={jSort} setSort={setJSort} />
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedJobs.map(j => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/maintenance`} state={{ jobId: j.id }} className="font-medium text-indigo-600 hover:underline">{j.title}</Link>
                    <span className={`block text-xs px-1.5 py-0.5 rounded-full font-medium w-fit mt-0.5 ${priorityBadge(j.priority)}`}>{j.priority}</span>
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
              {filteredJobs.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">
                  {jobs.length === 0 ? 'No maintenance jobs yet.' : 'No jobs match the current filter.'}
                </td></tr>
              )}
            </tbody>
            {filteredJobs.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="3" className="px-4 py-2.5 text-xs font-medium text-gray-500">
                    Totals{jobFilter !== 'all' ? ' (filtered)' : ''}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-700">
                    £{filteredJobs.reduce((s,j) => s + (j.estimated_cost||0), 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold text-gray-900">
                    £{filteredJobs.reduce((s,j) => s + (j.actual_cost||0), 0).toLocaleString()}
                  </td>
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

      {/* Reviews modal */}
      {reviewsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{reviewsModal.contractor.full_name}</h3>
                {reviewsModal.contractor.company_name && <p className="text-sm text-gray-500">{reviewsModal.contractor.company_name}</p>}
                {reviewsModal.data && (
                  <div className="mt-2">
                    <Stars rating={reviewsModal.data.avg_rating} count={reviewsModal.data.review_count} />
                  </div>
                )}
              </div>
              <button onClick={() => setReviewsModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {loadingReviews && (
                <p className="px-6 py-8 text-sm text-gray-400 text-center">Loading reviews…</p>
              )}
              {!loadingReviews && reviewsModal.data?.reviews?.length === 0 && (
                <p className="px-6 py-8 text-sm text-gray-400 text-center">No reviews yet.</p>
              )}
              {!loadingReviews && reviewsModal.data?.reviews?.map(r => (
                <div key={r.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.reviewer_type === 'tenant' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {r.reviewer_type === 'tenant' ? '🏠 Tenant' : '🏢 Agent'}
                      </span>
                      <span className="text-xs text-gray-500">{r.reviewer_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                  </div>
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={`text-base ${n <= r.stars ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 italic">"{r.comment}"</p>}
                </div>
              ))}
            </div>
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
