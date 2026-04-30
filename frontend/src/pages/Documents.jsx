import { PageHeader } from '../components/Illustration'
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const DOC_TYPES = {
  ast:               { icon: '📝', label: 'Assured Shorthold Tenancy Agreement', desc: 'Full AST with all standard clauses, populated from lease data.' },
  deposit_receipt:   { icon: '🏦', label: 'Deposit Receipt', desc: 'Tenancy deposit receipt and protection confirmation.' },
  rent_increase:     { icon: '📈', label: 'Rent Increase Notice', desc: 'Section 13 notice of proposed rent increase.' },
  deed_of_surrender: { icon: '🤝', label: 'Deed of Surrender', desc: 'Formal surrender of tenancy by mutual consent — both parties sign.' },
  nosp:              { icon: '⚖️', label: 'Notice of Seeking Possession (NOSP)', desc: 'Required before most Section 8 possession claims. Specifies grounds.' },
}

// These have their own dedicated generation endpoints (not lease-based)
const SPECIAL_TYPES = {
  deposit_dispute: { icon: '🔍', label: 'Deposit Dispute Evidence Pack', desc: 'Submission-ready evidence pack for TDS/DPS/MyDeposits adjudication.' },
  hmo_guidance:    { icon: '🏘️', label: 'HMO Licensing Assessment', desc: 'Checks whether mandatory HMO licensing applies and generates an application checklist.' },
}

const NOTICE_TYPES = ['section_21', 'section_8']

const SIGNABLE_TYPES = ['ast', 'deposit_receipt', 'rent_increase', 'deed_of_surrender']

const STATUS_COLOURS = {
  pending:  'bg-amber-100 text-amber-700',
  signed:   'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired:  'bg-gray-100 text-gray-500',
}

