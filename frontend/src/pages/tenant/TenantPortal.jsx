import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import tenantApi from '../../lib/tenantApi'
import { dlUrl } from '../../lib/api'
import NotificationPrefs from '../../components/NotificationPrefs'
import PortalAiChat from '../../components/PortalAiChat'
import OtherPortals from '../../components/OtherPortals'
import { PageHeader } from '../../components/Illustration'
import ProfileDropdown from '../../components/ProfileDropdown'

const BASE_TABS = ['My Property', 'Payments', 'Messages', 'Maintenance', 'My Lease', 'Documents', 'Deposit', 'Rent Statement', 'Meters', 'Inspections', 'Utilities', 'Emergency', 'Referencing', 'RTR', 'Move Out', 'Notices']

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

function SignatureModal({ doc, onClose, onSigned }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [signing, setSigning] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    const src = touch || e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    drawing.current = true
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e1b4b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setHasDrawn(true)
  }

  function stopDraw(e) {
    e.preventDefault()
    drawing.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function submitSignature() {
    if (!hasDrawn) return
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    setSigning(true)
    try {
      await tenantApi.post(`/portal/documents/${doc.id}/sign`, { signature_data: dataUrl })
      onSigned(doc.id)
      onClose()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to sign document')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Sign Document</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{doc.original_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-3">Draw your signature in the box below:</p>
          <canvas
            ref={canvasRef}
            width={380}
            height={160}
            className="border-2 border-dashed border-gray-300 rounded-xl w-full touch-none cursor-crosshair bg-gray-50"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <p className="text-xs text-gray-400 mt-1.5">Sign with your mouse or finger</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={clearCanvas} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
            Clear
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 px-4 py-2 rounded-lg">
            Cancel
          </button>
          <button
            onClick={submitSignature}
            disabled={!hasDrawn || signing}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {signing ? 'Signing…' : 'Sign Document'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StarPicker({ value, onChange, color = 'text-yellow-400' }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className={`text-2xl transition-transform hover:scale-110 ${n <= (hovered || value) ? color : 'text-gray-300'}`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-500 self-center">{['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][value]}</span>
      )}
    </div>
  )
}

function MaintenanceNotesThread({ job, onResponded }) {
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [satisfaction, setSatisfaction] = useState(job.tenant_satisfied) // true | false | null
  const [showUnhappyForm, setShowUnhappyForm] = useState(false)
  const [showHappyForm, setShowHappyForm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef(null)

  function fetchNotes() {
    tenantApi.get(`/portal/maintenance/${job.id}/notes`)
      .then(r => setNotes(prev => {
        if (!prev || r.data.length !== prev.length) return r.data
        return prev
      }))
      .catch(() => {})
  }

  useEffect(() => {
    tenantApi.get(`/portal/maintenance/${job.id}/notes`)
      .then(r => setNotes(r.data))
      .catch(() => setNotes([]))
    const interval = setInterval(fetchNotes, 4000)
    return () => clearInterval(interval)
  }, [job.id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [notes])

  async function submitNote(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    try {
      const r = await tenantApi.post(`/portal/maintenance/${job.id}/notes`, { body: body.trim() })
      setNotes(prev => [...(prev || []), r.data])
      setBody('')
    } finally {
      setSaving(false)
    }
  }

  async function handleSatisfied(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await tenantApi.post(`/portal/maintenance/${job.id}/satisfy`, {
        satisfied: true,
        stars: stars || 5,
        comment: comment.trim() || null,
      })
      setSatisfaction(true)
      onResponded(job.id, true, null)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnhappy(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await tenantApi.post(`/portal/maintenance/${job.id}/satisfy`, {
        satisfied: false,
        feedback: feedback.trim() || null,
        stars: stars || 1,
        comment: feedback.trim() || null,
      })
      setSatisfaction(false)
      onResponded(job.id, false, feedback.trim() || null)
    } finally {
      setSubmitting(false)
    }
  }

  if (notes === null) return <p className="text-xs text-gray-400 py-2">Loading…</p>

  const awaitingResponse = job.status === 'completed' && satisfaction === null

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {notes.length === 0 && (
        <p className="text-xs text-gray-400">No messages yet.</p>
      )}
      {notes.map(n => {
        const isMine = n.author_type === 'tenant'
        return (
          <div key={n.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
              isMine
                ? 'bg-violet-600 text-white'
                : n.author_type === 'contractor'
                  ? 'bg-orange-50 border border-orange-200 text-gray-800'
                  : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="font-medium text-xs mb-0.5 opacity-75">
                {n.author_type === 'contractor' ? '🔧 ' : n.author_type === 'agent' ? '🏢 ' : ''}{n.author_name}
              </p>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs mt-1 opacity-60">
                {new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        )
      })}
      </div>

      <form onSubmit={submitNote} className="flex gap-2 pt-1">
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40"
        >
          {saving ? '…' : 'Send'}
        </button>
      </form>

      {/* Satisfaction section — only when completed and not yet responded */}
      {awaitingResponse && !showHappyForm && !showUnhappyForm && (
        <div className="pt-1 space-y-2">
          <p className="text-xs text-gray-500 font-medium">Are you happy with how this was resolved?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowHappyForm(true); setStars(5) }}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
            >
              Yes, all sorted
            </button>
            <button
              onClick={() => { setShowUnhappyForm(true); setStars(1) }}
              className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50"
            >
              Not happy
            </button>
          </div>
        </div>
      )}

      {awaitingResponse && showHappyForm && (
        <form onSubmit={handleSatisfied} className="pt-1 space-y-3">
          <p className="text-xs text-gray-500 font-medium">Great! How would you rate the work?</p>
          <StarPicker value={stars} onChange={setStars} color="text-yellow-400" />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="Any comments? (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !stars}
              className="flex-1 bg-violet-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
            <button type="button" onClick={() => setShowHappyForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Back
            </button>
          </div>
        </form>
      )}

      {awaitingResponse && showUnhappyForm && (
        <form onSubmit={handleUnhappy} className="pt-1 space-y-3">
          <p className="text-xs text-gray-500 font-medium">Please tell us what's still wrong — your agent will be notified immediately.</p>
          <StarPicker value={stars} onChange={setStars} color="text-red-400" />
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={3}
            placeholder="Describe the problem…"
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Submit complaint'}
            </button>
            <button type="button" onClick={() => setShowUnhappyForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Back
            </button>
          </div>
        </form>
      )}

      {/* Already responded */}
      {satisfaction === true && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm font-medium">
          <span>✓</span> You confirmed you're happy with this resolution
        </div>
      )}
      {satisfaction === false && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
          <p className="font-semibold">Your complaint has been raised — your agent has been alerted.</p>
          {(job.tenant_feedback || feedback) && (
            <p className="text-xs mt-1 opacity-80">{job.tenant_feedback || feedback}</p>
          )}
        </div>
      )}
    </div>
  )
}

function TriageCard({ triage }) {
  const severityStyle = {
    minor:     'bg-green-50 border-green-200 text-green-700',
    moderate:  'bg-amber-50 border-amber-200 text-amber-700',
    urgent:    'bg-orange-50 border-orange-200 text-orange-700',
    emergency: 'bg-red-50 border-red-200 text-red-700',
  }[triage.severity] || 'bg-gray-50 border-gray-200 text-gray-600'

  return (
    <div className="mt-2 rounded-lg border bg-indigo-50 border-indigo-100 p-3 text-left max-w-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-indigo-500 text-sm">🔍</span>
        <span className="text-xs font-semibold text-indigo-700">AI Diagnosis</span>
        <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${severityStyle}`}>
          {triage.severity}
        </span>
      </div>
      <p className="text-xs text-gray-700 leading-snug">{triage.diagnosis}</p>
      {triage.self_fix_possible && triage.self_fix_tip && (
        <div className="mt-2 bg-green-50 border border-green-100 rounded p-2">
          <p className="text-[10px] font-semibold text-green-700 mb-0.5">💡 You may be able to fix this yourself:</p>
          <p className="text-xs text-gray-600">{triage.self_fix_tip}</p>
        </div>
      )}
      {!triage.self_fix_possible && triage.contractor_needed && (
        <p className="mt-1.5 text-[10px] font-medium text-amber-600">
          🔧 {triage.contractor_type ? triage.contractor_type.charAt(0).toUpperCase() + triage.contractor_type.slice(1) : 'Contractor'} recommended
        </p>
      )}
    </div>
  )
}

const statusBadge = status => {
  const map = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-500',
    terminated: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
    open: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export default function TenantPortal() {
  const [tab, setTab] = useState('My Property')
  const [me, setMe] = useState(null)
  const [lease, setLease] = useState(null)
  const [payments, setPayments] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [newJob, setNewJob] = useState({ title: '', description: '', priority: 'medium' })
  const [newJobPhotos, setNewJobPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [payError, setPayError] = useState('')
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [renewal, setRenewal] = useState(null)
  const [renewalResponse, setRenewalResponse] = useState(null)
  const [notices, setNotices] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [documents, setDocuments] = useState([])
  const [complianceCerts, setComplianceCerts] = useState([])
  const [signingDoc, setSigningDoc] = useState(null)
  const [deposit, setDeposit] = useState(null)
  const [inspections, setInspections] = useState([])
  const [propertyInfo, setPropertyInfo] = useState(null)
  const [myProperty, setMyProperty] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [rentStatement, setRentStatement] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgBody, setMsgBody] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgUnread, setMsgUnread] = useState(0)
  const [rtr, setRtr] = useState(null)
  const [meterReadings, setMeterReadings] = useState([])
  const [meterForm, setMeterForm] = useState({ meter_type: 'electricity', reading: '', reading_date: new Date().toISOString().slice(0, 10), notes: '' })
  const [meterSaving, setMeterSaving] = useState(false)
  const [meterMsg, setMeterMsg] = useState('')
  const [referencing, setReferencing] = useState(undefined)
  const [moveOutChecked, setMoveOutChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('propairty_moveout') || '{}') } catch { return {} }
  })
  const [moveOutLoaded, setMoveOutLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [portalFeatures, setPortalFeatures] = useState({})
  const msgScrollRef = useRef(null)
  const [expandedNotes, setExpandedNotes] = useState(() => {
    // start all jobs expanded so chat is immediately visible
    const init = {}
    return init  // will be populated after maintenance loads
  })
  const navigate = useNavigate()
  const location = useLocation()
  const [paymentBanner, setPaymentBanner] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('payment')
    return p === 'success' ? 'success' : p === 'cancelled' ? 'cancelled' : null
  })

  // Clear ?payment= query param from URL without re-render
  useEffect(() => {
    if (paymentBanner) {
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setPaymentBanner(null), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    tenantApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    tenantApi.get('/portal/lease').then(r => setLease(r.data)).catch(() => {})
    tenantApi.get('/portal/payments').then(r => setPayments(r.data)).catch(() => {})
    tenantApi.get('/portal/maintenance').then(r => {
      setMaintenance(r.data)
      // Auto-expand all jobs so chat is immediately visible
      const expanded = {}
      r.data.forEach(j => { expanded[j.id] = true })
      setExpandedNotes(expanded)
    }).catch(() => {})
    tenantApi.get('/portal/renewal').then(r => setRenewal(r.data)).catch(() => {})
    tenantApi.get('/portal/notices').then(r => setNotices(r.data || [])).catch(() => {})
    tenantApi.get('/portal/notifications').then(r => setNotifications(r.data)).catch(() => {})
    tenantApi.get('/portal/documents').then(r => setDocuments(r.data)).catch(() => {})
    tenantApi.get('/portal/compliance').then(r => setComplianceCerts(r.data)).catch(() => {})
    tenantApi.get('/portal/deposit').then(r => setDeposit(r.data)).catch(() => {})
    tenantApi.get('/portal/inspections').then(r => setInspections(r.data)).catch(() => {})
    tenantApi.get('/portal/property-info').then(r => setPropertyInfo(r.data)).catch(() => {})
    tenantApi.get('/portal/my-property').then(r => setMyProperty(r.data)).catch(() => {})
    tenantApi.get('/portal/rent-statement').then(r => setRentStatement(r.data)).catch(() => {})
    tenantApi.get('/portal/messages').then(r => setMessages(r.data)).catch(() => {})
    tenantApi.get('/portal/messages/unread-count').then(r => setMsgUnread(r.data.count)).catch(() => {})
    tenantApi.get('/portal/rtr').then(r => setRtr(r.data)).catch(() => {})
    tenantApi.get('/portal/meter-readings').then(r => setMeterReadings(r.data)).catch(() => {})
    tenantApi.get('/portal/referencing').then(r => setReferencing(r.data)).catch(() => setReferencing(null))
    tenantApi.get('/portal/features').then(r => setPortalFeatures(r.data)).catch(() => {})
    tenantApi.get('/portal/moveout').then(r => {
      setMoveOutChecked(r.data)
      localStorage.setItem('propairty_moveout', JSON.stringify(r.data))
      setMoveOutLoaded(true)
    }).catch(() => setMoveOutLoaded(true))
    // Check if online payments are available
    const BASE = import.meta.env.VITE_API_URL || '/api'
    fetch(`${BASE}/stripe/config`).then(r => r.json()).then(d => setStripeEnabled(!!d.publishable_key)).catch(() => {})
    // Check for payment result in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') setTab('Payments')
  }, [])

  useEffect(() => {
    if (tab !== 'Messages') return
    const interval = setInterval(() => {
      tenantApi.get('/portal/messages').then(r => {
        setMessages(prev => r.data.length !== prev.length ? r.data : prev)
        setMsgUnread(0)
      }).catch(() => {})
    }, 4000)
    return () => clearInterval(interval)
  }, [tab])

  useEffect(() => {
    if (msgScrollRef.current) msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight
  }, [messages])

  async function handleOpenNotifications() {
    setShowNotifications(v => !v)
    const unread = notifications.filter(n => !n.read)
    if (unread.length > 0) {
      await tenantApi.post('/portal/notifications/read-all').catch(() => {})
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  async function handlePay(paymentId) {
    setPayingId(paymentId)
    setPayError('')
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('tenant_token')
      const res = await fetch(`${BASE}/stripe/checkout/${paymentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setPayError(data.detail || 'Payment unavailable — contact your letting agent.')
      }
    } catch {
      setPayError('Payment unavailable — contact your letting agent.')
    }
    setPayingId(null)
  }

  function logout() {
    localStorage.removeItem('tenant_token')
    navigate('/tenant/login')
  }

  function printStatement() {
    if (!rentStatement) return
    const rows = rentStatement.payments.map(p => `
      <tr>
        <td>${p.due_date ? fmtDate(p.due_date) : '—'}</td>
        <td>${p.paid_date ? fmtDate(p.paid_date) : '—'}</td>
        <td style="text-align:right">£${p.amount_due?.toFixed(2)}</td>
        <td style="text-align:right">${p.amount_paid != null ? '£' + p.amount_paid.toFixed(2) : '—'}</td>
        <td style="text-align:center;color:${p.status === 'paid' ? '#16a34a' : p.status === 'overdue' ? '#dc2626' : '#6b7280'}">${p.status}</td>
      </tr>`).join('')
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Rent Statement — ${rentStatement.tenant}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
        h1{font-size:20px;margin:0 0 4px}
        .meta{color:#6b7280;margin-bottom:24px}
        table{width:100%;border-collapse:collapse}
        th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:#f9fafb;padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb}
        td{padding:8px 12px;border-bottom:1px solid #f3f4f6}
        .footer{margin-top:20px;font-size:11px;color:#9ca3af;text-align:right}
      </style>
    </head><body>
      <h1>Rent Statement</h1>
      <div class="meta">${rentStatement.tenant} · ${rentStatement.property}${rentStatement.unit ? ' · ' + rentStatement.unit : ''}<br>Generated: ${rentStatement.generated}</div>
      <table>
        <thead><tr><th>Due Date</th><th>Paid Date</th><th style="text-align:right">Amount Due</th><th style="text-align:right">Amount Paid</th><th style="text-align:center">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Generated ${rentStatement.generated} · PropAIrty</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`)
    win.document.close()
  }

  function downloadStatementCSV() {
    if (!rentStatement) return
    const headers = ['Due Date', 'Paid Date', 'Amount Due (GBP)', 'Amount Paid (GBP)', 'Status']
    const rows = rentStatement.payments.map(p => [
      p.due_date ? fmtDate(p.due_date) : '',
      p.paid_date ? fmtDate(p.paid_date) : '',
      p.amount_due?.toFixed(2) ?? '',
      p.amount_paid != null ? p.amount_paid.toFixed(2) : '',
      p.status,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RentStatement-${(rentStatement.tenant || 'tenant').replace(/\s+/g, '-')}-${rentStatement.generated || ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSubmitMaintenance(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitMsg('')
    try {
      const res = await tenantApi.post('/portal/maintenance', newJob)
      const jobId = res.data.id
      // Upload photos — backend runs AI triage and returns result
      if (newJobPhotos.length > 0) {
        const fd = new FormData()
        newJobPhotos.forEach(f => fd.append('files', f))
        setSubmitMsg('Analysing photos with AI…')
        await tenantApi.post(`/portal/maintenance/${jobId}/photos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }
      setSubmitMsg('Your request has been submitted. Your letting agent will be in touch.')
      setNewJob({ title: '', description: '', priority: 'medium' })
      setNewJobPhotos([])
      const r = await tenantApi.get('/portal/maintenance')
      setMaintenance(r.data)
    } catch (err) {
      setSubmitMsg(err.response?.data?.detail || 'Failed to submit request.')
    }
    setSubmitting(false)
  }

  const totalOwed = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + (p.amount_due - (p.amount_paid || 0)), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* E-signature modal */}
      {signingDoc && (
        <SignatureModal
          doc={signingDoc}
          onClose={() => setSigningDoc(null)}
          onSigned={docId => setDocuments(prev =>
            prev.map(d => d.id === docId ? { ...d, signed_at: new Date().toISOString(), signed_by_name: me?.full_name || '' } : d)
          )}
        />
      )}
      {/* Payment result banner */}
      {paymentBanner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          paymentBanner === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-gray-700 text-white'
        }`}>
          {paymentBanner === 'success' ? (
            <><span>✓</span> Payment successful — thank you! A receipt has been emailed to you.</>
          ) : (
            <><span>✕</span> Payment cancelled — no charge was made.</>
          )}
          <button onClick={() => setPaymentBanner(null)} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button onClick={() => setSidebarOpen(v => !v)}
            className="sm:hidden p-2 -ml-1 text-gray-500 hover:text-violet-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => { setTab('My Property'); setSidebarOpen(false) }} className="text-left">
            <h1 className="text-xl font-bold text-violet-600 hover:opacity-80 transition-opacity">
              Prop<span className="text-gray-900">AI</span>rty
              <span className="hidden sm:inline text-sm font-normal text-gray-400 ml-2">Tenant Portal</span>
            </h1>
          </button>
        </div>
        <div className="flex items-center gap-4">
          {/* Profile dropdown */}
          {me && (
            <ProfileDropdown
              me={me}
              onUpdate={async patch => { const r = await tenantApi.patch('/me', patch); setMe(r.data) }}
              onPassword={async ({ current, next }) => tenantApi.post('/me/change-password', { current_password: current, new_password: next })}
              onLogout={logout}
              accentRing="focus:ring-violet-500"
              btnClass="bg-violet-600 hover:bg-violet-700"
            />
          )}

          {/* Notification bell */}
          <div className="relative">
            <button onClick={handleOpenNotifications}
              className="relative p-2 text-gray-500 hover:text-violet-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {showNotifications && (
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-violet-50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                          n.type === 'urgent' ? 'bg-red-500' :
                          n.type === 'warning' ? 'bg-amber-400' :
                          n.type === 'success' ? 'bg-green-500' : 'bg-violet-400'
                        }`} />
                        <div>
                          <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-6 items-start">
        {/* Left sidebar nav */}
        {(() => {
          // Map tab names to feature flag keys (undefined = always shown)
          const TAB_FLAGS = {
            'Payments': 'tenant_payments', 'Messages': 'tenant_messages',
            'Maintenance': 'tenant_maintenance', 'Documents': 'tenant_documents',
            'Deposit': 'tenant_deposit', 'Rent Statement': 'tenant_rent_statement',
            'Meters': 'tenant_meters', 'Inspections': 'tenant_inspections',
            'Utilities': 'tenant_utilities', 'Emergency': 'tenant_emergency',
            'Referencing': 'tenant_referencing', 'RTR': 'tenant_right_to_rent',
            'Move Out': 'tenant_move_out', 'Notices': 'tenant_notices',
          }
          const allTabs = renewal
            ? [...BASE_TABS.slice(0, BASE_TABS.indexOf('Notices')), 'Renewal', 'Notices']
            : BASE_TABS
          const tabs = allTabs.filter(t => {
            const flag = TAB_FLAGS[t]
            if (!flag) return true
            return portalFeatures[flag] !== false
          })
          const TENANT_NAV_ICONS = {
            'My Property':    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>,
            'Payments':       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>,
            'Messages':       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>,
            'Maintenance':    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.5-1.021l1.2-1.2a6 6 0 00-8.485-8.485l1.2 1.2m5.5 1.021a5.97 5.97 0 00-1.2-1.2m0 0l-1.786 1.786"/></svg>,
            'My Lease':       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>,
            'Documents':      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"/></svg>,
            'Deposit':        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>,
            'Rent Statement': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>,
            'Meters':         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>,
            'Inspections':    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>,
            'Utilities':      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>,
            'Emergency':      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>,
            'Referencing':    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>,
            'RTR':            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"/></svg>,
            'Move Out':       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15"/></svg>,
            'Renewal':        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>,
            'Notices':        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
          }

          const NAV = [
            { key: 'My Property' },
            { key: 'Payments' },
            { key: 'Messages', label: 'Messages', unread: msgUnread > 0 },
            { key: 'Maintenance' },
            { key: 'My Lease' },
            { key: 'Documents' },
            { key: 'Deposit' },
            { key: 'Rent Statement' },
            { key: 'Meters', label: 'Meter Readings' },
            { key: 'Inspections' },
            { key: 'Utilities' },
            { key: 'Emergency' },
            { key: 'Referencing' },
            { key: 'RTR', label: 'Right to Rent' },
            { key: 'Move Out', label: 'Move-out' },
            { key: 'Renewal', badge: true },
            { key: 'Notices' },
          ].filter(n => tabs.includes(n.key))

          const sidebarContent = (
            <>
              <nav className="bg-violet-950 rounded-xl overflow-hidden">
                {NAV.map((item) => (
                  <button key={item.key} onClick={() => { setTab(item.key); setSidebarOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer
                      ${tab === item.key ? 'bg-violet-600 text-white' : 'text-slate-200 hover:bg-violet-900 hover:text-white'}`}>
                    <span className="shrink-0 opacity-80">{TENANT_NAV_ICONS[item.key]}</span>
                    <span className="flex-1">{item.label || item.key}</span>
                    {item.badge && <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />}
                    {item.unread && <span className="bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">{msgUnread > 9 ? '9+' : msgUnread}</span>}
                  </button>
                ))}
              </nav>
            </>
          )

          return (
            <>
              {/* Mobile drawer */}
              <aside className={`fixed top-0 left-0 h-full w-64 bg-violet-950 z-40 p-4 pt-6 overflow-y-auto transition-transform duration-200 sm:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-violet-200">Menu</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-violet-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                {sidebarContent}
              </aside>

              {/* Desktop sidebar */}
              <aside className="hidden sm:block w-52 shrink-0 sticky top-6">
                {sidebarContent}
              </aside>
            </>
          )
        })()}

        {/* Main content */}
        <div className="flex-1 min-w-0">

        {/* Overdue alert */}
        {totalOwed > 0 && (
          <div className="mb-5 bg-white border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 font-bold text-sm">!</span>
            </span>
            <div>
              <p className="text-sm font-semibold text-red-700">£{totalOwed.toFixed(2)} overdue</p>
              <p className="text-xs text-red-400">Please make a payment to avoid further action.</p>
            </div>
          </div>
        )}

        {/* My Lease tab */}
        {tab === 'My Lease' && (
          <div>
            <PageHeader title="My Lease" subtitle="Your tenancy agreement, dates, and key terms" />
            {/* Renewal offer banner */}
            {renewal && !renewalResponse && (
              <div className="mb-5 bg-violet-50 border border-violet-300 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📋</span>
                  <h3 className="font-bold text-violet-800">Renewal Offer</h3>
                </div>
                <p className="text-sm text-violet-700 mb-3">
                  Your letting agent has offered to renew your tenancy.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500">Proposed Rent</p>
                    <p className="font-bold text-gray-900">£{renewal.proposed_rent}/mo</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500">New Start Date</p>
                    <p className="font-bold text-gray-900">{renewal.proposed_start}</p>
                  </div>
                  {renewal.proposed_end && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-500">New End Date</p>
                      <p className="font-bold text-gray-900">{renewal.proposed_end}</p>
                    </div>
                  )}
                </div>
                {renewal.agent_notes && (
                  <p className="text-xs text-violet-600 bg-white rounded-lg p-3 mb-4">{renewal.agent_notes}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: true })
                      setRenewalResponse('accepted')
                    }}
                    className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-violet-700"
                  >
                    Accept Renewal
                  </button>
                  <button
                    onClick={async () => {
                      await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: false })
                      setRenewalResponse('declined')
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            {renewalResponse === 'accepted' && (
              <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">Renewal accepted! Your new agreement will be sent to you by email shortly.</p>
              </div>
            )}
            {renewalResponse === 'declined' && (
              <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-600">You have declined the renewal offer. Please contact your letting agent to discuss next steps.</p>
              </div>
            )}

            {!lease ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No active lease found.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{lease.property_name}</h2>
                    <p className="text-sm text-gray-500">{lease.property_address}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(lease.status)}`}>
                    {lease.status}
                  </span>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.unit_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Rent</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">£{lease.monthly_rent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Lease Start</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{fmtDate(lease.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Lease End</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {lease.end_date ? fmtDate(lease.end_date) : lease.is_periodic ? 'Periodic (rolling)' : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Deposit</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.deposit ? `£${lease.deposit}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Rent Due</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{lease.rent_day ? `${lease.rent_day}${ordinal(lease.rent_day)} of each month` : '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments tab */}
        {tab === 'Payments' && (
          <div className="space-y-4">
            <PageHeader title="Payments" subtitle="Your rent schedule, payment history, and balances" />
            {new URLSearchParams(window.location.search).get('payment') === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3">
                <p className="text-sm text-green-700 font-medium">Payment successful — thank you! Your record will update shortly.</p>
              </div>
            )}
            {payError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">⚠</span>
                <p className="text-sm text-red-700">{payError}</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Due Date</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Paid</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td className="px-6 py-3 text-gray-700">{p.due_date}</td>
                      <td className="px-6 py-3 text-right text-gray-700">£{p.amount_due}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{p.amount_paid != null ? `£${p.amount_paid}` : '—'}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {p.status !== 'paid' ? (
                          <button onClick={() => handlePay(p.id)} disabled={payingId === p.id}
                            className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            {payingId === p.id ? '…' : 'Pay now'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No payment records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notices tab */}
        {tab === 'Notices' && (
          <div>
            <PageHeader title="Notices" subtitle="Legal notices served on your tenancy" />
            <NoticesTab notices={notices} onView={id => {
            tenantApi.post(`/portal/notices/${id}/viewed`).catch(() => {})
            setNotices(prev => prev.map(n => n.id === id && !n.viewed_at ? { ...n, viewed_at: new Date().toISOString() } : n))
          }} />
          </div>
        )}

        {/* Documents tab */}
        {tab === 'Documents' && (
          <>
            <PageHeader title="Your Documents" subtitle="Tenancy agreements, certificates, and signed files" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded yet. Contact your agent if you need a copy of your tenancy agreement or certificates.</p>
            ) : (
              <div className="space-y-2">
                {documents.map(d => {
                  const isEsigned = d.source === 'esign'
                  const icon = isEsigned
                    ? <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
                    : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                  const catLabel = isEsigned ? 'Signed Document' : {
                    agreement: 'Tenancy Agreement', certificate: 'Certificate', invoice: 'Invoice',
                    correspondence: 'Correspondence', other: 'Document',
                  }[d.category] || d.category || 'Document'
                  const sizeKb = d.file_size ? `${Math.round(d.file_size / 1024)} KB` : ''
                  const canSign = !isEsigned && d.category === 'agreement' && !d.signed_at
                  const downloadHref = isEsigned ? `https://propairty.co.uk${d.url}` : d.url
                  return (
                    <div key={d.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${isEsigned ? 'border-green-200 bg-green-50 hover:border-green-300' : 'border-gray-100 hover:border-violet-200'}`}>
                      <span className="text-2xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.original_name}</p>
                        <p className="text-xs text-gray-400">{catLabel}{sizeKb ? ` · ${sizeKb}` : ''}{d.created_at ? ` · ${d.created_at.slice(0,10)}` : ''}</p>
                        {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                        {isEsigned && (
                          <p className="text-xs text-green-700 font-medium mt-0.5">Electronically signed · legally binding</p>
                        )}
                        {d.signed_at && !isEsigned && (
                          <p className="text-xs text-green-600 mt-0.5">✓ Signed by {d.signed_by_name} on {d.signed_at.slice(0,10)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canSign && (
                          <button onClick={() => setSigningDoc(d)}
                            className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            Sign
                          </button>
                        )}
                        <a href={downloadHref} target="_blank" rel="noreferrer"
                          className={`text-xs hover:underline ${isEsigned ? 'text-green-600' : 'text-violet-500'}`}>
                          Download →
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>

            {/* Safety & compliance certificates */}
            {complianceCerts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Safety &amp; Compliance Certificates</h3>
                <div className="space-y-2">
                  {complianceCerts.map(c => {
                    const statusColor = c.status === 'valid' ? 'text-green-600' : c.status === 'expired' ? 'text-red-600' : 'text-amber-600'
                    const statusLabel = c.status === 'valid' ? 'Valid' : c.status === 'expired' ? 'Expired' : 'Expiring Soon'
                    return (
                      <div key={c.cert_type} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-violet-200 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.cert_label}</p>
                          <p className="text-xs text-gray-400">
                            Expires {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            {c.reference ? ` · Ref: ${c.reference}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                          {c.upload_id && (
                            <a href={dlUrl(c.upload_id)} target="_blank" rel="noreferrer"
                              className="text-xs text-violet-600 hover:underline">
                              View →
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3">Your landlord is legally required to provide these certificates. Contact your agent if a certificate is missing or expired.</p>
              </div>
            )}
          </>
        )}

        {/* Deposit tab */}
        {tab === 'Deposit' && (
          <>
            <PageHeader title="Your Deposit" subtitle="Deposit amount, scheme, and protection status" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {!deposit ? (
              <p className="text-sm text-gray-400">No deposit record found. Contact your agent for details.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Amount held', deposit.amount != null ? `£${deposit.amount.toLocaleString()}` : '—'],
                    ['Scheme', deposit.scheme || 'Not recorded'],
                    ['Reference', deposit.scheme_reference || '—'],
                    ['Status', deposit.status ? deposit.status.replace(/_/g, ' ') : '—'],
                    ['Received', deposit.received_date ? fmtDate(deposit.received_date) : '—'],
                    ['Protected', deposit.protected_date ? fmtDate(deposit.protected_date) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{value}</p>
                    </div>
                  ))}
                </div>
                {deposit.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{deposit.notes}</p>}
                {deposit.dispute_notice && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <p className="text-sm font-semibold text-amber-900">Deposit Dispute Notice</p>
                      <span className="ml-auto text-xs text-amber-600">{deposit.dispute_notice.reference}</span>
                    </div>
                    <p className="text-sm text-amber-800">
                      Your landlord or agent has raised a deposit dispute. The following deductions are being claimed against your deposit:
                    </p>
                    {deposit.dispute_notice.deductions.length > 0 && (
                      <ul className="text-sm text-amber-900 space-y-1 pl-2">
                        {deposit.dispute_notice.deductions.map((d, i) => (
                          <li key={i} className="flex items-start gap-1"><span className="text-amber-500 mt-0.5">•</span>{d}</li>
                        ))}
                      </ul>
                    )}
                    {deposit.dispute_notice.total && (
                      <p className="text-sm font-semibold text-amber-900 pt-1 border-t border-amber-200">{deposit.dispute_notice.total}</p>
                    )}
                    <p className="text-xs text-amber-700 mt-1">
                      You have the right to raise your own evidence with your deposit scheme. Contact {deposit.scheme || 'your deposit scheme'} directly to respond.
                    </p>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
                  <p className="font-semibold">Deposit Protection Schemes</p>
                  <p>Your deposit must be protected in a government-approved scheme within 30 days of receipt.</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <a href="https://www.tenancydepositscheme.com" target="_blank" rel="noreferrer" className="underline">TDS</a>
                    <a href="https://www.depositprotection.com" target="_blank" rel="noreferrer" className="underline">DPS</a>
                    <a href="https://www.mydeposits.co.uk" target="_blank" rel="noreferrer" className="underline">myDeposits</a>
                  </div>
                </div>
              </div>
            )}
            </div>
          </>
        )}

        {/* Inspections tab */}
        {tab === 'Inspections' && (
          <>
            <PageHeader title="Inspections" subtitle="Scheduled and completed property inspections" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {inspections.length === 0 ? (
              <p className="text-sm text-gray-400">No inspections scheduled or recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {inspections.map(i => {
                  const isUpcoming = i.status === 'scheduled'
                  const typeLabel = { routine: 'Routine', check_in: 'Check-in', check_out: 'Check-out', inventory: 'Inventory' }[i.type] || i.type
                  const condColor = { excellent: 'text-green-600', good: 'text-green-500', fair: 'text-yellow-600', poor: 'text-red-500' }[i.overall_condition] || 'text-gray-500'
                  return (
                    <div key={i.id} className={`rounded-xl border p-4 ${isUpcoming ? 'border-violet-200 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{typeLabel} Inspection</p>
                          <p className="text-xs text-gray-500 mt-0.5">{isUpcoming ? `Scheduled: ${fmtDate(i.scheduled_date)}` : `Completed: ${fmtDate(i.completed_date || i.scheduled_date)}`}</p>
                          {i.inspector_name && <p className="text-xs text-gray-400 mt-0.5">Inspector: {i.inspector_name}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isUpcoming ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                            {i.status}
                          </span>
                          {i.overall_condition && <p className={`text-xs font-medium mt-1 capitalize ${condColor}`}>{i.overall_condition} condition</p>}
                        </div>
                      </div>
                      {isUpcoming && (
                        <div className="mt-3 bg-white border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-700">
                          Please ensure the property is accessible and reasonably tidy. Your agent will contact you to confirm the exact time.
                        </div>
                      )}
                      {i.notes && <p className="text-xs text-gray-600 mt-2 italic">"{i.notes}"</p>}
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </>
        )}

        {/* Utilities tab */}
        {tab === 'Utilities' && (
          <>
            <PageHeader title="Utilities & Move-in Info" subtitle="Supplier details, meter locations, and bin days" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {!propertyInfo || Object.keys(propertyInfo.utility_info || {}).length === 0 ? (
              <p className="text-sm text-gray-400">Your agent hasn't added utility information yet. Contact them directly.</p>
            ) : (
              <div className="space-y-2">
                {[
                  ['electricity', '⚡', 'Electricity supplier'],
                  ['gas', '🔥', 'Gas supplier'],
                  ['water', '💧', 'Water supplier'],
                  ['broadband', '🌐', 'Broadband provider'],
                  ['council', '🏛️', 'Council / local authority'],
                  ['bin_days', '🗑️', 'Bin collection days'],
                  ['meter_elec', '📟', 'Electricity meter location'],
                  ['meter_gas', '📟', 'Gas meter location'],
                ].filter(([key]) => propertyInfo.utility_info?.[key]).map(([key, icon, label]) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-medium text-gray-900">{propertyInfo.utility_info[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </>
        )}

        {/* Emergency contacts tab */}
        {tab === 'Emergency' && (
          <>
            <PageHeader title="Emergency Contacts" subtitle="For out-of-hours emergencies or urgent issues" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-3">
              {/* Always show the agency */}
              {propertyInfo?.agency_name && (
                <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{propertyInfo.agency_name}</p>
                    <p className="text-xs text-gray-500">Your letting agent</p>
                  </div>
                  <div className="text-right text-sm">
                    {propertyInfo.agency_phone && <a href={`tel:${propertyInfo.agency_phone}`} className="block text-violet-700 font-semibold hover:underline">{propertyInfo.agency_phone}</a>}
                    {propertyInfo.agency_email && <a href={`mailto:${propertyInfo.agency_email}`} className="block text-xs text-gray-500 hover:underline">{propertyInfo.agency_email}</a>}
                  </div>
                </div>
              )}
              {(propertyInfo?.emergency_contacts || []).map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name || '—'}</p>
                    <p className="text-xs text-gray-500">{c.role}</p>
                  </div>
                  {c.phone && <a href={`tel:${c.phone}`} className="text-sm font-semibold text-violet-700 hover:underline">{c.phone}</a>}
                </div>
              ))}
              {(!propertyInfo?.emergency_contacts?.length && !propertyInfo?.agency_phone) && (
                <p className="text-sm text-gray-400">No emergency contacts set up yet. Contact your agent to add them.</p>
              )}
              {/* National emergency numbers */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">National</p>
                {[['999', 'Police / Fire / Ambulance (emergency)'], ['105', 'Power cut (National Grid)'], ['0800 111 999', 'Gas emergency (National Gas)']].map(([num, label]) => (
                  <div key={num} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                    <p className="text-sm text-gray-700">{label}</p>
                    <a href={`tel:${num.replace(/\s/g,'')}`} className="text-sm font-bold text-red-700 hover:underline">{num}</a>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </>
        )}

        {/* My Property tab */}
        {tab === 'My Property' && (
          <div className="space-y-6">
            <PageHeader title="My Property" subtitle="Details, features, and contact info for your home" />
            {!myProperty ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-400">Property details not available.</p>
              </div>
            ) : (
              <>
                {/* Property info */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">{myProperty.property.name}</h2>
                  <p className="text-sm text-gray-500 mb-4">{myProperty.property.address}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {[
                      myProperty.property.epc_rating && ['EPC Rating', myProperty.property.epc_rating, '⚡'],
                      myProperty.property.epc_potential && ['EPC Potential', myProperty.property.epc_potential, '⚡'],
                      myProperty.property.council_tax_band && ['Council Tax Band', `Band ${myProperty.property.council_tax_band}`, '🏛️'],
                      myProperty.property.type && ['Property Type', myProperty.property.type, '🏠'],
                      myProperty.property.tenure && ['Tenure', myProperty.property.tenure, '📜'],
                      myProperty.property.bills_included && ['Bills', 'Included in rent', '💡'],
                      myProperty.unit.bedrooms && ['Bedrooms', myProperty.unit.bedrooms, '🛏️'],
                      myProperty.unit.bathrooms && ['Bathrooms', myProperty.unit.bathrooms, '🚿'],
                      myProperty.unit.reception_rooms > 0 && ['Reception rooms', myProperty.unit.reception_rooms, '🛋️'],
                      myProperty.unit.furnished && ['Furnished', myProperty.unit.furnished.replace(/-/g,' '), '🪑'],
                    ].filter(Boolean).map(([label, value, icon]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{icon} {label}</p>
                        <p className="text-sm font-semibold text-gray-900 capitalize mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  {myProperty.property.description && (
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{myProperty.property.description}</p>
                  )}
                  {(myProperty.property.features.length > 0 || myProperty.unit.amenities?.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Features</p>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          ...(myProperty.unit.amenities || []).map(a => a.replace(/_/g, ' ')),
                          ...myProperty.property.features,
                        ].map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-700 capitalize">
                            <span className="text-violet-400">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Photo gallery */}
                {myProperty.photos.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1">
                      {myProperty.photos.map((p, i) => (
                        <button key={p.id} onClick={() => setLightbox(i)}
                          className="relative aspect-video overflow-hidden rounded-lg group">
                          <img src={p.url} alt={p.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lightbox */}
                {lightbox !== null && (
                  <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
                    onClick={() => setLightbox(null)}>
                    <button onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(0, i - 1)) }}
                      className="absolute left-4 text-white text-3xl px-3 py-1 hover:bg-white/10 rounded-lg">‹</button>
                    <img src={myProperty.photos[lightbox]?.url} alt=""
                      className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
                    <button onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(myProperty.photos.length - 1, i + 1)) }}
                      className="absolute right-4 text-white text-3xl px-3 py-1 hover:bg-white/10 rounded-lg">›</button>
                    <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-xl px-2 hover:bg-white/10 rounded-lg">✕</button>
                    <p className="absolute bottom-4 text-white/60 text-sm">{lightbox + 1} / {myProperty.photos.length}</p>
                  </div>
                )}

              </>
            )}
          </div>
        )}

        {/* Renewal tab (conditional) */}
        {tab === 'Renewal' && renewal && (
          <>
            <PageHeader title="Renewal Offer" subtitle={`${renewal.property} · ${renewal.unit}`} />
            <div className="bg-white rounded-xl border border-violet-200 p-6">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                ['Current rent', `£${renewal.current_rent}/mo`],
                ['Proposed rent', `£${renewal.proposed_rent}/mo`],
                ['New start date', fmtDate(renewal.proposed_start)],
                ['New end date', renewal.proposed_end ? fmtDate(renewal.proposed_end) : 'Periodic'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
            {renewal.agent_notes && <p className="text-sm text-violet-700 bg-violet-50 rounded-lg p-3 mb-4">{renewal.agent_notes}</p>}
            {!renewalResponse ? (
              <div className="flex gap-3">
                <button onClick={async () => { await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: true }); setRenewalResponse('accepted') }}
                  className="flex-1 bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-700">Accept Offer</button>
                <button onClick={async () => { await tenantApi.post(`/portal/renewal/${renewal.id}/respond`, { accept: false }); setRenewalResponse('declined') }}
                  className="flex-1 border border-red-300 text-red-600 rounded-lg py-2.5 text-sm font-semibold hover:bg-red-50">Decline</button>
              </div>
            ) : (
              <div className={`rounded-lg px-4 py-3 text-sm font-semibold text-center ${renewalResponse === 'accepted' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                {renewalResponse === 'accepted' ? '✓ You accepted this renewal offer' : 'You declined this renewal offer'}
              </div>
            )}
            </div>
          </>
        )}

        {/* Maintenance tab */}
        {tab === 'Maintenance' && (
          <div className="space-y-6">
            <PageHeader title="Maintenance" subtitle="Report issues and track your maintenance requests" />
            {/* Submit new request */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Report an Issue</h2>
              </div>
              <form onSubmit={handleSubmitMaintenance} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="e.g. Boiler not working" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={3} placeholder="Please describe the issue in detail…" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={newJob.priority} onChange={e => setNewJob({...newJob, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="low">Low — non-urgent</option>
                    <option value="medium">Medium — needs attention</option>
                    <option value="high">High — urgent</option>
                    <option value="urgent">Urgent — emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photos / Videos <span className="text-gray-400 font-normal">(optional)</span></label>
                  <label className="flex items-center gap-2 cursor-pointer w-fit border border-dashed border-gray-300 hover:border-violet-400 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:text-violet-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add photos or videos
                    <input type="file" accept="image/*,video/*" multiple className="hidden"
                      onChange={e => setNewJobPhotos(Array.from(e.target.files))} />
                  </label>
                  {newJobPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newJobPhotos.map((f, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(f)} alt={f.name}
                            className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                          <button type="button"
                            onClick={() => setNewJobPhotos(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 text-xs flex items-center justify-center leading-none">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {submitMsg && <p className={`text-sm ${submitMsg.includes('submitted') ? 'text-green-600' : 'text-red-500'}`}>{submitMsg}</p>}
                <button type="submit" disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* Past requests */}
            {maintenance.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Your Requests</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Job</th>
                        <th className="text-left px-4 py-2.5 font-medium">Status</th>
                        <th className="text-left px-4 py-2.5 font-medium">Date</th>
                        <th className="text-left px-4 py-2.5 font-medium">Messages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenance.map(j => (
                        <>
                          <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-900">{j.title}</p>
                              {j.description && <p className="text-xs text-gray-400 truncate max-w-xs">{j.description}</p>}
                              {j.assigned_to && <p className="text-xs text-gray-400 mt-0.5">Assigned: {j.assigned_to}</p>}
                              {j.photos?.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {j.photos.map(p => (
                                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                                      <img src={p.url} alt="photo"
                                        className="h-10 w-10 object-cover rounded border border-gray-200 hover:opacity-80 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              )}
                              {j.ai_triage && <TriageCard triage={j.ai_triage} />}
                              {j.tenant_satisfied === true && <span className="text-xs text-green-600">resolved ✓</span>}
                              {j.tenant_satisfied === false && <span className="text-xs text-red-500">complaint raised</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(j.status)}`}>
                                {j.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">{j.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col gap-1 items-start">
                                <button
                                  onClick={() => setExpandedNotes(prev => ({ ...prev, [j.id]: !prev[j.id] }))}
                                  className={`text-xs px-2 py-0.5 rounded font-medium ${expandedNotes[j.id] ? 'bg-violet-100 text-violet-700 border border-violet-300' : 'border border-violet-300 text-violet-600 hover:bg-violet-50'}`}>
                                  💬 {expandedNotes[j.id] ? 'hide chat ▲' : j.status === 'completed' && j.tenant_satisfied === null ? 'respond ▼' : 'open chat ▼'}
                                </button>
                                {j.status === 'open' && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm('Are you sure you want to retract this request?')) return
                                      await tenantApi.post(`/portal/maintenance/${j.id}/cancel`)
                                      setMaintenance(prev => prev.map(m => m.id === j.id ? { ...m, status: 'cancelled' } : m))
                                    }}
                                    className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors">
                                    Retract
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedNotes[j.id] && (
                            <tr key={`notes-${j.id}`} className="border-b border-violet-100">
                              <td colSpan="4" className="px-5 py-4 bg-violet-50/60">
                                <MaintenanceNotesThread
                                  job={j}
                                  onResponded={(id, satisfied, feedback) =>
                                    setMaintenance(prev => prev.map(m =>
                                      m.id === id
                                        ? { ...m, tenant_satisfied: satisfied, tenant_feedback: feedback, status: satisfied ? m.status : 'in_progress' }
                                        : m
                                    ))
                                  }
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Messages tab */}
        {tab === 'Messages' && (
          <>
          <PageHeader title="Messages" subtitle="Direct messages with your letting agent" />
          <NotificationPrefs
            getUrl="/api/tenant/portal/notification-prefs"
            putUrl="/api/tenant/portal/notification-prefs"
            tokenKey="tenant_token"
          />
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: '70vh' }}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Message Your Agent</h2>
              <p className="text-xs text-gray-400 mt-0.5">Send a general enquiry to your letting agent</p>
            </div>
            <div ref={msgScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">No messages yet. Say hello!</p>
              )}
              {messages.map(m => {
                const isMine = m.sender_type === 'tenant'
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${isMine ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      <p className="font-medium text-xs mb-0.5 opacity-70">{isMine ? 'You' : m.sender_name}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="text-xs mt-1 opacity-50">
                        {m.created_at ? new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={async e => {
              e.preventDefault()
              if (!msgBody.trim() || msgSending) return
              setMsgSending(true)
              try {
                const r = await tenantApi.post('/portal/messages', { body: msgBody.trim() })
                setMessages(prev => [...prev, r.data])
                setMsgBody('')
              } finally { setMsgSending(false) }
            }} className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <input
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button type="submit" disabled={msgSending || !msgBody.trim()}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40">
                {msgSending ? '…' : 'Send'}
              </button>
            </form>
          </div>
          </>
        )}

        {/* Rent Statement tab */}
        {tab === 'Rent Statement' && (
          <div className="space-y-4">
            <PageHeader title="Rent Statement" subtitle={rentStatement ? `${rentStatement.property} · ${rentStatement.unit}` : 'Your rent payment history'}>
              <button onClick={downloadStatementCSV} disabled={!rentStatement}
                className="border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40">
                <span>⬇️</span> CSV
              </button>
              <button onClick={printStatement} disabled={!rentStatement}
                className="bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 flex items-center gap-2 disabled:opacity-40">
                <span>🖨️</span> Print / PDF
              </button>
            </PageHeader>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {!rentStatement || rentStatement.payments.length === 0 ? (
                <p className="text-sm text-gray-400">No payment records found.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      ['Tenant', rentStatement.tenant],
                      ['Property', rentStatement.property],
                      ['Address', rentStatement.address],
                      ['Statement date', rentStatement.generated],
                    ].map(([label, value]) => value ? (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-900">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Due Date</th>
                          <th className="px-4 py-3 text-left">Paid Date</th>
                          <th className="px-4 py-3 text-right">Amount Due</th>
                          <th className="px-4 py-3 text-right">Amount Paid</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rentStatement.payments.map((p, i) => (
                          <tr key={i} className={p.status === 'overdue' ? 'bg-red-50' : ''}>
                            <td className="px-4 py-2.5 text-gray-700">{p.due_date ? fmtDate(p.due_date) : '—'}</td>
                            <td className="px-4 py-2.5 text-gray-500">{p.paid_date ? fmtDate(p.paid_date) : '—'}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">£{p.amount_due?.toFixed(2)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{p.amount_paid != null ? `£${p.amount_paid.toFixed(2)}` : '—'}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-right">Generated {rentStatement.generated} · PropAIrty</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Meter Readings tab */}
        {tab === 'Meters' && (
          <div className="space-y-5">
            <PageHeader title="Meter Readings" subtitle="Submit electricity, gas, and water readings" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <form onSubmit={async e => {
                e.preventDefault()
                if (meterSaving || !meterForm.reading) return
                setMeterSaving(true)
                setMeterMsg('')
                try {
                  await tenantApi.post('/portal/meter-readings', {
                    meter_type: meterForm.meter_type,
                    reading: parseFloat(meterForm.reading),
                    reading_date: meterForm.reading_date,
                    notes: meterForm.notes || null,
                  })
                  const r = await tenantApi.get('/portal/meter-readings')
                  setMeterReadings(r.data)
                  setMeterForm(f => ({ ...f, reading: '', notes: '' }))
                  setMeterMsg('Reading submitted!')
                  setTimeout(() => setMeterMsg(''), 3000)
                } catch (err) {
                  setMeterMsg(err.response?.data?.detail || 'Failed to submit.')
                } finally { setMeterSaving(false) }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Meter type</label>
                    <select value={meterForm.meter_type} onChange={e => setMeterForm(f => ({ ...f, meter_type: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="electricity">⚡ Electricity</option>
                      <option value="gas">🔥 Gas</option>
                      <option value="water">💧 Water</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reading date</label>
                    <input type="date" value={meterForm.reading_date} onChange={e => setMeterForm(f => ({ ...f, reading_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Meter reading</label>
                    <input type="number" step="0.01" value={meterForm.reading} onChange={e => setMeterForm(f => ({ ...f, reading: e.target.value }))}
                      placeholder="e.g. 12345.6"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input value={meterForm.notes} onChange={e => setMeterForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. photo taken"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={meterSaving}
                    className="bg-violet-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                    {meterSaving ? 'Submitting…' : 'Submit Reading'}
                  </button>
                  {meterMsg && <span className={`text-sm ${meterMsg.includes('submitted') ? 'text-green-600' : 'text-red-500'}`}>{meterMsg}</span>}
                </div>
              </form>
            </div>
            {meterReadings.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Reading History</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-right">Reading</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {meterReadings.map(r => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 text-gray-700">{fmtDate(r.reading_date)}</td>
                        <td className="px-4 py-2.5 text-gray-700 capitalize">
                          {r.meter_type === 'electricity' ? '⚡' : r.meter_type === 'gas' ? '🔥' : '💧'} {r.meter_type}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-900">{r.reading}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* RTR tab */}
        {tab === 'RTR' && (
          <>
            <PageHeader title="Right to Rent" subtitle="Your Right to Rent check status recorded by your letting agent" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {!rtr || rtr.status === 'not_recorded' ? (
              <div className="bg-gray-50 rounded-xl p-5 text-center">
                <p className="text-2xl mb-2">🪪</p>
                <p className="text-sm text-gray-500">No Right to Rent record has been recorded for you yet.</p>
                <p className="text-xs text-gray-400 mt-1">Contact your letting agent if you have any questions.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 border flex items-center gap-3 ${
                  rtr.status === 'expired' ? 'bg-red-50 border-red-200' :
                  rtr.status === 'expiring_soon' ? 'bg-amber-50 border-amber-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <span className="text-2xl">
                    {rtr.status === 'expired' ? '❌' : rtr.status === 'expiring_soon' ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <p className={`font-semibold text-sm ${
                      rtr.status === 'expired' ? 'text-red-700' :
                      rtr.status === 'expiring_soon' ? 'text-amber-700' : 'text-green-700'
                    }`}>
                      {rtr.status === 'expired' ? 'RTR Check Expired' :
                       rtr.status === 'expiring_soon' ? `Expiring in ${rtr.days_remaining} days` :
                       'Right to Rent Valid'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {rtr.status === 'expired' ? 'Please contact your agent immediately to provide updated documents.' :
                       rtr.status === 'expiring_soon' ? 'You should provide updated documents to your agent soon.' :
                       'Your right to rent check is up to date.'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Check date', rtr.check_date ? fmtDate(rtr.check_date) : '—'],
                    ['Expiry date', rtr.expiry_date ? fmtDate(rtr.expiry_date) : 'No expiry (indefinite)'],
                    rtr.document_type && ['Document type', rtr.document_type],
                    rtr.days_remaining != null && rtr.days_remaining >= 0 && ['Days remaining', `${rtr.days_remaining} days`],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">What is Right to Rent?</p>
                  <p className="text-xs">UK law requires landlords to check that all adult tenants have the right to rent property in England. Time-limited documents must be rechecked before expiry.</p>
                </div>
              </div>
            )}
            </div>
          </>
        )}

        {/* Move Out tab */}
        {tab === 'Move Out' && (() => {
          const end = lease?.end_date ? new Date(lease.end_date) : null
          const today = new Date()
          const daysLeft = end ? Math.ceil((end - today) / 86400000) : null
          const approaching = daysLeft !== null && daysLeft <= 60
          const checklist = [
            { label: 'Confirm move-out date with your agent', when: '8+ weeks before' },
            { label: 'Give formal written notice (if required)', when: '8+ weeks before' },
            { label: 'Arrange professional end-of-tenancy clean', when: '4 weeks before' },
            { label: 'Arrange carpet cleaning if required by tenancy', when: '4 weeks before' },
            { label: 'Book removal van / transport', when: '4 weeks before' },
            { label: 'Redirect your post (Royal Mail)', when: '2 weeks before' },
            { label: 'Notify utility providers of move-out date', when: '2 weeks before' },
            { label: 'Notify council tax of move-out', when: '2 weeks before' },
            { label: 'Submit final meter readings', when: 'Move-out day' },
            { label: 'Return all keys and fobs', when: 'Move-out day' },
            { label: 'Remove all belongings', when: 'Move-out day' },
            { label: 'Check property against inventory', when: 'Move-out day' },
            { label: 'Provide forwarding address for deposit return', when: 'Move-out day' },
          ]
          const done = Object.values(moveOutChecked).filter(Boolean).length
          return (
            <div className="space-y-5">
              <PageHeader title="Move Out" subtitle="Checklist and guidance for ending your tenancy" />
              {end && (
                <div className={`rounded-xl p-5 border ${approaching ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <p className={`font-semibold ${approaching ? 'text-amber-700' : 'text-gray-700'}`}>
                        {daysLeft > 0 ? `${daysLeft} days until move-out` : daysLeft === 0 ? 'Move-out day!' : 'Tenancy ended'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Lease end: {fmtDate(lease.end_date)}</p>
                    </div>
                  </div>
                </div>
              )}
              {!end && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Your lease is periodic (no fixed end date). Use this checklist when you decide to move out.</p>
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Move-out Checklist</h2>
                  <span className="text-xs text-gray-500">{done}/{checklist.length} done</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${(done / checklist.length) * 100}%` }} />
                </div>
                <div className="space-y-2">
                  {checklist.map((item, i) => (
                    <label key={i} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${moveOutChecked[i] ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={!!moveOutChecked[i]} onChange={async () => {
                        const n = { ...moveOutChecked, [i]: !moveOutChecked[i] }
                        setMoveOutChecked(n)
                        localStorage.setItem('propairty_moveout', JSON.stringify(n))
                        tenantApi.post(`/portal/moveout/${i}/toggle`).catch(() => {})
                      }}
                        className="mt-0.5 h-4 w-4 rounded text-violet-600 focus:ring-violet-500" />
                      <div className="flex-1">
                        <p className={`text-sm ${moveOutChecked[i] ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.when}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4">* This checklist is for guidance only. Always check your tenancy agreement for specific requirements.</p>
              </div>
            </div>
          )
        })()}

        {/* Referencing tab */}
        {tab === 'Referencing' && (
          <>
            <PageHeader title="Referencing Status" subtitle="Your tenant referencing application status" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
            {referencing === undefined ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : !referencing ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-sm font-medium text-gray-600">No referencing application found</p>
                <p className="text-xs text-gray-400 mt-1">If you believe this is incorrect, contact your letting agent.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const statusMap = {
                    pending:   { color: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: '⏳', label: 'Pending — your application is being reviewed' },
                    in_progress: { color: 'bg-blue-50 border-blue-200 text-blue-700', icon: '→', label: 'In progress — checks are underway' },
                    passed:    { color: 'bg-green-50 border-green-200 text-green-700', icon: '✅', label: 'Passed — referencing complete' },
                    failed:    { color: 'bg-red-50 border-red-200 text-red-700', icon: '❌', label: 'Failed — please contact your agent' },
                    withdrawn: { color: 'bg-gray-50 border-gray-200 text-gray-600', icon: '↩️', label: 'Withdrawn' },
                  }
                  const s = statusMap[referencing.status] || { color: 'bg-gray-50 border-gray-200 text-gray-700', icon: '·', label: referencing.status }
                  return (
                    <>
                      <div className={`rounded-xl p-4 border flex items-center gap-3 ${s.color}`}>
                        <span className="text-2xl">{s.icon}</span>
                        <p className="font-semibold text-sm">{s.label}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Application submitted', referencing.created_at ? fmtDate(referencing.created_at.slice(0,10)) : '—'],
                          ['Last updated', referencing.updated_at ? fmtDate(referencing.updated_at.slice(0,10)) : '—'],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-sm font-semibold text-gray-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Questions about your reference?</p>
                  <p className="text-xs">Contact your letting agent directly or use the Messages tab to send an enquiry.</p>
                </div>
              </div>
            )}
            </div>
          </>
        )}

        </div> {/* flex-1 content */}
      </div> {/* flex row */}
      <OtherPortals current="tenant" />
      <PortalAiChat
        apiUrl="/api/tenant/portal/ai-chat"
        tokenKey="tenant_token"
        name="Wendy"
        color="violet"
        suggestions={[
          "When is my next rent due?",
          "How much is my deposit?",
          "What's the status of my maintenance request?",
          "When does my lease end?",
        ]}
      />
    </div>
  )
}

const NOTICE_INFO = {
  section_21: {
    title: 'Section 21 — Notice Requiring Possession',
    color: 'border-red-300 bg-red-50',
    headerColor: 'text-red-700',
    icon: '⚠️',
    description: 'Your landlord has given you formal notice to vacate this property. This does not mean you must leave immediately — the date shown is the earliest your landlord can apply to court for possession. You are strongly advised to seek independent housing advice as soon as possible.',
    advice: 'Contact Citizens Advice, Shelter, or a housing solicitor immediately.',
  },
  section_8: {
    title: 'Section 8 — Notice of Intention to Seek Possession',
    color: 'border-amber-300 bg-amber-50',
    headerColor: 'text-amber-700',
    icon: '⚠️',
    description: 'Your landlord has given notice that they intend to apply to court for possession, typically due to rent arrears or another breach of tenancy. You may be able to prevent court action by paying the arrears or resolving the breach before the date shown.',
    advice: 'Contact your letting agent or seek independent housing advice promptly.',
  },
  section_13: {
    title: 'Section 13 — Notice of Rent Increase',
    color: 'border-indigo-200 bg-indigo-50',
    headerColor: 'text-indigo-700',
    icon: null,
    description: 'Your landlord has proposed an increase to your rent. The new amount takes effect from the date shown below. If you believe the increase is above market rate, you have the right to challenge it at the First-tier Tribunal (Property Chamber) before the effective date.',
    advice: null,
  },
}

function NoticesTab({ notices, onView }) {
  const [expanded, setExpanded] = useState(null)

  function toggle(id) {
    if (expanded !== id) onView(id)
    setExpanded(prev => prev === id ? null : id)
  }

  if (notices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-sm">No notices have been served on your tenancy.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-4">The following formal notices have been issued in connection with your tenancy. Tap any notice to read full details.</p>
      {notices.map(n => {
        const info = NOTICE_INFO[n.notice_type] || { title: n.notice_type, color: 'border-gray-200 bg-gray-50', headerColor: 'text-gray-700', icon: null, description: '', advice: null }
        const isOpen = expanded === n.id
        return (
          <div key={n.id} className={`rounded-xl border ${info.color} overflow-hidden transition-all`}>
            <button className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left" onClick={() => toggle(n.id)}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{info.icon}</span>
                <div>
                  <p className={`font-semibold text-sm ${info.headerColor}`}>{info.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Served {n.served_date ? new Date(n.served_date).toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'}) : '—'}</p>
                </div>
              </div>
              <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t border-gray-200/60 pt-4 space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">{info.description}</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {n.notice_type === 'section_13' && (
                    <>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-500">New Monthly Rent</p>
                        <p className="font-bold text-indigo-700">£{n.arrears_amount?.toFixed(2)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-500">Effective From</p>
                        <p className="font-bold text-gray-900">{n.possession_date ? new Date(n.possession_date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</p>
                      </div>
                    </>
                  )}
                  {n.notice_type === 'section_21' && n.possession_date && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200 col-span-2">
                      <p className="text-xs text-gray-500">Possession Required By</p>
                      <p className="font-bold text-red-700">{new Date(n.possession_date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</p>
                    </div>
                  )}
                  {n.notice_type === 'section_8' && (
                    <>
                      {n.arrears_amount > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500">Arrears Amount</p>
                          <p className="font-bold text-red-700">£{n.arrears_amount?.toFixed(2)}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {n.custom_notes && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm text-gray-700">
                    <p className="text-xs text-gray-500 mb-1">Note from your letting agent</p>
                    {n.custom_notes}
                  </div>
                )}

                {info.advice && (
                  <div className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-xs text-gray-600 font-medium">
                    💡 {info.advice}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ordinal(n) {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
