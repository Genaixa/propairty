import { useState, useEffect } from 'react'
import api from '../lib/api'

const STAGES = [
  { key: 'enquiry',        label: 'Enquiry',        color: 'bg-gray-100 border-gray-300',   dot: 'bg-gray-400' },
  { key: 'viewing_booked', label: 'Viewing Booked', color: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-400' },
  { key: 'viewed',         label: 'Viewed',         color: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-400' },
  { key: 'referencing',    label: 'Referencing',    color: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-400' },
  { key: 'approved',       label: 'Approved',       color: 'bg-green-50 border-green-200',  dot: 'bg-green-500' },
  { key: 'tenancy_created',label: 'Tenancy Created',color: 'bg-emerald-50 border-emerald-300', dot: 'bg-emerald-500' },
]
const TERMINAL = [
  { key: 'rejected',   label: 'Rejected',   color: 'bg-red-50 border-red-200',    dot: 'bg-red-400' },
  { key: 'withdrawn',  label: 'Withdrawn',  color: 'bg-gray-50 border-gray-200',  dot: 'bg-gray-400' },
]
const ALL_STAGES = [...STAGES, ...TERMINAL]
const SOURCES = ['Rightmove', 'Zoopla', 'SpareRoom', 'OpenRent', 'Direct', 'Referral', 'Other']

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

export default function Applicants() {
  const [applicants, setApplicants] = useState([])
  const [pipeline, setPipeline] = useState(null)
  const [units, setUnits] = useState([])
  const [view, setView] = useState('board')   // board | list
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showTerminal, setShowTerminal] = useState(false)

  const load = async () => {
    const [ar, pr] = await Promise.all([api.get('/applicants'), api.get('/applicants/pipeline')])
    setApplicants(ar.data)
    setPipeline(pr.data)
  }

  useEffect(() => {
    load()
    api.get('/applicants/units-available').then(r => setUnits(r.data)).catch(() => {})
  }, [])

  const activeApplicants = applicants.filter(a => !['rejected', 'withdrawn'].includes(a.status))
  const terminalApplicants = applicants.filter(a => ['rejected', 'withdrawn'].includes(a.status))

  async function advanceStage(applicant) {
    const next = NEXT_STAGE[applicant.status]
    if (!next) return
    await api.put(`/applicants/${applicant.id}`, { status: next })
    load()
  }

  async function setStage(applicant, status) {
    await api.put(`/applicants/${applicant.id}`, { status })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Applicants</h2>
          {pipeline && (
            <p className="text-sm text-gray-500 mt-0.5">
              {pipeline.total_active} active · {pipeline.counts.tenancy_created} converted
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('board')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'board' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              Board
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              List
            </button>
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
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {STAGES.map(stage => {
              const cards = activeApplicants.filter(a => a.status === stage.key)
              return (
                <div key={stage.key} className="w-64 flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border ${stage.color}`}>
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                    <span className="ml-auto text-xs bg-white rounded-full px-2 py-0.5 font-bold text-gray-600">{cards.length}</span>
                  </div>
                  <div className="space-y-2 mt-2 min-h-[120px]">
                    {cards.map(a => (
                      <ApplicantCard
                        key={a.id}
                        applicant={a}
                        onOpen={() => setSelected(a)}
                        onAdvance={() => advanceStage(a)}
                        showAdvance={!!NEXT_STAGE[a.status]}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                        No applicants
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
                  {['Name', 'Property', 'Source', 'Stage', 'Viewing', 'Added', ''].map(h => (
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
                        {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{a.property_name || '—'}{a.unit_name ? ` · ${a.unit_name}` : ''}</td>
                      <td className="px-5 py-3.5 text-gray-500">{a.source || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${si.color}`}>
                          {si.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {a.viewing_date ? new Date(a.viewing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
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

      {/* Add modal */}
      {showAdd && (
        <ApplicantModal
          units={units}
          onClose={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Manage/edit modal */}
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


function ApplicantCard({ applicant: a, onOpen, onAdvance, showAdvance }) {
  const si = stageInfo(a.status)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between mb-2">
        <p className="font-semibold text-gray-900 text-sm leading-tight">{a.full_name}</p>
        {a.source && (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{a.source}</span>
        )}
      </div>
      {(a.property_name || a.unit_name) && (
        <p className="text-xs text-gray-500 mb-1.5">{a.property_name}{a.unit_name ? ` · ${a.unit_name}` : ''}</p>
      )}
      {a.viewing_date && (
        <p className="text-xs text-blue-600 mb-1.5">
          Viewing: {new Date(a.viewing_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
      {showAdvance && (
        <button
          onClick={e => { e.stopPropagation(); onAdvance() }}
          className="mt-2.5 w-full text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-md py-1 hover:bg-indigo-50 transition-colors"
        >
          Advance →
        </button>
      )}
    </div>
  )
}


function ApplicantModal({ applicant, units, onClose, onDelete }) {
  const isEdit = !!applicant
  const [form, setForm] = useState({
    full_name: applicant?.full_name || '',
    email: applicant?.email || '',
    phone: applicant?.phone || '',
    source: applicant?.source || '',
    status: applicant?.status || 'enquiry',
    unit_id: applicant?.unit_id ? String(applicant.unit_id) : '',
    viewing_date: applicant?.viewing_date ? applicant.viewing_date.slice(0, 16) : '',
    desired_move_in: applicant?.desired_move_in || '',
    monthly_budget: applicant?.monthly_budget || '',
    notes: applicant?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form }
      if (!payload.email) delete payload.email
      if (!payload.phone) delete payload.phone
      if (!payload.source) delete payload.source
      if (!payload.viewing_date) delete payload.viewing_date
      if (!payload.desired_move_in) delete payload.desired_move_in
      if (!payload.monthly_budget) delete payload.monthly_budget
      if (!payload.notes) delete payload.notes

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

  const field = (label, key, type = 'text', opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        {...opts}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit Applicant' : 'Add Applicant'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {field('Full Name', 'full_name', 'text', { required: true, placeholder: 'Jane Smith' })}

          <div className="grid grid-cols-2 gap-4">
            {field('Email', 'email', 'email', { placeholder: 'jane@email.co.uk' })}
            {field('Phone', 'phone', 'tel', { placeholder: '+44 7700 900000' })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Unknown</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ALL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property / Unit</label>
            <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Not specified</option>
              {units.map(u => <option key={u.unit_id} value={u.unit_id}>{u.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Viewing Date &amp; Time</label>
              <input type="datetime-local" value={form.viewing_date} onChange={e => setForm({ ...form, viewing_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desired Move-in</label>
              <input type="date" value={form.desired_move_in} onChange={e => setForm({ ...form, desired_move_in: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {field('Monthly Budget', 'monthly_budget', 'text', { placeholder: 'e.g. £900–£1,100' })}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="References, requirements, preferences…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {isEdit && onDelete ? (
              <button type="button" onClick={onDelete} className="text-sm text-red-500 hover:text-red-700">Delete</button>
            ) : <div />}
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
    </div>
  )
}