export default function Documents() {
  const [tab, setTab] = useState('generate')
  const [leases, setLeases] = useState([])
  const [tenants, setTenants] = useState([])
  const [properties, setProperties] = useState([])
  const [landlords, setLandlords] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [selected, setSelected] = useState('ast')
  const [form, setForm] = useState({ lease_id: '', new_rent: '', effective_date: '', arrears_amount: '', custom_notes: '', surrender_date: '' })
  const [specialSelected, setSpecialSelected] = useState(null)
  const [specialForm, setSpecialForm] = useState({ deposit_id: '', property_id: '' })
  const [specialGenerating, setSpecialGenerating] = useState(false)
  const [deposits, setDeposits] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  // Management agreement state
  const [mgaOpen, setMgaOpen] = useState(false)
  const [mgaForm, setMgaForm] = useState({ landlord_id: '', management_fee_pct: '10', tenant_find_fee: "One month's rent (inc. VAT)", renewal_fee: '£150 + VAT', maintenance_limit: '250', notice_period: '60', inspection_frequency: 'twice per year' })
  const [mgaGenerating, setMgaGenerating] = useState(false)

  // Signing state
  const [signingRequests, setSigningRequests] = useState([])
  const [sigLoading, setSigLoading] = useState(false)
  const [sendModal, setSendModal] = useState(null) // { doc_type, lease_id } or null
  const [sigForm, setSigForm] = useState({ signer_name: '', signer_email: '', signer_type: 'tenant', new_rent: '', effective_date: '', arrears_amount: '', custom_notes: '' })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/leases'),
      api.get('/tenants'),
      api.get('/properties'),
      api.get('/documents/types'),
      api.get('/landlord/landlords'),
      api.get('/deposits/list').catch(() => ({ data: [] })),
    ]).then(([l, t, p, d, ll, dep]) => {
      setLeases(l.data)
      setTenants(t.data)
      setProperties(p.data)
      setDocTypes((d.data || []).filter(dt => !NOTICE_TYPES.includes(dt.key)))
      setLandlords(ll.data || [])
      setDeposits(dep.data || [])
    })
  }, [])

  const loadSigningRequests = useCallback(() => {
    setSigLoading(true)
    api.get('/signing/requests')
      .then(r => setSigningRequests(r.data))
      .catch(() => {})
      .finally(() => setSigLoading(false))
  }, [])

  useEffect(() => { if (tab === 'signatures') loadSigningRequests() }, [tab])

  const allUnits = properties.flatMap(p => p.units.map(u => ({ ...u, propertyName: p.name })))
  const tenantName = id => tenants.find(t => t.id === id)?.full_name || '—'

  const generateSpecial = async () => {
    if (!specialSelected) return
    setSpecialGenerating(true)
    try {
      let url
      if (specialSelected === 'deposit_dispute') {
        if (!specialForm.deposit_id) { setSpecialGenerating(false); return }
        url = `/documents/deposit-dispute/${specialForm.deposit_id}`
      } else {
        if (!specialForm.property_id) { setSpecialGenerating(false); return }
        url = `/documents/hmo-guidance/${specialForm.property_id}`
      }
      const res = await api.get(url, { responseType: 'blob' })
      const cd = res.headers['content-disposition'] || ''
      const fname = cd.match(/filename="([^"]+)"/)?.[1] || 'document.pdf'
      const burl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = burl; a.download = fname; a.click()
      URL.revokeObjectURL(burl)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to generate document.')
    }
    setSpecialGenerating(false)
  }

  const generate = async () => {
    if (!form.lease_id || !selected) return
    setGenerating(true); setError('')
    try {
      const payload = { lease_id: parseInt(form.lease_id), doc_type: selected }
      if (form.new_rent) payload.new_rent = parseFloat(form.new_rent)
      if (form.effective_date) payload.effective_date = form.effective_date
      if (form.arrears_amount) payload.arrears_amount = parseFloat(form.arrears_amount)
      if (form.custom_notes) payload.custom_notes = form.custom_notes
      if (form.surrender_date) payload.surrender_date = form.surrender_date
      const res = await api.post('/documents/generate', payload, { responseType: 'blob' })
      const cd = res.headers['content-disposition'] || ''
      const fname = cd.match(/filename="([^"]+)"/)?.[1] || 'document.pdf'
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to generate document.')
    }
    setGenerating(false)
  }

  const generateMga = async () => {
    if (!mgaForm.landlord_id) return
    setMgaGenerating(true)
    try {
      const payload = {
        landlord_id: parseInt(mgaForm.landlord_id),
        management_fee_pct: parseFloat(mgaForm.management_fee_pct) || 10,
        tenant_find_fee: mgaForm.tenant_find_fee,
        renewal_fee: mgaForm.renewal_fee,
        maintenance_limit: parseInt(mgaForm.maintenance_limit) || 250,
        notice_period: parseInt(mgaForm.notice_period) || 60,
        inspection_frequency: mgaForm.inspection_frequency,
      }
      const res = await api.post('/documents/generate-management-agreement', payload, { responseType: 'blob' })
      const cd = res.headers['content-disposition'] || ''
      const fname = cd.match(/filename="([^"]+)"/)?.[1] || 'ManagementAgreement.pdf'
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to generate agreement.')
    }
    setMgaGenerating(false)
  }

  const openSendModal = (doc_type, lease_id) => {
    // Pre-fill signer from lease
    const lease = leases.find(l => l.id === parseInt(lease_id))
    const tenant = lease ? tenants.find(t => t.id === lease.tenant_id) : null
    setSigForm({
      signer_name: tenant?.full_name || '',
      signer_email: tenant?.email || '',
      signer_type: 'tenant',
      new_rent: form.new_rent,
      effective_date: form.effective_date,
      arrears_amount: form.arrears_amount,
      custom_notes: form.custom_notes,
    })
    setSendModal({ doc_type, lease_id })
    setSendResult(null)
  }

  const sendForSigning = async () => {
    if (!sigForm.signer_name || !sigForm.signer_email) return
    setSending(true)
    try {
      const payload = {
        lease_id: parseInt(sendModal.lease_id),
        doc_type: sendModal.doc_type,
        signer_name: sigForm.signer_name,
        signer_email: sigForm.signer_email,
        signer_type: sigForm.signer_type,
      }
      if (sigForm.new_rent) payload.new_rent = parseFloat(sigForm.new_rent)
      if (sigForm.effective_date) payload.effective_date = sigForm.effective_date
      if (sigForm.arrears_amount) payload.arrears_amount = parseFloat(sigForm.arrears_amount)
      if (sigForm.custom_notes) payload.custom_notes = sigForm.custom_notes
      const r = await api.post('/signing/send', payload)
      setSendResult(r.data)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to send signing request.')
    }
    setSending(false)
  }

  const deleteSigningRequest = async (id) => {
    if (!confirm('Delete this signing request?')) return
    await api.delete(`/signing/requests/${id}`)
    setSigningRequests(prev => prev.filter(s => s.id !== id))
  }

  const leaseDropdown = (
    <select
      value={form.lease_id}
      onChange={e => setForm({ ...form, lease_id: e.target.value })}
      onClick={e => e.stopPropagation()}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
    >
      <option value="">Select tenant / lease…</option>
      {(() => {
        const groups = {}
        leases.forEach(l => {
          const u = allUnits.find(u => u.id === l.unit_id)
          const propName = u?.propertyName || 'Other'
          if (!groups[propName]) groups[propName] = []
          groups[propName].push(l)
        })
        return Object.keys(groups).sort().map(propName => (
          <optgroup key={propName} label={propName}>
            {groups[propName].map(l => {
              const u = allUnits.find(u => u.id === l.unit_id)
              return <option key={l.id} value={l.id}>{tenantName(l.tenant_id)} — {u?.name || '—'}</option>
            })}
          </optgroup>
        ))
      })()}
    </select>
  )

  return (
    <div>
      <PageHeader title="Documents" subtitle="Generate PDFs and send documents for electronic signature" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[{ k: 'generate', l: '📄 Generate PDF' }, { k: 'signatures', l: `✍️ E-Signatures ${signingRequests.length ? `(${signingRequests.filter(s=>s.status==='pending').length} pending)` : ''}` }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Generate tab ── */}
      {tab === 'generate' && (
        <div className="space-y-3 max-w-2xl">
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
            <span>⚖️</span>
            <span>Section 8 and Section 21 notices are issued via <Link to="/notices" className="font-semibold underline hover:text-amber-900">Notices</Link> with full compliance checks.</span>
          </div>

          {docTypes.map(d => {
            const meta = DOC_TYPES[d.key] || { icon: '📄', label: d.label, desc: '' }
            const isSelected = selected === d.key
            const canSign = SIGNABLE_TYPES.includes(d.key)
            return (
              <div key={d.key}
                onClick={() => setSelected(d.key)}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${isSelected ? 'border-indigo-400 shadow-md bg-indigo-50/40' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{meta.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{meta.desc}</p>
                  </div>
                  {canSign && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✍️ E-sign</span>}
                  {isSelected && <span className="text-indigo-600 text-xs font-medium bg-indigo-100 px-2 py-1 rounded-full">Selected</span>}
                </div>

                {isSelected && (
                  <div className="mt-4 border-t border-indigo-100 pt-4 space-y-3" onClick={e => e.stopPropagation()}>
                    <div>{leaseDropdown}</div>

                    {/* Rent increase extra fields */}
                    {d.key === 'rent_increase' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">New monthly rent (£)</label>
                          <input type="number" value={form.new_rent} onChange={e => setForm({...form, new_rent: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="1200" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Effective date</label>
                          <input type="date" value={form.effective_date} onChange={e => setForm({...form, effective_date: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    )}

                    {/* Deed of Surrender extra fields */}
                    {d.key === 'deed_of_surrender' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Surrender date</label>
                          <input type="date" value={form.surrender_date} onChange={e => setForm({...form, surrender_date: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Condition notes (optional)</label>
                          <input type="text" value={form.custom_notes} onChange={e => setForm({...form, custom_notes: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. property returned in good condition" />
                        </div>
                      </div>
                    )}

                    {/* NOSP extra fields */}
                    {d.key === 'nosp' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Rent arrears amount (£)</label>
                          <input type="number" value={form.arrears_amount} onChange={e => setForm({...form, arrears_amount: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Additional particulars (optional)</label>
                          <input type="text" value={form.custom_notes} onChange={e => setForm({...form, custom_notes: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. tenant has ignored 3 prior payment requests" />
                        </div>
                      </div>
                    )}

                    {error && <p className="text-red-500 text-xs">{error}</p>}

                    <div className="flex gap-2">
                      <button onClick={generate} disabled={!form.lease_id || generating}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors">
                        {generating ? 'Generating…' : '⬇ Generate & Download PDF'}
                      </button>
                      {canSign && form.lease_id && (
                        <button onClick={() => openSendModal(d.key, form.lease_id)}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap">
                          ✍️ Send for e-signature
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Management Agreement card */}
          <div
            onClick={() => setMgaOpen(o => !o)}
            className={`rounded-xl border p-5 cursor-pointer transition-all ${mgaOpen ? 'border-indigo-400 shadow-md bg-indigo-50/40' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🤝</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">Landlord Management Agreement</p>
                <p className="text-gray-500 text-xs mt-0.5">Full letting & management agreement between your agency and a landlord.</p>
              </div>
              {mgaOpen && <span className="text-indigo-600 text-xs font-medium bg-indigo-100 px-2 py-1 rounded-full">Selected</span>}
            </div>

            {mgaOpen && (
              <div className="mt-4 border-t border-indigo-100 pt-4 space-y-3" onClick={e => e.stopPropagation()}>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Landlord</label>
                  <select
                    value={mgaForm.landlord_id}
                    onChange={e => setMgaForm({ ...mgaForm, landlord_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select landlord…</option>
                    {landlords.map(l => (
                      <option key={l.id} value={l.id}>{l.full_name}{l.company_name ? ` (${l.company_name})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Management fee (%)</label>
                    <input type="number" step="0.5" value={mgaForm.management_fee_pct}
                      onChange={e => setMgaForm({ ...mgaForm, management_fee_pct: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Repair limit (£)</label>
                    <input type="number" value={mgaForm.maintenance_limit}
                      onChange={e => setMgaForm({ ...mgaForm, maintenance_limit: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tenant find fee</label>
                    <input type="text" value={mgaForm.tenant_find_fee}
                      onChange={e => setMgaForm({ ...mgaForm, tenant_find_fee: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Renewal fee</label>
                    <input type="text" value={mgaForm.renewal_fee}
                      onChange={e => setMgaForm({ ...mgaForm, renewal_fee: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notice period (days)</label>
                    <input type="number" value={mgaForm.notice_period}
                      onChange={e => setMgaForm({ ...mgaForm, notice_period: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Inspection frequency</label>
                    <input type="text" value={mgaForm.inspection_frequency}
                      onChange={e => setMgaForm({ ...mgaForm, inspection_frequency: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <button
                  onClick={generateMga}
                  disabled={!mgaForm.landlord_id || mgaGenerating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  {mgaGenerating ? 'Generating…' : '⬇ Generate & Download PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Special document types — deposit dispute + HMO guidance */}
          {Object.entries(SPECIAL_TYPES).map(([key, meta]) => {
            const isSelected = specialSelected === key
            return (
              <div key={key}
                onClick={() => setSpecialSelected(isSelected ? null : key)}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${isSelected ? 'border-indigo-400 shadow-md bg-indigo-50/40' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{meta.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{meta.desc}</p>
                  </div>
                  {isSelected && <span className="text-indigo-600 text-xs font-medium bg-indigo-100 px-2 py-1 rounded-full">Selected</span>}
                </div>
                {isSelected && (
                  <div className="mt-4 border-t border-indigo-100 pt-4 space-y-3" onClick={e => e.stopPropagation()}>
                    {key === 'deposit_dispute' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Select deposit</label>
                        <select value={specialForm.deposit_id} onChange={e => setSpecialForm({...specialForm, deposit_id: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                          <option value="">Select deposit…</option>
                          {deposits.map(d => {
                            const lease = leases.find(l => l.id === d.lease_id)
                            const tname = lease ? tenantName(lease.tenant_id) : '—'
                            return <option key={d.id} value={d.id}>{tname} — £{d.amount} ({d.scheme || 'TDS'})</option>
                          })}
                        </select>
                      </div>
                    )}
                    {key === 'hmo_guidance' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Select property</label>
                        <select value={specialForm.property_id} onChange={e => setSpecialForm({...specialForm, property_id: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                          <option value="">Select property…</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.address_line1}</option>)}
                        </select>
                      </div>
                    )}
                    <button onClick={generateSpecial} disabled={specialGenerating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors">
                      {specialGenerating ? 'Generating…' : '⬇ Generate & Download PDF'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-400">
            Section 8 & 21 notices → <Link to="/notices" className="text-indigo-500 hover:underline">Notices module</Link>
          </div>
        </div>
      )}

      {/* ── E-Signatures tab ── */}
      {tab === 'signatures' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{signingRequests.length} signing request{signingRequests.length !== 1 ? 's' : ''}</p>
            <button onClick={loadSigningRequests} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Refresh</button>
          </div>

          {sigLoading ? (
            <p className="text-center py-12 text-gray-400">Loading…</p>
          ) : signingRequests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">✍️</p>
              <p className="font-medium text-gray-600 mb-1">No signing requests yet</p>
              <p className="text-sm">Generate a document and click "Send for e-signature" to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signingRequests.map(sr => (
                <div key={sr.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{sr.doc_label}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOURS[sr.status] || 'bg-gray-100 text-gray-600'}`}>
                          {sr.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {sr.signer_name} · {sr.signer_email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Sent {sr.created_at ? new Date(sr.created_at).toLocaleDateString('en-GB') : '—'}
                        {sr.signed_at && ` · Signed ${new Date(sr.signed_at).toLocaleDateString('en-GB')}`}
                        {sr.expires_at && sr.status === 'pending' && ` · Expires ${new Date(sr.expires_at).toLocaleDateString('en-GB')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sr.status === 'pending' && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(sr.signing_url); alert('Link copied!') }}
                          className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          Copy link
                        </button>
                      )}
                      {sr.status === 'signed' && sr.has_signed_pdf && (
                        <button
                          onClick={async () => {
                            const r = await api.get(`/signing/requests/${sr.id}/download`, { responseType: 'blob' })
                            const url = URL.createObjectURL(r.data)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `Signed_${sr.doc_label?.replace(/ /g,'_')}_${sr.signer_name?.replace(/ /g,'_')}.pdf`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          ⬇ Download
                        </button>
                      )}
                      <button onClick={() => deleteSigningRequest(sr.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5">
                        Delete
                      </button>
                    </div>
                  </div>
                  {sr.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-mono break-all">{sr.signing_url}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Send for signing modal ── */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-lg">Send for e-signature</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {DOC_TYPES[sendModal.doc_type]?.label || sendModal.doc_type}
              </p>
            </div>

            {sendResult ? (
              <div className="p-6 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-gray-900 mb-1">Signing request sent!</p>
                <p className="text-sm text-gray-500 mb-4">
                  An email has been sent to <strong>{sigForm.signer_email}</strong> with a secure signing link.
                </p>
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Signing link (share if email doesn't arrive):</p>
                  <p className="text-xs font-mono text-indigo-600 break-all">{sendResult.signing_url}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(sendResult.signing_url); alert('Copied!') }}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Copy link
                  </button>
                  <button onClick={() => { setSendModal(null); setSendResult(null); setTab('signatures'); loadSigningRequests() }}
                    className="flex-1 bg-indigo-600 text-white font-medium py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors">
                    View signatures
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Signer's full name</label>
                  <input type="text" value={sigForm.signer_name} onChange={e => setSigForm({...sigForm, signer_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Signer's email</label>
                  <input type="email" value={sigForm.signer_email} onChange={e => setSigForm({...sigForm, signer_email: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="tenant@email.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Signer type</label>
                  <select value={sigForm.signer_type} onChange={e => setSigForm({...sigForm, signer_type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="tenant">Tenant</option>
                    <option value="landlord">Landlord</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {sendModal.doc_type === 'rent_increase' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">New rent (£)</label>
                      <input type="number" value={sigForm.new_rent} onChange={e => setSigForm({...sigForm, new_rent: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Effective date</label>
                      <input type="date" value={sigForm.effective_date} onChange={e => setSigForm({...sigForm, effective_date: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                  🔒 A secure, unique link will be emailed to the signer. The link expires in 14 days.
                  You can also copy and share it manually.
                </p>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setSendModal(null)}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={sendForSigning} disabled={!sigForm.signer_name || !sigForm.signer_email || sending}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                    {sending ? 'Sending…' : '✍️ Send signing link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
