import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import contractorApi from '../../lib/contractorApi'

const PRIORITY_BADGE = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}
const STATUS_BADGE = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function UpdateModal({ job, onClose, onUpdated }) {
  const [status, setStatus] = useState(job.status)
  const [actualCost, setActualCost] = useState(job.actual_cost ?? '')
  const [invoiceRef, setInvoiceRef] = useState(job.invoice_ref ?? '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      await contractorApi.put(`/jobs/${job.id}`, {
        status,
        actual_cost: actualCost !== '' ? parseFloat(actualCost) : null,
        invoice_ref: invoiceRef || null,
        completion_notes: notes || null,
      })
      onUpdated()
      onClose()
    } catch (e) {
      setError('Failed to update job. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Update Job</h2>
        <p className="text-sm text-gray-500 mb-5">{job.title} · {job.property} · {job.unit}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex gap-2">
              {['in_progress', 'completed', 'cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    status === s
                      ? s === 'completed' ? 'bg-green-600 text-white border-green-600'
                        : s === 'cancelled' ? 'bg-gray-500 text-white border-gray-500'
                        : 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cost (£)</label>
              <input
                type="number"
                value={actualCost}
                onChange={e => setActualCost(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Ref</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={e => setInvoiceRef(e.target.value)}
                placeholder="INV-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Completion Notes <span className="text-gray-400 font-normal">(visible to agent)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe work done, any follow-up required, parts used…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Update'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContractorPortal() {
  const [me, setMe] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [updateJob, setUpdateJob] = useState(null)
  const navigate = useNavigate()

  function load() {
    contractorApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    contractorApi.get('/jobs')
      .then(r => setJobs(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function logout() {
    localStorage.removeItem('contractor_token')
    navigate('/contractor/login')
  }

  const filtered = jobs.filter(j => {
    if (filter === 'active') return j.status === 'open' || j.status === 'in_progress'
    if (filter === 'completed') return j.status === 'completed'
    if (filter === 'all') return true
    return true
  })

  const activeCount = jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length
  const completedCount = jobs.filter(j => j.status === 'completed').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-orange-600">
            Prop<span className="text-gray-900">AI</span>rty
            <span className="text-sm font-normal text-gray-500 ml-2">Contractor Portal</span>
          </h1>
          {me && (
            <p className="text-xs text-gray-400 mt-0.5">
              {me.full_name}{me.company_name ? ` · ${me.company_name}` : ''}{me.trade ? ` · ${me.trade}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-1">Active Jobs</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{jobs.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Assigned</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Job list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading jobs…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">
              {filter === 'active' ? 'No active jobs — check back later.' : 'No jobs to show.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600'}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[job.priority] || 'bg-gray-100 text-gray-600'}`}>
                        {job.priority}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{job.property} · {job.unit}</p>
                    <p className="text-xs text-gray-400">{job.address}</p>
                    {job.description && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{job.description}</p>
                    )}
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      {job.estimated_cost != null && (
                        <span>Est: <strong>£{job.estimated_cost.toFixed(2)}</strong></span>
                      )}
                      {job.actual_cost != null && (
                        <span>Actual: <strong className="text-gray-800">£{job.actual_cost.toFixed(2)}</strong></span>
                      )}
                      {job.invoice_ref && (
                        <span>Inv: <strong>{job.invoice_ref}</strong></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Assigned {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {job.status !== 'cancelled' && job.status !== 'completed' && (
                    <button
                      onClick={() => setUpdateJob(job)}
                      className="shrink-0 bg-orange-50 text-orange-600 hover:bg-orange-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Update
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <span className="shrink-0 text-green-600 text-xl">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {updateJob && (
        <UpdateModal
          job={updateJob}
          onClose={() => setUpdateJob(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
