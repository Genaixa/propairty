import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import contractorApi from '../../lib/contractorApi'
import NotificationPrefs from '../../components/NotificationPrefs'
import PortalAiChat from '../../components/PortalAiChat'
import OtherPortals from '../../components/OtherPortals'
import { PageHeader } from '../../components/Illustration'
import ProfileDropdown from '../../components/ProfileDropdown'

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

function NotesThread({ job, onStatusChange }) {
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    contractorApi.get(`/jobs/${job.id}/notes`).then(r => setNotes(r.data)).catch(() => setNotes([]))
  }, [job.id])

  async function submit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      const r = await contractorApi.post(`/jobs/${job.id}/notes`, { body: body.trim() })
      setNotes(prev => [...(prev || []), r.data])
      setBody('')
    } finally {
      setSaving(false)
    }
  }

  async function markComplete() {
    setCompleting(true)
    try {
      await contractorApi.put(`/jobs/${job.id}`, { status: 'completed' })
      onStatusChange(job.id, 'completed')
    } finally {
      setCompleting(false)
    }
  }

  if (notes === null) return <p className="text-xs text-gray-400 py-2">Loading…</p>

  return (
    <div className="space-y-3">
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {notes.length === 0 && (
        <p className="text-xs text-gray-400">No notes yet — add one below.</p>
      )}
      {notes.map(n => (
        <div key={n.id} className={`flex gap-3 ${n.author_type === 'contractor' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
            n.author_type === 'contractor'
              ? 'bg-orange-600 text-white'
              : 'bg-indigo-50 border border-indigo-200 text-gray-800'
          }`}>
            <p className="font-medium text-xs mb-0.5 opacity-75">
              {n.author_type === 'agent' ? '🏢 ' : ''}{n.author_name}
            </p>
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="text-xs mt-1 opacity-60">
              {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
      </div>

      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write a note to the agent…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40"
        >
          {saving ? '…' : 'Send'}
        </button>
      </form>

      {job.status !== 'completed' && job.status !== 'cancelled' && (
        <button
          onClick={markComplete}
          disabled={completing}
          className="w-full mt-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {completing ? 'Marking complete…' : 'Mark as Complete'}
        </button>
      )}
    </div>
  )
}

function UpdateModal({ job, onClose, onUpdated }) {
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteDate, setQuoteDate] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteFile, setQuoteFile] = useState(null)
  const [submittingQuote, setSubmittingQuote] = useState(false)
  const [status, setStatus] = useState(job.status)
  const [actualCost, setActualCost] = useState(job.actual_cost ?? '')
  const [invoiceRef, setInvoiceRef] = useState(job.invoice_ref ?? '')
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showProposeDate, setShowProposeDate] = useState(false)
  const [proposedDate, setProposedDate] = useState('')
  const [proposingDate, setProposingDate] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [error, setError] = useState('')

  const canSubmitQuote = !job.contractor_quote && (job.status === 'open' || job.status === 'in_progress') && job.actual_cost == null
  const quoteRejected = job.quote_status === 'rejected'
  const quotePending = job.quote_status === 'pending'
  const quoteApproved = job.quote_status === 'approved'
  // Work phase: quote approved, OR legacy completed job with no quote system
  const showWorkPhase = (quoteApproved || (!job.contractor_quote && job.status === 'completed')) && job.status !== 'cancelled'
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  async function submitQuote(e) {
    e.preventDefault()
    setSubmittingQuote(true); setError('')
    try {
      const fd = new FormData()
      fd.append('amount', parseFloat(quoteAmount))
      fd.append('proposed_date', quoteDate)
      if (quoteNotes.trim()) fd.append('notes', quoteNotes.trim())
      if (quoteFile) fd.append('file', quoteFile)
      const token = localStorage.getItem('contractor_token')
      const res = await fetch(`/api/contractor/jobs/${job.id}/quote`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      if (!res.ok) throw new Error()
      onUpdated(); onClose()
    } catch { setError('Failed to submit quote. Please try again.') }
    finally { setSubmittingQuote(false) }
  }

  async function save() {
    if (status === 'completed' && status !== job.status) {
      // Hard block: date negotiation open — must wait for agent
      if (job.proposed_date_status === 'pending') {
        setError('Your reschedule request is still awaiting agent approval. Please wait for a confirmed date before completing.')
        return
      }
      // Soft warn: no date was ever agreed — ask contractor to confirm
      if (!job.scheduled_date && !confirmComplete) {
        setConfirmComplete(true)
        return
      }
    }
    setSaving(true); setError('')
    try {
      await contractorApi.put(`/jobs/${job.id}`, {
        status,
        actual_cost: actualCost !== '' ? parseFloat(actualCost) : null,
        invoice_ref: invoiceRef || null,
      })
      if (invoiceFile) {
        const fd = new FormData()
        fd.append('file', invoiceFile)
        if (actualCost !== '') fd.append('actual_cost', parseFloat(actualCost))
        if (invoiceRef) fd.append('invoice_ref', invoiceRef)
        const token = localStorage.getItem('contractor_token')
        setUploadingInvoice(true)
        const res = await fetch(`/api/contractor/jobs/${job.id}/invoice`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        })
        if (!res.ok) throw new Error('Invoice upload failed')
      }
      onUpdated(); onClose()
    } catch (e) { setError(e.message || 'Failed to save.') }
    finally { setSaving(false); setUploadingInvoice(false) }
  }

  async function acceptAgentDate() {
    try {
      await contractorApi.post(`/jobs/${job.id}/accept-agent-date`)
      onUpdated()
    } catch { setError('Failed to accept date.') }
  }

  async function proposeDate() {
    if (!proposedDate) return
    setProposingDate(true); setError('')
    try {
      await contractorApi.post(`/jobs/${job.id}/propose-date`, { proposed_date: proposedDate })
      onUpdated(); onClose()
    } catch { setError('Failed to propose date.') }
    finally { setProposingDate(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{job.property} · {job.unit}{job.address ? ` · ${job.address}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3 flex-shrink-0 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tenant contact */}
        {(job.tenant_name || job.tenant_phone) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔑</span>
            <div>
              <p className="text-xs font-semibold text-orange-700 mb-0.5">Tenant contact for access</p>
              {job.tenant_name && <p className="text-sm text-gray-800">{job.tenant_name}</p>}
              {job.tenant_phone && <a href={`tel:${job.tenant_phone}`} className="text-sm text-orange-600 hover:underline font-medium">{job.tenant_phone}</a>}
            </div>
          </div>
        )}

        {/* CANCELLED */}
        {job.status === 'cancelled' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center mb-4">
            <p className="text-sm font-semibold text-gray-600">This job has been cancelled</p>
            <p className="text-xs text-gray-400 mt-1">Contact the letting agent if you believe this is incorrect.</p>
          </div>
        )}

        {/* STEP 1: Submit quote (open + no quote, or rejected) */}
        {(canSubmitQuote || quoteRejected) && (
          <form onSubmit={submitQuote} className="space-y-3">
            {quoteRejected ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-red-700">Quote rejected — please resubmit</p>
                <p className="text-xs text-red-500 mt-0.5">Previous quote: £{job.contractor_quote?.toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-800">Submit your quote</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (£) *</label>
                <input type="number" step="0.01" min="0" value={quoteAmount}
                  onChange={e => setQuoteAmount(e.target.value)} placeholder="0.00" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Proposed date *</label>
                <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <input type="text" value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)}
              placeholder="Notes (scope, materials, access requirements…)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-2.5 text-sm transition-colors ${quoteFile ? 'border-orange-300 text-orange-600 bg-orange-50' : 'border-gray-300 text-gray-400 hover:border-orange-400 hover:text-orange-500'}`}>
              📎 {quoteFile ? quoteFile.name : 'Attach quote (PDF, JPG, PNG, CSV)'}
              <input type="file" accept=".pdf,.csv,.jpg,.jpeg,.png,.gif" className="hidden"
                onChange={e => setQuoteFile(e.target.files[0] || null)} />
            </label>
            {quoteFile && (
              <button type="button" onClick={() => setQuoteFile(null)} className="text-xs text-gray-400 hover:text-red-400 cursor-pointer">✕ Remove</button>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submittingQuote || !quoteAmount || !quoteDate}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 cursor-pointer">
                {submittingQuote ? 'Submitting…' : 'Submit quote & proposed date'}
              </button>
              <button type="button" onClick={onClose}
                className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
                Close
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Quote pending approval */}
        {quotePending && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-800">Quote awaiting approval</p>
                <p className="text-2xl font-bold text-amber-900">£{job.contractor_quote?.toLocaleString()}</p>
              </div>
              {job.proposed_date && (
                <p className="text-xs text-amber-700">Proposed date: <strong>{fmtDate(job.proposed_date)}</strong></p>
              )}
              {job.quote_file_url && (
                <a href={job.quote_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber-600 hover:underline font-medium">
                  📎 {job.quote_file_name || 'View attached quote'}
                </a>
              )}
              <p className="text-xs text-gray-400">The agent will review and approve. Work will be scheduled on approval.</p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={onClose}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
              Close
            </button>
          </div>
        )}

        {/* WORK PHASE: quote approved or legacy in-progress/completed */}
        {showWorkPhase && job.invoice_paid && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-green-800">Job complete — paid in full</p>
              {job.contractor_quote != null && <p className="text-xs text-green-700">Quoted: <strong>£{job.contractor_quote.toLocaleString()}</strong></p>}
              {job.actual_cost != null && <p className="text-xs text-green-700">Invoiced: <strong>£{job.actual_cost.toFixed(2)}</strong></p>}
              {job.invoice_ref && <p className="text-xs text-green-700">Ref: {job.invoice_ref}</p>}
              {job.scheduled_date && <p className="text-xs text-green-700">Completed: <strong>{fmtDate(job.scheduled_date)}</strong></p>}
              {job.invoice_file_url && (
                <a href={job.invoice_file_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-green-600 hover:underline font-medium">
                  📎 {job.invoice_file_name || 'View invoice'}
                </a>
              )}
            </div>
            <button onClick={onClose}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
              Close
            </button>
          </div>
        )}

        {showWorkPhase && !job.invoice_paid && (
          <div className="space-y-4">
            {quoteApproved && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-green-800">✓ Quote approved</p>
                  <p className="text-xl font-bold text-green-900">£{job.contractor_quote?.toLocaleString()}</p>
                </div>
                {job.scheduled_date && (
                  <p className="text-xs text-green-700">Scheduled: <strong>{fmtDate(job.scheduled_date)}</strong></p>
                )}
                {job.quote_file_url && (
                  <a href={job.quote_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-green-600 hover:underline font-medium">
                    📎 {job.quote_file_name || 'View attached quote'}
                  </a>
                )}
                {job.proposed_date_status === 'agent_proposed' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-indigo-800 font-medium">
                      Agent proposes: <strong>{fmtDate(job.proposed_date)}</strong>
                    </p>
                    {!showProposeDate ? (
                      <div className="flex gap-2">
                        <button onClick={acceptAgentDate}
                          className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700 font-semibold cursor-pointer">
                          Accept
                        </button>
                        <button onClick={() => setShowProposeDate(true)}
                          className="flex-1 text-xs bg-white border border-orange-300 text-orange-600 py-1.5 rounded-lg hover:bg-orange-50 font-semibold cursor-pointer">
                          Propose different
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <button onClick={proposeDate} disabled={proposingDate || !proposedDate}
                          className="bg-orange-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40 cursor-pointer">
                          {proposingDate ? '…' : 'Send'}
                        </button>
                        <button onClick={() => setShowProposeDate(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
                      </div>
                    )}
                  </div>
                ) : job.proposed_date_status === 'pending' ? (
                  <p className="text-xs text-amber-600 font-medium">⏳ Reschedule request sent — awaiting agent response</p>
                ) : job.proposed_date_status === 'rejected' ? (
                  <p className="text-xs text-red-500 font-medium">✗ Your proposed date was declined</p>
                ) : job.scheduled_date && (
                  !showProposeDate
                    ? <button onClick={() => setShowProposeDate(true)} className="text-xs text-green-600 underline hover:text-green-800 cursor-pointer">
                        Propose a different date
                      </button>
                    : <div className="flex items-center gap-2 flex-wrap pt-1">
                        <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <button onClick={proposeDate} disabled={proposingDate || !proposedDate}
                          className="bg-orange-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40 cursor-pointer">
                          {proposingDate ? '…' : 'Send'}
                        </button>
                        <button onClick={() => setShowProposeDate(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
                      </div>
                )}
              </div>
            )}

            {/* Status */}
            {job.status !== 'completed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Update status</label>
                <div className="flex gap-2 flex-wrap">
                  {[['in_progress', 'In Progress', 'bg-blue-600'], ['completed', 'Completed', 'bg-green-600'], ['cancelled', 'Cancelled', 'bg-gray-500']].map(([s, label, ac]) => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${status === s ? `${ac} text-white border-transparent` : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice — editable until first submitted, then read-only */}
            {job.actual_cost == null ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice amount (£)</label>
                    <input type="number" value={actualCost} onChange={e => setActualCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ref</label>
                    <input type="text" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)}
                      placeholder="INV-001"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice file</label>
                  <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-2.5 text-sm transition-colors ${invoiceFile ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'}`}>
                    📎 {invoiceFile ? invoiceFile.name : 'Attach invoice (PDF, JPG, PNG)'}
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => setInvoiceFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Invoice submitted</span>
                  <span className="text-base font-bold text-gray-800">£{parseFloat(job.actual_cost).toFixed(2)}</span>
                </div>
                {job.invoice_ref && <p className="text-xs text-gray-500">Ref: {job.invoice_ref}</p>}
                {job.invoice_file_url && (
                  <a href={job.invoice_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                    📎 {job.invoice_file_name || 'View invoice'}
                  </a>
                )}
              </div>
            )}

            {job.invoice_paid
              ? <p className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700">✓ Paid in full by agent</p>
              : job.actual_cost != null
                ? <p className="text-xs font-medium px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700">⏳ Awaiting payment from agent</p>
                : null
            }

            {error && <p className="text-sm text-red-500">{error}</p>}

            {confirmComplete && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-3">
                <p className="text-sm font-semibold text-amber-800">No date was agreed with the agent</p>
                <p className="text-xs text-amber-700">Today's date will be recorded as the completion date and a note will be added for the agent. Are you sure you want to complete this job?</p>
                <div className="flex gap-2">
                  <button onClick={save}
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 cursor-pointer">
                    Yes, complete job
                  </button>
                  <button onClick={() => setConfirmComplete(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!confirmComplete && (
              <div className="flex gap-3">
                {job.actual_cost == null && (
                  <button onClick={save} disabled={saving}
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 cursor-pointer">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
                <button onClick={onClose}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cancelled close */}
        {job.status === 'cancelled' && (
          <button onClick={onClose}
            className="w-full mt-4 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
            Close
          </button>
        )}
      </div>
    </div>
  )
}

function ContractorProfile() {
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    contractorApi.get('/profile').then(r => setProfile(r.data)).catch(() => {})
  }, [])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await contractorApi.put('/profile', profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  if (!profile) return <p className="text-sm text-gray-400">Loading…</p>

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={profile[key] || ''}
        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  )

  return (
    <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">My Profile</h3>
      <div className="grid grid-cols-2 gap-4">
        {field('Full Name', 'full_name', 'text', 'Your name')}
        {field('Company Name', 'company_name', 'text', 'Company Ltd')}
        {field('Email', 'email', 'email', 'you@company.co.uk')}
        {field('Phone', 'phone', 'tel', '07700 000000')}
        {field('Trade / Specialism', 'trade', 'text', 'e.g. Gas Engineer, Electrician')}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Certifications &amp; Notes</label>
        <textarea
          value={profile.notes || ''}
          onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))}
          rows={3}
          placeholder="Gas Safe No. 123456, NICEIC approved, etc."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
      </div>
    </form>
  )
}

function ContractorCalendar({ jobs }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })

  const { year, month } = viewMonth
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  // Index jobs by scheduled_date
  const jobsByDate = {}
  jobs.filter(j => j.scheduled_date).forEach(j => {
    const d = j.scheduled_date.slice(0, 10)
    if (!jobsByDate[d]) jobsByDate[d] = []
    jobsByDate[d].push(j)
  })

  const today = new Date().toISOString().slice(0, 10)
  const cells = []
  const startPad = (firstDay + 6) % 7 // Monday-first
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <button onClick={() => setViewMonth(v => {
          const d = new Date(v.year, v.month - 1); return { year: d.getFullYear(), month: d.getMonth() }
        })} className="text-gray-400 hover:text-gray-700 text-lg px-2">‹</button>
        <p className="text-sm font-semibold text-gray-800">{monthName}</p>
        <button onClick={() => setViewMonth(v => {
          const d = new Date(v.year, v.month + 1); return { year: d.getFullYear(), month: d.getMonth() }
        })} className="text-gray-400 hover:text-gray-700 text-lg px-2">›</button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="py-2 text-xs font-medium text-gray-400 border-b border-gray-100">{d}</div>
        ))}
        {cells.map((day, i) => {
          const dateStr = day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null
          const dayJobs = dateStr ? (jobsByDate[dateStr] || []) : []
          const isToday = dateStr === today
          return (
            <div key={i} className={`min-h-[68px] border-b border-r border-gray-100 p-1 ${!day ? 'bg-gray-50/50' : ''} ${isToday ? 'bg-orange-50' : ''}`}>
              {day && (
                <>
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-orange-600' : 'text-gray-500'}`}>{day}</p>
                  {dayJobs.map(j => (
                    <div key={j.id} title={j.title}
                      className={`text-[10px] rounded px-1 py-0.5 mb-0.5 truncate font-medium ${
                        j.status === 'completed' ? 'bg-green-100 text-green-700' :
                        j.status === 'cancelled' ? 'bg-gray-100 text-gray-400' :
                        j.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{j.title}</div>
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>
      {Object.keys(jobsByDate).length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No scheduled jobs — agent sets dates from the maintenance page.</p>
      )}
    </div>
  )
}

function ContractorMessages({ me }) {
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  function loadMsgs() {
    contractorApi.get('/messages').then(r => setMsgs(r.data)).catch(() => {})
  }

  useEffect(() => {
    loadMsgs()
    const iv = setInterval(loadMsgs, 6000)
    return () => clearInterval(iv)
  }, [])

  async function send(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      const r = await contractorApi.post('/messages', { body: body.trim() })
      setMsgs(prev => [...prev, r.data])
      setBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Messages with your letting agent</p>
      </div>
      <div className="h-96 overflow-y-auto p-4 space-y-3 flex flex-col">
        {msgs.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">No messages yet. Send one below.</p>
        )}
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.sender_type === 'contractor' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] rounded-xl px-3 py-2 text-sm ${
              m.sender_type === 'contractor'
                ? 'bg-orange-600 text-white'
                : 'bg-indigo-50 border border-indigo-200 text-gray-800'
            }`}>
              <p className="font-medium text-xs mb-0.5 opacity-75">{m.sender_name}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="text-xs mt-1 opacity-60">
                {new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-gray-100">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Message your agent…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-40"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}

// ── Next-action logic ─────────────────────────────────────────────────────────
function nextAction(job) {
  if (job.status === 'cancelled') return { label: 'Cancelled', color: 'text-gray-400' }
  if (job.status === 'completed') return { label: 'Completed', color: 'text-green-600' }
  if (job.contractor_accepted === null) return { label: 'Open to accept or decline', color: 'text-amber-700', decline: true }
  if (job.quote_status === 'rejected') return { label: 'Resubmit quote', color: 'text-red-600' }
  if (!job.contractor_quote && job.actual_cost == null) return { label: 'Submit quote', color: 'text-orange-700' }
  if (job.quote_status === 'pending') return { label: 'Quote awaiting agent approval', color: 'text-amber-600' }
  if (job.proposed_date_status === 'agent_proposed') return { label: 'Confirm proposed date', color: 'text-orange-700' }
  if (job.proposed_date_status === 'pending') return { label: 'Date proposal sent to agent', color: 'text-amber-600' }
  if (job.quote_status === 'approved' && !job.scheduled_date) return { label: 'Awaiting date from agent', color: 'text-amber-600' }
  if (job.actual_cost != null && !job.invoice_paid) return { label: 'Awaiting payment', color: 'text-amber-600' }
  if (job.status === 'in_progress' && !job.actual_cost) return { label: 'Submit invoice when done', color: 'text-blue-600' }
  return { label: 'In progress', color: 'text-blue-600' }
}

// ── Contractor CFO + Pie ───────────────────────────────────────────────────────
const PIE_COLORS = {
  'Open':        '#f59e0b',
  'In progress': '#3b82f6',
  'Completed':   '#22c55e',
  'Cancelled':   '#9ca3af',
}
function ContractorSummary({ jobs }) {
  const needsResponse = jobs.filter(j => j.contractor_accepted === null && j.status !== 'cancelled' && j.status !== 'completed').length
  const open          = jobs.filter(j => j.status === 'open').length
  const inProgress    = jobs.filter(j => j.status === 'in_progress').length
  const completed     = jobs.filter(j => j.status === 'completed').length
  const cancelled     = jobs.filter(j => j.status === 'cancelled').length
  const totalQuoted   = jobs.reduce((s, j) => s + (j.contractor_quote || 0), 0)
  const totalEarned   = jobs.filter(j => j.invoice_paid).reduce((s, j) => s + (j.actual_cost || 0), 0)
  const awaitingPay   = jobs.filter(j => j.actual_cost != null && !j.invoice_paid).reduce((s, j) => s + (j.actual_cost || 0), 0)
  const pieData = [
    { name: 'Open',        value: open },
    { name: 'In progress', value: inProgress },
    { name: 'Completed',   value: completed },
    { name: 'Cancelled',   value: cancelled },
  ].filter(d => d.value > 0)
  const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-4 flex flex-col sm:flex-row overflow-hidden">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
        {[
          { label: 'Needs response',    value: needsResponse,           warn: needsResponse > 0, mono: false },
          { label: 'Total quoted',      value: `£${fmt(totalQuoted)}`,                           mono: true  },
          { label: 'Total earned',      value: `£${fmt(totalEarned)}`,                           mono: true  },
          { label: 'Awaiting payment',  value: `£${fmt(awaitingPay)}`,  warn: awaitingPay > 0,   mono: true  },
        ].map(({ label, value, mono, warn }) => (
          <div key={label} className="px-5 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
            <p className={`text-lg font-bold ${warn ? 'text-amber-600' : 'text-gray-800'} ${mono ? 'font-mono' : ''}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 px-6 py-4 border-t sm:border-t-0 sm:border-l border-gray-100">
        <ResponsiveContainer width={90} height={90}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
              {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[d.name]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1.5 min-w-[130px]">
          {pieData.map(d => (
            <div key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[d.name] }} />
              <span>{d.name}</span>
              <span className="ml-auto font-semibold text-gray-800">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CONTRACTOR_NAV_ICONS = {
  jobs:          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.5-1.021l1.2-1.2a6 6 0 00-8.485-8.485l1.2 1.2m5.5 1.021a5.97 5.97 0 00-1.2-1.2m0 0l-1.786 1.786"/></svg>,
  messages:      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>,
  calendar:      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>,
  profile:       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>,
  notifications: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>,
}

const NAV = [
  { key: 'jobs',          label: 'Jobs' },
  { key: 'messages',      label: 'Messages' },
  { key: 'calendar',      label: 'Calendar' },
  { key: 'profile',       label: 'Profile' },
  { key: 'notifications', label: 'Alerts' },
]

export default function ContractorPortal() {
  const [me, setMe] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updateJob, setUpdateJob] = useState(null)
  const [mainTab, setMainTab] = useState('jobs')
  const [msgUnread, setMsgUnread] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [portalFeatures, setPortalFeatures] = useState({})
  const navigate = useNavigate()

  function load() {
    contractorApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    contractorApi.get('/jobs')
      .then(r => setJobs(r.data))
      .finally(() => setLoading(false))
    contractorApi.get('/features').then(r => setPortalFeatures(r.data)).catch(() => {})
  }

  useEffect(load, [])

  useEffect(() => {
    function pollUnread() {
      contractorApi.get('/messages/unread-count').then(r => setMsgUnread(r.data.count)).catch(() => {})
    }
    pollUnread()
    const iv = setInterval(pollUnread, 15000)
    return () => clearInterval(iv)
  }, [])

  function logout() {
    localStorage.removeItem('contractor_token')
    navigate('/contractor/login')
  }

  function handleStatusChange(jobId, newStatus) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
  }

  const filtered = jobs
    .filter(j => {
      if (filter === 'active') return j.status === 'open' || j.status === 'in_progress'
      if (filter === 'completed') return j.status === 'completed'
      if (filter === 'cancelled') return j.status === 'cancelled'
      return true
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const CONTRACTOR_FLAGS = {
    'messages': 'contractor_messages',
    'calendar': 'contractor_calendar',
  }
  const visibleNAV = NAV.filter(item => {
    const flag = CONTRACTOR_FLAGS[item.key]
    if (!flag) return true
    return portalFeatures[flag] !== false
  })

  const sidebarNav = (
    <nav className="bg-orange-950 rounded-xl overflow-hidden">
      {visibleNAV.map(item => (
        <button key={item.key}
          onClick={() => { setMainTab(item.key); setSidebarOpen(false); if (item.key === 'messages') setMsgUnread(0) }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer
            ${mainTab === item.key ? 'bg-orange-600 text-white' : 'text-orange-300 hover:bg-orange-900 hover:text-white'}`}>
          <span className="shrink-0 opacity-80">{CONTRACTOR_NAV_ICONS[item.key]}</span>
          <span className="flex-1">{item.label}</span>
          {item.key === 'messages' && msgUnread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {msgUnread > 9 ? '9+' : msgUnread}
            </span>
          )}
        </button>
      ))}
      {/* Footer: name display */}
      {me && (
        <div className="border-t border-orange-900 px-4 py-3 mt-1">
          <p className="text-xs font-semibold text-white truncate">{me.full_name}</p>
          <p className="text-xs text-orange-400 truncate">{me.company_name || me.email}</p>
        </div>
      )}
    </nav>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button onClick={() => setSidebarOpen(v => !v)}
            className="sm:hidden p-2 -ml-1 text-gray-500 hover:text-orange-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => { setMainTab('jobs'); setSidebarOpen(false) }} className="text-left">
            <h1 className="text-xl font-bold text-orange-600 hover:opacity-80 transition-opacity">
              Prop<span className="text-gray-900">AI</span>rty
              <span className="hidden sm:inline text-sm font-normal text-gray-400 ml-2">Contractor Portal</span>
            </h1>
          </button>
        </div>

        {/* Profile dropdown */}
        {me && (
          <ProfileDropdown
            me={me}
            onUpdate={async patch => { const r = await contractorApi.patch('/me', patch); setMe(m => ({ ...m, ...r.data })) }}
            onPassword={async ({ current, next }) => contractorApi.post('/me/change-password', { current_password: current, new_password: next })}
            onLogout={logout}
            accentRing="focus:ring-orange-500"
            btnClass="bg-orange-600 hover:bg-orange-700"
          />
        )}
      </header>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-6 items-start">
        {/* Left sidebar — desktop always visible, mobile drawer */}
        <aside className={`
          sm:w-52 sm:flex-shrink-0 sm:sticky sm:top-6
          fixed inset-y-0 left-0 z-40 w-64 bg-gray-50 sm:bg-transparent pt-0 sm:pt-0 overflow-y-auto sm:overflow-visible
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        `}>
          {/* Mobile close button */}
          <div className="sm:hidden flex items-center justify-between px-4 py-4 bg-orange-950">
            <span className="text-orange-400 font-bold text-sm">Prop<span className="text-white">AI</span>rty</span>
            <button onClick={() => setSidebarOpen(false)} className="text-orange-300 hover:text-white text-xl">&times;</button>
          </div>
          <div className="px-4 sm:px-0 py-4 sm:py-0">
            {sidebarNav}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-6">
        {mainTab === 'notifications' && (
          <div>
            <PageHeader title="Notification Preferences" subtitle="Choose how you want to receive alerts and updates" />
            <NotificationPrefs
              getUrl="/api/contractor/notification-prefs"
              putUrl="/api/contractor/notification-prefs"
              tokenKey="contractor_token"
            />
          </div>
        )}

        {mainTab === 'messages' && (
          <div>
            <PageHeader title="Messages" subtitle="Direct messages with the letting agency" />
            <ContractorMessages me={me} />
          </div>
        )}
        {mainTab === 'profile' && (
          <div>
            <PageHeader title="My Profile" subtitle="Update your company details and trade information" />
            <ContractorProfile />
          </div>
        )}
        {mainTab === 'calendar' && (
          <div>
            <PageHeader title="Job Calendar" subtitle="Scheduled and upcoming jobs at a glance" />
            <ContractorCalendar jobs={jobs} />
          </div>
        )}

        {mainTab === 'jobs' && (<>
          <PageHeader title="My Jobs" subtitle="Active, completed, and cancelled maintenance jobs" />

          <ContractorSummary jobs={jobs} />

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {[['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Job table */}
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <div className="w-7 h-7 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading jobs…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">{filter === 'active' ? 'No active jobs — check back later.' : 'No jobs to show.'}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium">Job</th>
                    <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                    <th className="text-left px-4 py-2.5 font-medium">Reported</th>
                    <th className="text-left px-4 py-2.5 font-medium">Scheduled</th>
                    <th className="text-left px-4 py-2.5 font-medium">Quote</th>
                    <th className="text-left px-4 py-2.5 font-medium">Payment</th>
                    <th className="text-left px-4 py-2.5 font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(job => {
                    const na = nextAction(job)
                    const isNew = job.contractor_accepted === null && job.status !== 'cancelled' && job.status !== 'completed'
                    return (
                      <tr key={job.id}
                        onClick={() => {
                          setUpdateJob(job)
                          if (!job.contractor_viewed_at) {
                            contractorApi.post(`/jobs/${job.id}/viewed`).catch(() => {})
                            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, contractor_viewed_at: new Date().toISOString() } : j))
                          }
                        }}
                        className={`border-b border-gray-100 hover:bg-orange-50/40 cursor-pointer transition-colors ${isNew ? 'bg-amber-50/60' : ''}`}>
                        {/* Job */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {isNew && <span className="mt-0.5 flex-shrink-0 text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">NEW</span>}
                            <div>
                              <p className="font-medium text-gray-900 leading-snug">{job.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{job.property} · {job.unit}</p>
                              {job.address && <p className="text-xs text-gray-400">{job.address}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Priority */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[job.priority] || 'bg-gray-100 text-gray-600'}`}>
                            {job.priority}
                          </span>
                        </td>
                        {/* Reported */}
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {/* Scheduled */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {job.scheduled_date
                            ? <span className="text-blue-600 font-medium">{new Date(job.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Quote */}
                        <td className="px-4 py-3 text-xs">
                          {job.contractor_quote != null ? (
                            <div>
                              <span className="font-semibold text-gray-800">£{job.contractor_quote.toLocaleString()}</span>
                              {job.quote_status === 'approved' && <p className="text-green-600 font-medium">approved</p>}
                              {job.quote_status === 'pending'  && <p className="text-amber-600">awaiting approval</p>}
                              {job.quote_status === 'rejected' && <p className="text-red-500">rejected</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Payment */}
                        <td className="px-4 py-3 text-xs">
                          {job.actual_cost != null ? (
                            <div>
                              <span className="font-semibold text-gray-800">£{job.actual_cost.toFixed(2)}</span>
                              {job.invoice_paid
                                ? <p className="text-green-600 font-medium">paid</p>
                                : <p className="text-amber-600">unpaid</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Next action */}
                        <td className="px-4 py-3" onClick={e => na.decline && e.stopPropagation()}>
                          {na.decline ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-amber-700">Open to accept</span>
                              <button onClick={async () => { await contractorApi.post(`/jobs/${job.id}/decline`); load() }}
                                className="text-xs border border-red-300 text-red-500 px-2 py-0.5 rounded hover:bg-red-50 cursor-pointer font-medium">
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs font-medium ${na.color}`}>{na.label}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>)}
        </main>
      </div>

      {updateJob && (
        <UpdateModal
          job={updateJob}
          onClose={() => setUpdateJob(null)}
          onUpdated={load}
        />
      )}
      <OtherPortals current="contractor" />
      <PortalAiChat
        apiUrl="/api/contractor/ai-chat"
        tokenKey="contractor_token"
        name="Wendy"
        color="orange"
        suggestions={[
          "How many active jobs do I have?",
          "What are my highest priority jobs?",
          "Show me jobs that are in progress",
          "What's the address for my next job?",
        ]}
      />
    </div>
  )
}
