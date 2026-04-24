import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const STAGES = [
  { key: 'enquiry',        label: 'Enquiry',        color: 'bg-gray-100 border-gray-300',      dot: 'bg-gray-400' },
  { key: 'viewing_booked', label: 'Viewing Booked', color: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-400' },
  { key: 'viewed',         label: 'Viewed',         color: 'bg-indigo-50 border-indigo-200',   dot: 'bg-indigo-400' },
  { key: 'referencing',    label: 'Referencing',    color: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-400' },
  { key: 'approved',       label: 'Approved',       color: 'bg-green-50 border-green-200',     dot: 'bg-green-500' },
  { key: 'tenancy_created',label: 'Tenancy Created',color: 'bg-emerald-50 border-emerald-300', dot: 'bg-emerald-500' },
]
const TERMINAL = [
  { key: 'rejected',  label: 'Rejected',  color: 'bg-red-50 border-red-200',   dot: 'bg-red-400' },
  { key: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
]
const ALL_STAGES = [...STAGES, ...TERMINAL]
const SOURCES = ['Rightmove', 'Zoopla', 'SpareRoom', 'OpenRent', 'Direct', 'Referral', 'Other']
const REFERENCING_STATUSES = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'passed',      label: 'Passed' },
  { value: 'failed',      label: 'Failed' },
  { value: 'referred',    label: 'Referred' },
]
const NEXT_STAGE = {
  enquiry: 'viewing_booked',
  viewing_booked: 'viewed',
  viewed: 'referencing',
  referencing: 'approved',
  approved: 'tenancy_created',
}

function stageInfo(key) {
  return ALL_STAGES.find(s => s.key === key) || { label: key, color: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' }
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

export default function Applicants() {
  const [applicants, setApplicants] = useState([])
  const [pipeline, setPipeline]     = useState(null)
  const [units, setUnits]           = useState([])
  const [view, setView]             = useState('board')
  const [showAdd, setShowAdd]       = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [followUps, setFollowUps]   = useState([])
  const [showFollowUps, setShowFollowUps] = useState(true)

  const load = async () => {
    const [ar, pr, fu] = await Promise.all([
      api.get('/applicants'),
      api.get('/applicants/pipeline'),
      api.get('/applicants/follow-ups-due'),
    ])
    setApplicants(ar.data)
    setPipeline(pr.data)
    setFollowUps(fu.data)
  }

  useEffect(() => {
    load()
    api.get('/applicants/units-available').then(r => setUnits(r.data)).catch(() => {})
  }, [])

  const activeApplicants   = applicants.filter(a => !['rejected', 'withdrawn'].includes(a.status))
  const terminalApplicants = applicants.filter(a => ['rejected', 'withdrawn'].includes(a.status))

  async function advanceStage(applicant) {
    const next = NEXT_STAGE[applicant.status]
    if (!next) return
    await api.put(`/applicants/${applicant.id}`, { status: next })
    load()
  }

  return (
    <div>
      <PageHeader title="Applicants" subtitle="Pipeline of prospective tenants" />

      {/* Follow-up due banner */}
      {followUps.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button onClick={() => setShowFollowUps(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-amber-600">⏰</span>
              <span className="text-sm font-semibold text-amber-800">
                {followUps.length} follow-up{followUps.length > 1 ? 's' : ''} due
              </span>
            </div>
            <span className="text-amber-500 text-xs">{showFollowUps ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showFollowUps && (
            <div className="divide-y divide-amber-100 border-t border-amber-200">
              {followUps.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-2.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.full_name}</p>
                    {a.follow_up_note && <p className="text-xs text-gray-500 truncate">{a.follow_up_note}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${isOverdue(a.follow_up_date) ? 'text-red-600' : 'text-amber-700'}`}>
                      {fmtDate(a.follow_up_date)}
                    </span>
                    <button onClick={() => setSelected(a)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Open</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          {pipeline && (
            <p className="text-sm text-gray-500 mt-0.5">
              {pipeline.total_active} active · {pipeline.counts.tenancy_created} converted
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {['board', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + Add Applicant
          </button>
        </div>
      </div>

      {/* Pipeline summary bar */}
      {pipeline && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {STAGES.map(s => (
            <div key={s.key} className={`flex-shrink-0 border rounded-xl px-4 py-3 ${s.color} min-w-[110px]`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-xs font-medium text-gray-600">{s.label}</span>
              </div>
              <span className="text-2xl font-bold text-gray-800">{pipeline.counts[s.key] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Board view */}
      {view === 'board' && (
        <div className="space-y-4">
          {STAGES.map(stage => {
            const cards = activeApplicants.filter(a => a.status === stage.key)
            return (
              <div key={stage.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${stage.color}`}>
                  <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                  <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                  <span className="ml-auto text-xs bg-white rounded-full px-2 py-0.5 font-bold text-gray-600">{cards.length}</span>
                </div>
                {cards.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400 italic">No applicants at this stage</div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {cards.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{a.full_name}</p>
                            {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {a.property_name || '—'}{a.unit_name ? ` · ${a.unit_name}` : ''}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{a.source || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {a.viewing_date ? new Date(a.viewing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </td>
                          {/* Follow-up indicator */}
                          <td className="px-4 py-2.5 text-xs">
                            {a.follow_up_date && (
                              <span className={`font-medium ${isOverdue(a.follow_up_date) ? 'text-red-500' : 'text-amber-600'}`}>
                                ⏰ {fmtDate(a.follow_up_date)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button onClick={() => setSelected(a)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3">Manage</button>
                            {NEXT_STAGE[a.status] && (
                              <button onClick={() => advanceStage(a)} className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-md px-2 py-0.5 hover:bg-indigo-50">
                                Advance →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          {activeApplicants.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No active applicants.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Property', 'Source', 'Stage', 'Budget', 'Follow-up', 'Added', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeApplicants.map(a => {
                  const si = stageInfo(a.status)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{a.full_name}</p>
                        {a.assigned_agent && <p className="text-xs text-gray-400">Agent: {a.assigned_agent}</p>}
                        {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{a.property_name || '—'}{a.unit_name ? ` · ${a.unit_name}` : ''}</td>
                      <td className="px-5 py-3.5 text-gray-500">{a.source || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${si.color}`}>{si.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{a.monthly_budget || '—'}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {a.follow_up_date
                          ? <span className={`font-medium ${isOverdue(a.follow_up_date) ? 'text-red-500' : 'text-amber-600'}`}>⏰ {fmtDate(a.follow_up_date)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{a.created_at?.slice(0, 10)}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => setSelected(a)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Manage</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rejected/Withdrawn accordion */}
      {terminalApplicants.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowTerminal(v => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm">
            <span className="font-medium text-gray-500">Rejected / Withdrawn ({terminalApplicants.length})</span>
            <span className="text-gray-400">{showTerminal ? '▲' : '▼'}</span>
          </button>
          {showTerminal && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {terminalApplicants.map(a => {
                const si = stageInfo(a.status)
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-700 text-sm">{a.full_name}</span>
                      <span className="text-gray-400 text-xs ml-3">{a.property_name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${si.color}`}>{si.label}</span>
                      <button onClick={() => setSelected(a)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showAdd && <ApplicantModal units={units} onClose={() => { setShowAdd(false); load() }} />}
      {selected && (
        <ApplicantModal
          applicant={selected}
          units={units}
          onClose={() => { setSelected(null); load() }}
          onDelete={async () => {
            await api.delete(`/applicants/${selected.id}`)
            setSelected(null)
            load()
          }}
        />
      )}
    </div>
  )
}


// ── Tag input helper ─────────────────────────────────────────────────────────
function TagInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : []

  function addTag(e) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const next = [...tags, input.trim()].join(', ')
      onChange(next)
      setInput('')
    }
  }
  function removeTag(i) {
    const next = tags.filter((_, idx) => idx !== i).join(', ')
    onChange(next)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="border border-gray-300 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500 min-h-[42px]">
        {tags.map((t, i) => (
          <span key={i} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {t}
            <button type="button" onClick={() => removeTag(i)} className="text-indigo-400 hover:text-indigo-700 leading-none">&times;</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={addTag}
          placeholder={tags.length === 0 ? placeholder : 'Add more…'}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">Press Enter or comma to add</p>
    </div>
  )
}


function ConvertModal({ applicant, onClose, onConverted }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    monthly_rent: '',
    start_date: applicant?.desired_move_in || today,
    end_date: '',
    deposit: '',
    rent_day: '1',
    is_periodic: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        monthly_rent: parseFloat(form.monthly_rent),
        start_date: form.start_date,
        end_date: form.is_periodic || !form.end_date ? null : form.end_date,
        deposit: form.deposit ? parseFloat(form.deposit) : null,
        rent_day: parseInt(form.rent_day),
        is_periodic: form.is_periodic,
      }
      const res = await api.post(`/applicants/${applicant.id}/convert`, payload)
      onConverted(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Conversion failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Convert to Tenancy</h3>
            <p className="text-xs text-gray-400 mt-0.5">{applicant.full_name} · {applicant.property_name}{applicant.unit_name ? ` · ${applicant.unit_name}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Monthly Rent *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                <input type="number" step="0.01" min="0" required value={form.monthly_rent}
                  onChange={e => setForm({ ...form, monthly_rent: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Deposit</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                <input type="number" step="0.01" min="0" value={form.deposit}
                  onChange={e => setForm({ ...form, deposit: e.target.value })}
                  placeholder="Optional"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Tenancy Type</label>
            <select value={form.is_periodic ? 'periodic' : 'fixed'}
              onChange={e => setForm({ ...form, is_periodic: e.target.value === 'periodic' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="fixed">Fixed term</option>
              <option value="periodic">Periodic (rolling monthly)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Start Date *</label>
              <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {!form.is_periodic && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Rent Due Day of Month</label>
            <input type="number" min="1" max="28" value={form.rent_day} onChange={e => setForm({ ...form, rent_day: e.target.value })}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-indigo-50 rounded-lg px-4 py-3 text-xs text-indigo-700">
            This will create a tenant record and an active lease for <strong>{applicant.unit_name || 'the selected unit'}</strong>.
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Converting…' : 'Create Tenancy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function ApplicantModal({ applicant, units, onClose, onDelete }) {
  const isEdit = !!applicant
  const [activeTab, setActiveTab] = useState('details')
  const [showConvert, setShowConvert] = useState(false)
  const [form, setForm] = useState({
    full_name:           applicant?.full_name || '',
    email:               applicant?.email || '',
    phone:               applicant?.phone || '',
    source:              applicant?.source || '',
    status:              applicant?.status || 'enquiry',
    unit_id:             applicant?.unit_id ? String(applicant.unit_id) : '',
    viewing_date:        applicant?.viewing_date ? applicant.viewing_date.slice(0, 16) : '',
    desired_move_in:     applicant?.desired_move_in || '',
    monthly_budget:      applicant?.monthly_budget || '',
    notes:               applicant?.notes || '',
    right_to_rent_checked: applicant?.right_to_rent_checked || false,
    referencing_status:  applicant?.referencing_status || 'not_started',
    assigned_agent:      applicant?.assigned_agent || '',
    // Preferences
    preferred_areas:     applicant?.preferred_areas || '',
    must_haves:          applicant?.must_haves || '',
    dislikes:            applicant?.dislikes || '',
    min_bedrooms:        applicant?.min_bedrooms || '',
    max_bedrooms:        applicant?.max_bedrooms || '',
    // Follow-up
    follow_up_date:      applicant?.follow_up_date || '',
    follow_up_note:      applicant?.follow_up_note || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      if (!payload.email) delete payload.email
      if (!payload.phone) delete payload.phone
      if (!payload.source) delete payload.source
      if (!payload.viewing_date) delete payload.viewing_date
      if (!payload.desired_move_in) delete payload.desired_move_in
      if (!payload.monthly_budget) delete payload.monthly_budget
      if (!payload.notes) delete payload.notes
      if (!payload.follow_up_date) delete payload.follow_up_date
      if (!payload.follow_up_note) delete payload.follow_up_note
      if (!payload.assigned_agent) delete payload.assigned_agent
      if (payload.min_bedrooms === '') delete payload.min_bedrooms
      if (payload.max_bedrooms === '') delete payload.max_bedrooms

      if (payload.unit_id) {
        const u = units.find(u => String(u.unit_id) === payload.unit_id)
        payload.unit_id = parseInt(payload.unit_id)
        if (u) payload.property_id = u.property_id
      } else {
        delete payload.unit_id
      }

      if (isEdit) {
        await api.put(`/applicants/${applicant.id}`, payload)
      } else {
        await api.post('/applicants', payload)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    }
    setSaving(false)
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  const TABS = [
    { key: 'details',     label: 'Details' },
    { key: 'preferences', label: 'Preferences' },
    { key: 'followup',    label: 'Follow-up' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit Applicant' : 'Add Applicant'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-4">

            {/* ── Details tab ── */}
            {activeTab === 'details' && <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className={inp} placeholder="Jane Smith" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className={inp} placeholder="jane@email.co.uk" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inp} placeholder="+44 7700 900000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={inp}>
                    <option value="">Unknown</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inp}>
                    {ALL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Agent</label>
                <input value={form.assigned_agent} onChange={e => setForm({ ...form, assigned_agent: e.target.value })}
                  className={inp} placeholder="e.g. Sarah Jones" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property / Unit</label>
                <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })} className={inp}>
                  <option value="">Not specified</option>
                  {units.map(u => <option key={u.unit_id} value={u.unit_id}>{u.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Viewing Date &amp; Time</label>
                  <input type="datetime-local" value={form.viewing_date} onChange={e => setForm({ ...form, viewing_date: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desired Move-in</label>
                  <input type="date" value={form.desired_move_in} onChange={e => setForm({ ...form, desired_move_in: e.target.value })} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencing Status</label>
                  <select value={form.referencing_status} onChange={e => setForm({ ...form, referencing_status: e.target.value })} className={inp}>
                    {REFERENCING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" checked={form.right_to_rent_checked}
                      onChange={e => setForm({ ...form, right_to_rent_checked: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Right to Rent checked</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3} placeholder="Any general notes…" className={inp} />
              </div>
            </>}

            {/* ── Preferences tab ── */}
            {activeTab === 'preferences' && <>
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-xs text-indigo-700 mb-2">
                Record what this applicant is looking for to help match them to the right property.
              </div>
              <TagInput
                label="Preferred Areas / Neighbourhoods"
                value={form.preferred_areas}
                onChange={v => setForm({ ...form, preferred_areas: v })}
                placeholder="e.g. Chorlton, Didsbury…"
              />
              <TagInput
                label="Must-haves"
                value={form.must_haves}
                onChange={v => setForm({ ...form, must_haves: v })}
                placeholder="e.g. parking, garden, pets allowed…"
              />
              <TagInput
                label="Dislikes / Deal-breakers"
                value={form.dislikes}
                onChange={v => setForm({ ...form, dislikes: v })}
                placeholder="e.g. top floor, busy road, shared entrance…"
              />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget</label>
                  <input value={form.monthly_budget} onChange={e => setForm({ ...form, monthly_budget: e.target.value })}
                    className={inp} placeholder="e.g. £900–£1,100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Bedrooms</label>
                  <input type="number" min="0" max="10" value={form.min_bedrooms}
                    onChange={e => setForm({ ...form, min_bedrooms: e.target.value })} className={inp} placeholder="Any" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Bedrooms</label>
                  <input type="number" min="0" max="10" value={form.max_bedrooms}
                    onChange={e => setForm({ ...form, max_bedrooms: e.target.value })} className={inp} placeholder="Any" />
                </div>
              </div>
            </>}

            {/* ── Follow-up tab ── */}
            {activeTab === 'followup' && <>
              <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700 mb-2">
                Set a follow-up reminder. You'll see overdue follow-ups at the top of the Applicants page.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                <input type="date" value={form.follow_up_date}
                  onChange={e => setForm({ ...form, follow_up_date: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Note</label>
                <textarea value={form.follow_up_note} onChange={e => setForm({ ...form, follow_up_note: e.target.value })}
                  rows={4} placeholder="What needs to be done? e.g. Call to check still looking, Send shortlist of new properties…"
                  className={inp} />
              </div>
              {form.follow_up_date && (
                <div className="flex gap-2 flex-wrap">
                  {[1, 3, 7, 14].map(days => (
                    <button key={days} type="button"
                      onClick={() => {
                        const d = new Date(); d.setDate(d.getDate() + days)
                        setForm({ ...form, follow_up_date: d.toISOString().slice(0, 10) })
                      }}
                      className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50 text-gray-600">
                      +{days}d
                    </button>
                  ))}
                </div>
              )}
            </>}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* Convert to tenancy banner */}
          {isEdit && applicant?.status === 'approved' && applicant?.unit_id && (
            <div className="mx-6 mb-4 border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-800">Ready to convert</p>
                <p className="text-xs text-emerald-600 mt-0.5">Create tenant record and lease.</p>
              </div>
              <button type="button" onClick={() => setShowConvert(true)}
                className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700">
                Convert to Tenancy
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-6 pb-5 shrink-0">
            {isEdit && onDelete
              ? <button type="button" onClick={onDelete} className="text-sm text-red-500 hover:text-red-700">Delete</button>
              : <div />
            }
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60">
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Applicant'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showConvert && (
        <ConvertModal
          applicant={applicant}
          onClose={() => setShowConvert(false)}
          onConverted={() => { setShowConvert(false); onClose() }}
        />
      )}
    </div>
  )
}
