import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const CHECK_LABELS = {
  gas_cert:     'Gas Safety Certificate (current)',
  epc:          'Energy Performance Certificate (current)',
  deposit:      'Deposit protected + Prescribed Information served',
  how_to_rent:  '"How to Rent" guide provided to tenant',
  fixed_term:   'Not within first 4 months of tenancy',
  notice_period:'Minimum 2-month notice period applied',
}

function checkColor(status) {
  if (status === 'pass') return 'text-green-700 bg-green-50'
  if (status === 'fail') return 'text-red-700 bg-red-50'
  if (status === 'warn') return 'text-amber-700 bg-amber-50'
  return 'text-gray-500 bg-gray-50'
}

function CheckIcon({ status }) {
  if (status === 'pass') return <span className="text-green-500 font-bold">✓</span>
  if (status === 'fail') return <span className="text-red-500 font-bold">✗</span>
  if (status === 'warn') return <span className="text-amber-500 font-bold">!</span>
  if (status === 'n/a')  return <span className="text-gray-400 text-sm">n/a</span>
  return <span className="text-gray-300 text-sm">—</span>
}

export default function Notices() {
  // step: 0=log, 1=pick type, 2=pick lease (s8/s21), 3=preflight (s8/s21), 4=pick lease (s13), 5=s13 generate
  const [step, setStep] = useState(0)
  const [noticeType, setNoticeType] = useState('section_21')

  // S8/S21 state
  const [leases, setLeases] = useState([])
  const [notices, setNotices] = useState([])
  const [selectedLease, setSelectedLease] = useState(null)
  const [preflight, setPreflight] = useState(null)
  const [howToRent, setHowToRent] = useState(false)
  const [arrears, setArrears] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [issuing, setIssuing] = useState(false)

  // S13 state
  const [s13Due, setS13Due] = useState([])
  const [s13Loading, setS13Loading] = useState(false)
  const [s13Generating, setS13Generating] = useState(null)
  const [s13Rents, setS13Rents] = useState({})  // editable proposed rents keyed by lease_id
  const [s13SortCol, setS13SortCol] = useState('surname')
  const [s13SortDir, setS13SortDir] = useState('asc')

  // Log state
  const [downloading, setDownloading] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sortCol, setSortCol] = useState('served_date')
  const [sortDir, setSortDir] = useState('desc')

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
      {label} {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
    </th>
  )

  const sortedNotices = [...notices].sort((a, b) => {
    let av, bv
    if      (sortCol === 'tenant_name') { av = a.tenant_name || ''; bv = b.tenant_name || '' }
    else if (sortCol === 'unit')        { av = a.unit || '';         bv = b.unit || '' }
    else if (sortCol === 'notice_type') { av = a.notice_type || '';  bv = b.notice_type || '' }
    else                                { av = a.served_date || '';  bv = b.served_date || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const load = async () => {
    const [lr, nr] = await Promise.all([api.get('/notices/leases'), api.get('/notices')])
    setLeases(lr.data)
    setNotices(nr.data)
  }

  useEffect(() => { load() }, [])

  const cancel = () => {
    setStep(0); setPreflight(null); setSelectedLease(null)
    setHowToRent(false); setCustomNotes(''); setS13Rents({})
  }

  // S8/S21 flow
  async function selectLease(lease) {
    setSelectedLease(lease)
    const r = await api.get(`/notices/preflight/${lease.id}`)
    setPreflight(r.data)
    setArrears(r.data.current_arrears?.toFixed(2) || '0.00')
    setStep(3)
  }

  const s21Blocked = preflight?.checks?.fixed_term === 'fail'
  const s21Warnings = preflight ? Object.entries(preflight.checks)
    .filter(([k, v]) => v === 'fail' && k !== 'fixed_term').map(([k]) => k) : []

  async function handleIssue() {
    setIssuing(true)
    try {
      const body = { lease_id: selectedLease.id, notice_type: noticeType, check_how_to_rent: howToRent, custom_notes: customNotes || null }
      if (noticeType === 'section_8') body.arrears_amount = parseFloat(arrears)
      const res = await api.post('/notices', body, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${noticeType === 'section_21' ? 'Section21' : 'Section8'}_${selectedLease.tenant_name.replace(' ', '_')}.pdf`
      a.click(); URL.revokeObjectURL(url)
      cancel(); load()
    } catch (e) {
      const msg = e.response?.data ? await e.response.data.text?.() : null
      try { const j = JSON.parse(msg); alert(j.detail || 'Failed to generate notice') } catch { alert('Failed to generate notice') }
    }
    setIssuing(false)
  }

  // S13 flow
  async function loadS13() {
    setS13Loading(true)
    const r = await api.get('/intelligence/section13-due')
    setS13Due(r.data)
    setS13Loading(false)
  }

  async function generateS13(lease) {
    setS13Generating(lease.lease_id)
    try {
      const proposedRent = parseFloat(s13Rents[lease.lease_id] ?? Math.round((lease.current_rent * 1.03) / 5) * 5)
      const eff = new Date()
      eff.setMonth(eff.getMonth() + 2)
      eff.setDate(1)
      const effectiveDate = eff.toISOString().slice(0, 10)

      const res = await api.post('/notices', {
        lease_id: lease.lease_id,
        notice_type: 'section_13',
        proposed_rent: proposedRent,
        effective_date: effectiveDate,
      }, { responseType: 'blob' })

      // Auto-download
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `Section13_${lease.tenant_name.replace(' ', '_')}.pdf`
      a.click(); URL.revokeObjectURL(url)
      cancel(); load()
    } catch (e) {
      const msg = e.response?.data ? await e.response.data.text?.() : null
      try { const j = JSON.parse(msg); alert(j.detail || 'Failed to generate notice') } catch { alert('Failed to generate notice') }
    }
    setS13Generating(null)
  }

  // Log actions
  async function redownload(noticeId, fileName) {
    setDownloading(noticeId)
    try {
      const res = await api.get(`/notices/${noticeId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(null)
  }

  async function deleteNotice(id) {
    await api.delete(`/notices/${id}`)
    setConfirmDelete(null); load()
  }

  return (
    <div>
      <PageHeader title="Notices" subtitle="Section 8, Section 21 & Section 13 notices">
        {step === 0 && (
          <button onClick={() => setStep(1)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Issue a Notice
          </button>
        )}
        {step > 0 && (
          <button onClick={cancel}
            className="text-sm text-white/80 hover:text-white border border-white/30 px-4 py-2 rounded-lg">
            ← Cancel
          </button>
        )}
      </PageHeader>

      {/* Step 1 — pick notice type */}
      {step === 1 && (
        <div className="grid grid-cols-3 gap-5">
          <button onClick={() => { setNoticeType('section_21'); setStep(2) }}
            className="bg-white border-2 border-gray-200 hover:border-red-300 rounded-xl p-6 text-left transition-colors">
            <div className="text-2xl mb-3">📋</div>
            <h3 className="font-bold text-gray-900 text-base mb-1">Section 21</h3>
            <p className="text-sm text-gray-500">No-fault eviction notice. Minimum 2-month notice period.</p>
            <span className="mt-3 inline-block text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Housing Act 1988 s.21</span>
          </button>
          <button onClick={() => { setNoticeType('section_8'); setStep(2) }}
            className="bg-white border-2 border-gray-200 hover:border-amber-300 rounded-xl p-6 text-left transition-colors">
            <div className="text-2xl mb-3">⚖️</div>
            <h3 className="font-bold text-gray-900 text-base mb-1">Section 8</h3>
            <p className="text-sm text-gray-500">Possession based on breach of tenancy — typically rent arrears.</p>
            <span className="mt-3 inline-block text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Housing Act 1988 s.8</span>
          </button>
          <button onClick={() => { setStep(4); loadS13() }}
            className="bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-6 text-left transition-colors">
            <div className="text-2xl mb-3">📬</div>
            <h3 className="font-bold text-gray-900 text-base mb-1">Section 13</h3>
            <p className="text-sm text-gray-500">Statutory rent increase notice. Served before raising rent on a periodic tenancy.</p>
            <span className="mt-3 inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Housing Act 1988 s.13</span>
          </button>
        </div>
      )}

      {/* Step 2 — pick lease (S8/S21) */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Select Tenant — {noticeType === 'section_21' ? 'Section 21' : 'Section 8'}</h3>
          </div>
          {leases.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No active leases found.</p> : (
            <div className="divide-y divide-gray-100">
              {leases.map(l => (
                <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{l.tenant_name}</p>
                    <p className="text-xs text-gray-500">{l.unit} · £{l.monthly_rent}/mo</p>
                    {l.current_arrears > 0 && <p className="text-xs text-red-600 font-medium mt-0.5">Arrears: £{l.current_arrears.toFixed(2)}</p>}
                  </div>
                  <button onClick={() => selectLease(l)}
                    className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors">
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — preflight (S8/S21) */}
      {step === 3 && preflight && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">{noticeType === 'section_21' ? 'Section 21' : 'Section 8'} — {selectedLease.tenant_name}</h3>
            <p className="text-sm text-gray-500">{selectedLease.unit} · {selectedLease.property_address}</p>
          </div>

          {s21Blocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-700 text-sm">Section 21 cannot be issued</p>
              <p className="text-sm text-red-600 mt-1">This tenancy started less than 4 months ago.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">{noticeType === 'section_21' ? 'Section 21 Validity Checks' : 'Notice Summary'}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {noticeType === 'section_21' && Object.entries(preflight.checks).map(([key, val]) => (
                <div key={key} className={`px-5 py-3 flex items-center justify-between ${checkColor(val)}`}>
                  <span className="text-sm">{CHECK_LABELS[key] || key}</span>
                  <CheckIcon status={val} />
                </div>
              ))}
              {noticeType === 'section_21' && (
                <div className="px-5 py-3 flex items-center gap-3 bg-white">
                  <input type="checkbox" id="htr" checked={howToRent} onChange={e => setHowToRent(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                  <label htmlFor="htr" className="text-sm text-gray-700 cursor-pointer">I confirm the <strong>"How to Rent"</strong> guide was provided to the tenant</label>
                </div>
              )}
              {noticeType === 'section_8' && (
                <div className="px-5 py-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrears Amount (£)</label>
                  <input type="number" step="0.01" value={arrears} onChange={e => setArrears(e.target.value)}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <p className="text-xs text-gray-400 mt-1">Auto-calculated from payment records. Adjust if needed.</p>
                </div>
              )}
            </div>
          </div>

          {noticeType === 'section_21' && s21Warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-semibold text-amber-700 text-sm mb-1">Warning — compliance issues detected</p>
              <p className="text-xs text-amber-600 mt-1">You may still generate the notice but resolve these before serving.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
            <textarea value={customNotes} onChange={e => setCustomNotes(e.target.value)} rows={3}
              placeholder="Any additional details to include on the notice…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
            <button onClick={handleIssue} disabled={issuing || s21Blocked}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors">
              {issuing ? 'Generating…' : `Generate & Download ${noticeType === 'section_21' ? 'Section 21' : 'Section 8'} Notice`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — S13 grouped by property */}
      {step === 4 && (
        <div className="space-y-6">
          {s13Loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : s13Due.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
              No leases currently due for a Section 13 rent review.
            </div>
          ) : (() => {
            const effDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 2); d.setDate(1); return d.toISOString().slice(0, 10) })()
            const surname = l => { const p = (l.tenant_name || '').trim().split(' '); return p[p.length - 1] }

            // Group by property
            const groups = {}
            for (const lease of s13Due) {
              const key = lease.property_name || '—'
              if (!groups[key]) groups[key] = []
              groups[key].push(lease)
            }

            // Sort within each group
            const toggleS13Sort = col => {
              if (s13SortCol === col) setS13SortDir(d => d === 'asc' ? 'desc' : 'asc')
              else { setS13SortCol(col); setS13SortDir('asc') }
            }
            const S13Th = ({ col, label }) => (
              <th onClick={() => toggleS13Sort(col)}
                className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
                {label} {s13SortCol === col ? (s13SortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">↕</span>}
              </th>
            )

            const sortLeases = leases => [...leases].sort((a, b) => {
              let av, bv
              if (s13SortCol === 'surname')       { av = surname(a); bv = surname(b) }
              else if (s13SortCol === 'current')  { av = a.current_rent; bv = b.current_rent }
              else if (s13SortCol === 'proposed') { av = parseFloat(s13Rents[a.lease_id] ?? Math.round((a.current_rent * 1.03) / 5) * 5); bv = parseFloat(s13Rents[b.lease_id] ?? Math.round((b.current_rent * 1.03) / 5) * 5) }
              else                                { av = a.months_since_review; bv = b.months_since_review }
              if (av < bv) return s13SortDir === 'asc' ? -1 : 1
              if (av > bv) return s13SortDir === 'asc' ? 1 : -1
              return 0
            })

            return Object.keys(groups).sort().map(propName => {
              const leases = sortLeases(groups[propName])
              const postcode = leases[0]?.postcode || ''
              return (
                <div key={propName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 bg-indigo-600 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm">{propName}</h3>
                      <p className="text-indigo-200 text-xs">{postcode} · {leases.length} tenant{leases.length !== 1 ? 's' : ''} due for review</p>
                    </div>
                    <span className="text-indigo-200 text-xs">Effective {fmt(effDate)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <S13Th col="surname" label="Tenant" />
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Unit</th>
                        <S13Th col="current" label="Current Rent" />
                        <S13Th col="proposed" label="Proposed Rent" />
                        <S13Th col="months" label="Last Review" />
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leases.map(lease => {
                        const suggested = Math.round((lease.current_rent * 1.03) / 5) * 5
                        const displayRent = s13Rents[lease.lease_id] ?? suggested
                        return (
                          <tr key={lease.lease_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{lease.tenant_name}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{lease.unit_name}</td>
                            <td className="px-4 py-3 text-gray-700">£{lease.current_rent.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500 text-sm">£</span>
                                <input
                                  type="number" step="5" min={lease.current_rent}
                                  value={displayRent}
                                  onChange={e => setS13Rents(prev => ({ ...prev, [lease.lease_id]: e.target.value }))}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-sm font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-amber-600 text-sm">{lease.months_since_review}mo ago</td>
                            <td className="px-4 py-3">
                              <button onClick={() => generateS13(lease)} disabled={s13Generating === lease.lease_id}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                                {s13Generating === lease.lease_id ? 'Generating…' : 'Generate & Download'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Step 0 — issued notices log */}
      {step === 0 && (
        <div className="space-y-6">
          {notices.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">No notices issued yet.</div>
          )}
          {[
            { type: 'section_21', label: 'Section 21', subtitle: 'Notice Requiring Possession', color: 'bg-red-600', badge: 'bg-red-100 text-red-700' },
            { type: 'section_8',  label: 'Section 8',  subtitle: 'Notice Seeking Possession',  color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
            { type: 'section_13', label: 'Section 13', subtitle: 'Rent Increase Notices',       color: 'bg-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
          ].map(({ type, label, subtitle, color, badge }) => {
            const group = sortedNotices.filter(n => n.notice_type === type)
            if (group.length === 0) return null
            return (
              <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between ${color}`}>
                  <div>
                    <h3 className="font-bold text-white text-sm">{label}</h3>
                    <p className="text-white/70 text-xs">{subtitle}</p>
                  </div>
                  <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{group.length}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <SortTh col="tenant_name" label="Tenant" />
                      <SortTh col="unit" label="Property" />
                      <SortTh col="served_date" label="Served" />
                      <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                        {type === 'section_13' ? 'Effective / New Rent' : type === 'section_21' ? 'Possession Date' : 'Court Date / Arrears'}
                      </th>
                      {type !== 'section_13' && <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">Checks</th>}
                      <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">Viewed</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.map(n => (
                      <tr key={n.id} onClick={() => setViewing(n)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{n.tenant_name}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{n.unit}</td>
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{fmt(n.served_date)}</td>
                        <td className="px-5 py-3.5 text-gray-600 text-xs">
                          {type === 'section_13'
                            ? (n.effective_date ? `${fmt(n.effective_date)} · £${Number(n.proposed_rent).toFixed(2)}/mo` : '—')
                            : type === 'section_21'
                              ? fmt(n.possession_date)
                              : `${fmt(n.court_date)}${n.arrears_amount ? ` · £${n.arrears_amount.toFixed(2)}` : ''}`
                          }
                        </td>
                        {type !== 'section_13' && (
                          <td className="px-5 py-3.5">
                            <div className="flex gap-1">
                              {Object.entries(n.checks || {}).map(([k, v]) => (
                                <span key={k} title={CHECK_LABELS[k]} className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                                  v === 'pass' ? 'bg-green-100 text-green-600' : v === 'fail' ? 'bg-red-100 text-red-600' :
                                  v === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                                  {v === 'pass' ? '✓' : v === 'fail' ? '✗' : v === 'warn' ? '!' : '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          {n.viewed_at
                            ? <span className="text-xs text-green-600 font-medium" title={new Date(n.viewed_at).toLocaleString('en-GB')}>👁 {new Date(n.viewed_at).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})} {new Date(n.viewed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
                            : <span className="text-xs text-gray-400">Not yet viewed</span>
                          }
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => redownload(n.id, `${label.replace(' ', '')}_${n.tenant_name.replace(' ', '_')}_${n.served_date}.pdf`)}
                              disabled={downloading === n.id}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
                              {downloading === n.id ? '…' : 'PDF'}
                            </button>
                            {confirmDelete === n.id ? (
                              <>
                                <span className="text-xs text-red-600 font-medium">Withdraw?</span>
                                <button onClick={() => deleteNotice(n.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Yes</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-xs border border-gray-300 text-gray-500 px-2 py-0.5 rounded hover:bg-gray-50">No</button>
                              </>
                            ) : (
                              <button onClick={() => setConfirmDelete(n.id)} className="text-xs text-red-400 hover:text-red-600">Withdraw</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 flex items-center justify-between ${viewing.notice_type === 'section_21' ? 'bg-red-600' : viewing.notice_type === 'section_13' ? 'bg-indigo-600' : 'bg-amber-500'}`}>
              <div>
                <h2 className="text-white font-bold text-base">
                  {viewing.notice_type === 'section_21' ? 'Section 21 Notice' : viewing.notice_type === 'section_13' ? 'Section 13 Notice' : 'Section 8 Notice'}
                </h2>
                <p className="text-white/80 text-xs mt-0.5">
                  {viewing.notice_type === 'section_21' ? 'Notice Requiring Possession' : viewing.notice_type === 'section_13' ? 'Notice of Rent Increase' : 'Notice of Intention to Seek Possession'}
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="text-white/70 hover:text-white text-xl font-light">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs block">Tenant</span><span className="font-medium">{viewing.tenant_name}</span></div>
                <div><span className="text-gray-400 text-xs block">Property</span><span className="font-medium">{viewing.unit}</span></div>
                <div><span className="text-gray-400 text-xs block">Date Served</span><span className="font-medium">{fmt(viewing.served_date)}</span></div>
                {viewing.notice_type === 'section_13' ? (
                  <>
                    <div><span className="text-gray-400 text-xs block">Effective From</span><span className="font-medium">{fmt(viewing.effective_date)}</span></div>
                    <div><span className="text-gray-400 text-xs block">New Rent</span><span className="font-medium text-indigo-600">£{Number(viewing.proposed_rent).toFixed(2)}/mo</span></div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-400 text-xs block">{viewing.notice_type === 'section_21' ? 'Possession Required By' : 'Court Action After'}</span>
                      <span className="font-medium">{fmt(viewing.notice_type === 'section_21' ? viewing.possession_date : viewing.court_date)}</span>
                    </div>
                    {viewing.arrears_amount > 0 && (
                      <div><span className="text-gray-400 text-xs block">Arrears</span><span className="font-medium text-red-600">£{viewing.arrears_amount.toFixed(2)}</span></div>
                    )}
                  </>
                )}
                <div><span className="text-gray-400 text-xs block">Address</span><span className="font-medium text-xs">{viewing.property_address}</span></div>
              </div>
              {viewing.notice_type !== 'section_13' && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Compliance Checks</p>
                  <div className="space-y-1">
                    {Object.entries(viewing.checks || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{CHECK_LABELS[k]}</span>
                        <span className={`font-medium ${v === 'pass' ? 'text-green-600' : v === 'fail' ? 'text-red-600' : v === 'warn' ? 'text-amber-600' : 'text-gray-400'}`}>
                          {v === 'pass' ? '✓ Pass' : v === 'fail' ? '✗ Fail' : v === 'warn' ? '! Warning' : v === 'n/a' ? 'N/A' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewing.custom_notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{viewing.custom_notes}</p>
                </div>
              )}
              <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${viewing.viewed_at ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <span>{viewing.viewed_at ? '👁' : '⏳'}</span>
                <div>
                  <span className={`font-medium ${viewing.viewed_at ? 'text-green-700' : 'text-gray-500'}`}>
                    {viewing.viewed_at ? 'Viewed by tenant' : 'Not yet viewed by tenant'}
                  </span>
                  {viewing.viewed_at && (
                    <span className="text-green-600 text-xs ml-2">
                      {new Date(viewing.viewed_at).toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})} at {new Date(viewing.viewed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => redownload(viewing.id, `${viewing.notice_type === 'section_21' ? 'Section21' : viewing.notice_type === 'section_13' ? 'Section13' : 'Section8'}_${viewing.tenant_name.replace(' ', '_')}_${viewing.served_date}.pdf`)}
                  disabled={downloading === viewing.id}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {downloading === viewing.id ? 'Downloading…' : 'Download PDF'}
                </button>
                <button onClick={() => setViewing(null)} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
