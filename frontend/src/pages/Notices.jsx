import { useState, useEffect } from 'react'
import api from '../lib/api'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const CHECK_LABELS = {
  gas_cert:     'Gas Safety Certificate (current)',
  epc:          'Energy Performance Certificate (current)',
  deposit:      'Deposit protected + Prescribed Information served',
  how_to_rent:  '"How to Rent" guide provided to tenant',
  fixed_term:   'Not within first 4 months of tenancy',
  notice_period:'Minimum 2-month notice period applied',
}

function CheckIcon({ status }) {
  if (status === 'pass') return <span className="text-green-500 font-bold text-base">✓</span>
  if (status === 'fail') return <span className="text-red-500 font-bold text-base">✗</span>
  if (status === 'warn') return <span className="text-amber-500 font-bold text-base">!</span>
  if (status === 'n/a')  return <span className="text-gray-400 text-sm">n/a</span>
  return <span className="text-gray-300 text-sm">—</span>
}

function checkColor(status) {
  if (status === 'pass') return 'text-green-700 bg-green-50'
  if (status === 'fail') return 'text-red-700 bg-red-50'
  if (status === 'warn') return 'text-amber-700 bg-amber-50'
  return 'text-gray-500 bg-gray-50'
}

export default function Notices() {
  const [leases, setLeases] = useState([])
  const [notices, setNotices] = useState([])
  const [step, setStep] = useState(0)           // 0=list, 1=pick, 2=preflight, 3=confirm
  const [noticeType, setNoticeType] = useState('section_21')
  const [selectedLease, setSelectedLease] = useState(null)
  const [preflight, setPreflight] = useState(null)
  const [howToRent, setHowToRent] = useState(false)
  const [arrears, setArrears] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [downloading, setDownloading] = useState(null)

  const load = async () => {
    const [lr, nr] = await Promise.all([
      api.get('/notices/leases'),
      api.get('/notices'),
    ])
    setLeases(lr.data)
    setNotices(nr.data)
  }

  useEffect(() => { load() }, [])

  async function selectLease(lease) {
    setSelectedLease(lease)
    const r = await api.get(`/notices/preflight/${lease.id}`)
    setPreflight(r.data)
    setArrears(r.data.current_arrears?.toFixed(2) || '0.00')
    setStep(2)
  }

  function canIssueS21() {
    if (!preflight) return false
    const c = preflight.checks
    if (c.fixed_term === 'fail') return false
    // Warn but don't block on gas/epc/deposit fails — agent confirms
    return true
  }

  const s21Blocked = preflight?.checks?.fixed_term === 'fail'
  const s21Warnings = preflight ? Object.entries(preflight.checks)
    .filter(([k, v]) => v === 'fail' && k !== 'fixed_term')
    .map(([k]) => k) : []

  async function handleIssue() {
    setIssuing(true)
    try {
      const token = localStorage.getItem('token')
      const body = {
        lease_id: selectedLease.id,
        notice_type: noticeType,
        check_how_to_rent: howToRent,
        custom_notes: customNotes || null,
      }
      if (noticeType === 'section_8') body.arrears_amount = parseFloat(arrears)

      const res = await fetch(`${BASE}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.detail || 'Failed to issue notice')
        setIssuing(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = noticeType === 'section_21'
        ? `Section21_${selectedLease.tenant_name.replace(' ', '_')}.pdf`
        : `Section8_${selectedLease.tenant_name.replace(' ', '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      setStep(0)
      setPreflight(null)
      setSelectedLease(null)
      setHowToRent(false)
      setCustomNotes('')
      load()
    } catch (e) {
      alert('Failed to issue notice')
    }
    setIssuing(false)
  }

  async function redownload(noticeId, fileName) {
    setDownloading(noticeId)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE}/notices/${noticeId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Legal Notices</h2>
        {step === 0 && (
          <button onClick={() => setStep(1)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Issue a Notice
          </button>
        )}
        {step > 0 && (
          <button onClick={() => { setStep(0); setPreflight(null); setSelectedLease(null) }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-4 py-2 rounded-lg">
            ← Cancel
          </button>
        )}
      </div>

      {/* Step 1 — pick notice type */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => { setNoticeType('section_21'); setStep(1.5) }}
              className="bg-white border-2 border-gray-200 hover:border-red-300 rounded-xl p-6 text-left transition-colors group"
            >
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Section 21</h3>
              <p className="text-sm text-gray-500">Notice Requiring Possession — no-fault eviction. Minimum 2-month notice. Requires deposit protected, Gas Safety, EPC, and How to Rent guide.</p>
              <span className="mt-3 inline-block text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Housing Act 1988 s.21</span>
            </button>
            <button
              onClick={() => { setNoticeType('section_8'); setStep(1.5) }}
              className="bg-white border-2 border-gray-200 hover:border-red-300 rounded-xl p-6 text-left transition-colors"
            >
              <div className="text-2xl mb-3">⚖️</div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Section 8</h3>
              <p className="text-sm text-gray-500">Notice of Intention to Seek Possession — based on breach of tenancy. Typically used for rent arrears (Grounds 8, 10, 11). Minimum 14-day notice.</p>
              <span className="mt-3 inline-block text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Housing Act 1988 s.8</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 1.5 — pick tenant/lease */}
      {step === 1.5 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">
              Select Tenant — {noticeType === 'section_21' ? 'Section 21' : 'Section 8'}
            </h3>
          </div>
          {leases.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No active leases found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {leases.map(l => (
                <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{l.tenant_name}</p>
                    <p className="text-xs text-gray-500">{l.unit} · £{l.monthly_rent}/mo</p>
                    {l.current_arrears > 0 && (
                      <p className="text-xs text-red-600 font-medium mt-0.5">Arrears: £{l.current_arrears.toFixed(2)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => selectLease(l)}
                    className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — pre-flight checks */}
      {step === 2 && preflight && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">
              {noticeType === 'section_21' ? 'Section 21' : 'Section 8'} — {selectedLease.tenant_name}
            </h3>
            <p className="text-sm text-gray-500">{selectedLease.unit} · {selectedLease.property_address}</p>
          </div>

          {/* Blocked warning */}
          {s21Blocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-700 text-sm">Section 21 cannot be issued</p>
              <p className="text-sm text-red-600 mt-1">This tenancy started less than 4 months ago. A Section 21 notice cannot be served within the first 4 months of an Assured Shorthold Tenancy.</p>
            </div>
          )}

          {/* Pre-flight checks */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">
                {noticeType === 'section_21' ? 'Section 21 Validity Checks' : 'Notice Summary'}
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {noticeType === 'section_21' && Object.entries(preflight.checks).map(([key, val]) => (
                <div key={key} className={`px-5 py-3 flex items-center justify-between ${checkColor(val)}`}>
                  <span className="text-sm">{CHECK_LABELS[key] || key}</span>
                  <CheckIcon status={val} />
                </div>
              ))}

              {/* How to Rent — manual confirmation */}
              {noticeType === 'section_21' && (
                <div className="px-5 py-3 flex items-center gap-3 bg-white">
                  <input
                    type="checkbox"
                    id="htr"
                    checked={howToRent}
                    onChange={e => setHowToRent(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="htr" className="text-sm text-gray-700 cursor-pointer">
                    I confirm the <strong>"How to Rent"</strong> guide was provided to the tenant
                  </label>
                </div>
              )}

              {/* S8 arrears */}
              {noticeType === 'section_8' && (
                <div className="px-5 py-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrears Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={arrears}
                    onChange={e => setArrears(e.target.value)}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Auto-calculated from payment records. Adjust if needed.</p>
                </div>
              )}
            </div>
          </div>

          {/* Warnings for failing checks (S21 only, non-blocking) */}
          {noticeType === 'section_21' && s21Warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-semibold text-amber-700 text-sm mb-1">Warning — compliance issues detected</p>
              <ul className="text-sm text-amber-700 space-y-0.5 list-disc pl-4">
                {s21Warnings.map(k => (
                  <li key={k}>{CHECK_LABELS[k]} is not confirmed. A Section 21 served without this may be invalid.</li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-2">You may still generate the notice but ensure you resolve these before serving it.</p>
            </div>
          )}

          {/* Custom notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
            <textarea
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              rows={3}
              placeholder="Any additional details to include on the notice…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Issue button */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={handleIssue}
              disabled={issuing || s21Blocked}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {issuing ? 'Generating…' : `Generate & Download ${noticeType === 'section_21' ? 'Section 21' : 'Section 8'} Notice`}
            </button>
          </div>
        </div>
      )}

      {/* Step 0 — notice log */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Issued Notices</h3>
          </div>
          {notices.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No notices issued yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Type', 'Tenant', 'Property', 'Served', 'Possession / Court Date', 'Checks', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notices.map(n => {
                  const allPass = Object.values(n.checks).every(v => v === 'pass' || v === 'n/a' || v === 'unconfirmed')
                  return (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          n.notice_type === 'section_21' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {n.notice_type === 'section_21' ? 'Section 21' : 'Section 8'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{n.tenant_name}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{n.unit}</td>
                      <td className="px-5 py-3.5 text-gray-500">{n.served_date}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {n.notice_type === 'section_21' ? n.possession_date : n.court_date}
                        {n.arrears_amount ? ` · £${n.arrears_amount.toFixed(2)} arrears` : ''}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1">
                          {Object.entries(n.checks).map(([k, v]) => (
                            <span key={k} title={CHECK_LABELS[k]} className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                              v === 'pass' ? 'bg-green-100 text-green-600' :
                              v === 'fail' ? 'bg-red-100 text-red-600' :
                              v === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {v === 'pass' ? '✓' : v === 'fail' ? '✗' : v === 'warn' ? '!' : '—'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => redownload(n.id, `${n.notice_type === 'section_21' ? 'Section21' : 'Section8'}_${n.tenant_name.replace(' ', '_')}_${n.served_date}.pdf`)}
                          disabled={downloading === n.id}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                        >
                          {downloading === n.id ? '…' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
