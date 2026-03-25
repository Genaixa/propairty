import { useState, useEffect } from 'react'
import api from '../lib/api'

const URGENCY_CFG = {
  urgent: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'URGENT' },
  standard: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400', label: 'Standard' },
}

const CONFIDENCE_CFG = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-red-500',
}

export default function Dispatch() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [tab, setTab] = useState('queue')
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [contractors, setContractors] = useState([])
  const [dispatchModal, setDispatchModal] = useState(null) // {group or urgent item}
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [qRes, hRes, cRes] = await Promise.all([
        api.get('/dispatch/queue'),
        api.get('/dispatch/history'),
        api.get('/contractors'),
      ])
      setData(qRes.data)
      setSettings(qRes.data.settings)
      setHistory(hRes.data)
      setContractors(cRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function toggleAutoMode() {
    setSaving(true)
    const newMode = !settings.auto_mode
    await api.put('/dispatch/settings', { auto_mode: newMode })
    setSettings(s => ({ ...s, auto_mode: newMode }))
    loadAll()
    setSaving(false)
  }

  async function updateSetting(key, value) {
    await api.put('/dispatch/settings', { [key]: value })
    setSettings(s => ({ ...s, [key]: value }))
  }

  async function removeFromQueue(id) {
    await api.delete(`/dispatch/queue/${id}`)
    loadAll()
  }

  const urgentCount = data?.urgent?.length || 0
  const queuedCount = data?.total_queued || 0

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading dispatch system...</div>
  }

  return (
    <div>
      {/* Header with mode toggle */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Dispatch</h1>
          <p className="text-sm text-gray-500 mt-1">AI triage · area batching · smart dispatch</p>
        </div>

        {/* AUTO/MANUAL toggle */}
        <div className={`flex items-center gap-4 rounded-2xl px-5 py-4 border-2 ${settings?.auto_mode ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <p className={`text-sm font-bold ${settings?.auto_mode ? 'text-green-700' : 'text-gray-600'}`}>
              {settings?.auto_mode ? '🤖 Auto Mode ON' : '👤 Manual Mode'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {settings?.auto_mode
                ? `Dispatches when ${settings.area_threshold} jobs in area or ${settings.max_wait_days}d wait`
                : 'You review and approve all dispatches'}
            </p>
          </div>
          <button
            onClick={toggleAutoMode}
            disabled={saving}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings?.auto_mode ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings?.auto_mode ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Settings bar */}
      {settings && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-6 items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dispatch Rules</p>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>Area threshold:</span>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.area_threshold}
              onChange={e => updateSetting('area_threshold', parseInt(e.target.value))}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">jobs</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>Max wait:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={settings.max_wait_days}
              onChange={e => updateSetting('max_wait_days', parseInt(e.target.value))}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400">days</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.urgent_auto_dispatch}
              onChange={e => updateSetting('urgent_auto_dispatch', e.target.checked)}
              className="rounded"
            />
            <span>Always auto-dispatch urgent jobs</span>
          </label>

          <div className="ml-auto flex gap-4 text-sm">
            <span className="text-gray-500">{queuedCount} queued</span>
            {urgentCount > 0 && <span className="text-red-600 font-semibold">🚨 {urgentCount} urgent</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          ['queue', `Queue (${queuedCount})`],
          ['history', `History (${history.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="space-y-4">
          {/* Urgent jobs */}
          {data?.urgent?.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-red-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-red-800">🚨 Urgent — Immediate Action Required ({data.urgent.length})</h3>
              </div>
              <div className="divide-y divide-red-100">
                {data.urgent.map(job => (
                  <JobRow
                    key={job.id}
                    job={job}
                    contractors={contractors}
                    onDispatch={ids => setDispatchModal({ ids, trade: job.trade, area: job.area, contractor: contractors.find(c => c.trade === job.trade) })}
                    onRemove={() => removeFromQueue(job.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Area groups */}
          {data?.groups?.length === 0 && data?.urgent?.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <p className="text-3xl mb-3">✅</p>
              <p className="font-medium">Queue is empty — no jobs awaiting dispatch</p>
            </div>
          )}

          {data?.groups?.map(group => (
            <AreaGroup
              key={`${group.trade}-${group.area}`}
              group={group}
              contractors={contractors}
              settings={settings}
              onDispatchAll={() => setDispatchModal({
                ids: group.jobs.map(j => j.id),
                trade: group.trade,
                area: group.area,
                suggestedContractor: group.suggested_contractor,
              })}
              onRemove={id => removeFromQueue(id)}
            />
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">No dispatch history yet.</div>
          ) : history.map(b => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{b.trade_label} · {b.area}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.dispatched_by?.startsWith('auto') ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {b.dispatched_by?.startsWith('auto') ? '🤖 Auto' : '👤 Manual'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.contractor}{b.contractor_company ? ` (${b.contractor_company})` : ''} · {b.job_count} job{b.job_count !== 1 ? 's' : ''} · {b.created_at?.slice(0, 10)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {b.jobs.map((j, i) => (
                  <p key={i} className="text-xs text-gray-600">• <strong>{j.property} · {j.unit}</strong> — {j.ai_summary || j.title}</p>
                ))}
              </div>
              {b.note && <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 mt-3">{b.note}</p>}
            </div>
          ))}
        </div>
      )}

      {dispatchModal && (
        <DispatchModal
          modal={dispatchModal}
          contractors={contractors}
          onClose={() => setDispatchModal(null)}
          onDispatched={() => { setDispatchModal(null); loadAll() }}
        />
      )}
    </div>
  )
}

function JobRow({ job, contractors, onDispatch, onRemove }) {
  const ucfg = URGENCY_CFG[job.urgency] || URGENCY_CFG.standard
  return (
    <div className="px-5 py-4 flex items-start gap-4">
      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ucfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900">{job.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${ucfg.bg} ${ucfg.text}`}>{ucfg.label}</span>
          {job.ai_confidence && (
            <span className={`text-xs ${CONFIDENCE_CFG[job.ai_confidence]}`}>AI {job.ai_confidence}</span>
          )}
        </div>
        <p className="text-xs text-gray-500">{job.property} · {job.unit} · {job.address}</p>
        {job.ai_summary && <p className="text-xs text-indigo-700 mt-0.5">🤖 {job.ai_summary}</p>}
        {job.tenant_name && <p className="text-xs text-gray-400 mt-0.5">Tenant: {job.tenant_name}{job.tenant_phone ? ` · ${job.tenant_phone}` : ''}</p>}
        <p className="text-xs text-gray-400">Waiting {job.days_waiting}d</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onDispatch([job.id])} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">Dispatch</button>
        <button onClick={onRemove} className="text-xs text-gray-400 hover:text-red-500">✕</button>
      </div>
    </div>
  )
}

function AreaGroup({ group, contractors, settings, onDispatchAll, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const isReady = group.threshold_met || group.max_wait_exceeded

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${isReady ? 'border-indigo-300' : 'border-gray-200'}`}>
      <div
        className={`px-5 py-4 flex items-center justify-between cursor-pointer ${isReady ? 'bg-indigo-50' : 'bg-gray-50'}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{group.trade_label}</span>
              <span className="text-sm text-gray-500">·</span>
              <span className="text-sm font-semibold text-gray-700">{group.area}{group.city ? `, ${group.city}` : ''}</span>
              {isReady && (
                <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                  {group.threshold_met ? `Ready (${group.count}/${settings.area_threshold})` : `Max wait exceeded`}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {group.count} job{group.count !== 1 ? 's' : ''} · oldest {group.days_waiting}d ago
              {group.suggested_contractor && ` · Suggested: ${group.suggested_contractor.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); onDispatchAll() }}
            className={`text-sm font-semibold px-4 py-2 rounded-lg ${
              isReady
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Dispatch All ({group.count})
          </button>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {group.jobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              contractors={contractors}
              onDispatch={() => {}}
              onRemove={() => onRemove(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DispatchModal({ modal, contractors, onClose, onDispatched }) {
  const [contractorId, setContractorId] = useState(
    modal.suggestedContractor?.id?.toString() || ''
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filter contractors by trade if possible
  const relevantContractors = contractors.filter(c =>
    modal.trade ? c.trade === modal.trade : true
  )
  const otherContractors = contractors.filter(c =>
    modal.trade ? c.trade !== modal.trade : false
  )

  async function handleDispatch(e) {
    e.preventDefault()
    if (!contractorId) { setError('Please select a contractor'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/dispatch/batch', {
        queue_ids: modal.ids,
        contractor_id: parseInt(contractorId),
        note: note || null,
      })
      onDispatched()
    } catch (err) {
      setError(err.response?.data?.detail || 'Dispatch failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Dispatch Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {modal.ids.length} job{modal.ids.length !== 1 ? 's' : ''} · {modal.area}
          </p>
        </div>
        <form onSubmit={handleDispatch} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Contractor
            </label>
            {relevantContractors.length > 0 && (
              <p className="text-xs text-indigo-600 mb-2">Matching trade:</p>
            )}
            <select
              value={contractorId}
              onChange={e => setContractorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Select contractor...</option>
              {relevantContractors.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.company_name ? ` (${c.company_name})` : ''} — {c.trade}
                </option>
              ))}
              {otherContractors.length > 0 && (
                <>
                  <option disabled>── Other contractors ──</option>
                  {otherContractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}{c.company_name ? ` (${c.company_name})` : ''} — {c.trade}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Note to contractor (optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Any special instructions..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700">
            The contractor will receive an email with all job details, property addresses, and tenant contacts.
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Dispatching...' : `Dispatch ${modal.ids.length} Job${modal.ids.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
