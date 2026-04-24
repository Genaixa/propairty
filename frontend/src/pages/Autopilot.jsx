import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || ''

const CHECK_ICONS = {
  maintenance_unassigned:        { icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z', color: 'indigo' },
  maintenance_stalled:           { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'amber' },
  tenant_message_unanswered:     { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'blue' },
  contractor_message_unanswered: { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'orange' },
  lease_expiring_no_offer:       { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'purple' },
  renewal_no_response:           { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'teal' },
  compliance_expiring:           { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'red' },
  arrears_chase:                 { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'rose' },
  applicant_followup_overdue:    { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'amber' },
  applicant_stage_stalled:       { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'indigo' },
  applicant_referencing_stalled: { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'purple' },
  deposit_not_registered:        { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', color: 'rose' },
  inventory_missing_movein:      { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: 'blue' },
  tenant_portal_inactive:        { icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', color: 'orange' },
  survey_not_sent:               { icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', color: 'teal' },
  landlord_message_unread:       { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'green' },
  renewal_pending_too_long:      { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'purple' },
  no_inspection:                 { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', color: 'red' },
  vacant_unit_matches:           { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'green' },
}

const COLOR_CLASSES = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  teal:   { bg: 'bg-teal-50',   icon: 'text-teal-600',   badge: 'bg-teal-100 text-teal-700' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-700' },
  rose:   { bg: 'bg-rose-50',   icon: 'text-rose-600',   badge: 'bg-rose-100 text-rose-700' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
}

const ACTION_LABELS = {
  portal_message_tenant:     'Messaged tenant',
  portal_message_contractor: 'Messaged contractor',
  agent_alert:               'Alerted agent',
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 cursor-pointer ${checked ? 'bg-indigo-600' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function Autopilot() {
  const [config, setConfig] = useState(null)
  const [log, setLog] = useState([])
  const [preview, setPreview] = useState(null)
  const [running, setRunning] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const [cfgRes, logRes] = await Promise.all([
      fetch(`${API}/api/autopilot/config`, { headers }),
      fetch(`${API}/api/autopilot/log?limit=100`, { headers }),
    ])
    if (cfgRes.ok) setConfig(await cfgRes.json())
    if (logRes.ok) setLog(await logRes.json())
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async (patch) => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/autopilot/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleMaster = (val) => saveConfig({ enabled: val })

  const toggleCheck = (checkName, val) => {
    const current = config.checks[checkName] || {}
    saveConfig({ checks: { [checkName]: { ...current, enabled: val } } })
  }

  const updateDays = (checkName, days) => {
    const current = config.checks[checkName] || {}
    saveConfig({ checks: { [checkName]: { ...current, days: parseInt(days, 10) } } })
  }

  const runPreview = async () => {
    setPreviewing(true)
    setPreview(null)
    try {
      const res = await fetch(`${API}/api/autopilot/preview`, { headers })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      }
    } finally {
      setPreviewing(false)
    }
  }

  const runNow = async () => {
    setRunning(true)
    try {
      const res = await fetch(`${API}/api/autopilot/run`, { method: 'POST', headers })
      if (res.ok) {
        showToast('Autopilot run started — activity log will update shortly')
        setTimeout(load, 3000)
      }
    } finally {
      setRunning(false)
    }
  }

  if (!config) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </Layout>
    )
  }

  const checkEntries = Object.entries(config.checks || {})

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Autopilot</h1>
            <p className="mt-1 text-sm text-gray-500 max-w-xl">
              Watches every active workflow across all four portals. When something stalls —
              a contractor goes quiet, a tenant's message sits unanswered, a lease is nearly up —
              Autopilot steps in and nudges the right person automatically.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium text-gray-700">{config.enabled ? 'Active' : 'Off'}</span>
            <Toggle checked={config.enabled} onChange={toggleMaster} />
          </div>
        </div>

        {/* Status banner */}
        {config.enabled ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-sm font-medium text-green-800">
              Autopilot is active — running every 4 hours across all workflows
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={runPreview}
                disabled={previewing}
                className="text-xs font-medium text-green-700 hover:text-green-900 underline cursor-pointer disabled:opacity-50"
              >
                {previewing ? 'Checking…' : 'Preview what would run'}
              </button>
              <span className="text-green-400">·</span>
              <button
                onClick={runNow}
                disabled={running}
                className="text-xs font-medium text-green-700 hover:text-green-900 underline cursor-pointer disabled:opacity-50"
              >
                {running ? 'Running…' : 'Run now'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-sm text-gray-600">
              Autopilot is off — toggle the switch above to activate it
            </span>
          </div>
        )}

        {/* Preview results */}
        {preview && (
          <div className="bg-white border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-indigo-800">Preview — {preview.count} action{preview.count !== 1 ? 's' : ''} would be taken right now</h3>
              <button onClick={() => setPreview(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close preview">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {preview.count === 0 ? (
              <p className="text-sm text-gray-500">Everything is up to date — no actions needed.</p>
            ) : (
              <ul className="space-y-1">
                {preview.actions.map((a, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-indigo-400 shrink-0">·</span>
                    <span>[{a.check}] {a.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Check cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Checks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checkEntries.map(([checkName, check]) => {
              const iconMeta = CHECK_ICONS[checkName] || CHECK_ICONS.maintenance_unassigned
              const colors = COLOR_CLASSES[iconMeta.color]
              const isEnabled = check.enabled !== false
              return (
                <div
                  key={checkName}
                  className={`bg-white border rounded-xl p-4 transition-opacity ${!isEnabled || !config.enabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${colors.bg}`}>
                      <svg className={`w-5 h-5 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconMeta.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900">{check.label}</span>
                        <Toggle
                          checked={isEnabled}
                          onChange={(val) => toggleCheck(checkName, val)}
                          disabled={!config.enabled}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{check.description}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-gray-500">Trigger after</span>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={check.days}
                          onChange={(e) => updateDays(checkName, e.target.value)}
                          disabled={!isEnabled || !config.enabled}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        <span className="text-xs text-gray-500">{check.unit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity log */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Activity Log</h2>
            <button onClick={load} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">Refresh</button>
          </div>
          {log.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-400">No activity yet — enable Autopilot and run it to see actions here</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">When</th>
                    <th className="text-left px-4 py-3">Check</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, i) => {
                    const iconMeta = CHECK_ICONS[entry.check_type] || CHECK_ICONS.maintenance_unassigned
                    const colors = COLOR_CLASSES[iconMeta.color]
                    const when = new Date(entry.created_at)
                    const relative = formatRelative(when)
                    return (
                      <tr key={entry.id} className={`border-b last:border-0 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{relative}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                            {CHECKS_META_LABEL[entry.check_type] || entry.check_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {ACTION_LABELS[entry.action] || entry.action}
                          {entry.recipient_label && <span className="text-gray-400"> → {entry.recipient_label}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
                          {entry.message_sent ? (
                            <details className="cursor-pointer">
                              <summary className="truncate">{entry.summary}</summary>
                              <p className="mt-1 text-xs bg-gray-100 rounded p-2 whitespace-pre-wrap">{entry.message_sent}</p>
                            </details>
                          ) : entry.summary}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHECKS_META_LABEL = {
  maintenance_unassigned:        'Unassigned job',
  maintenance_stalled:           'Stalled job',
  tenant_message_unanswered:     'Tenant message',
  contractor_message_unanswered: 'Contractor message',
  lease_expiring_no_offer:       'Expiring lease',
  renewal_no_response:           'Renewal offer',
  compliance_expiring:           'Compliance',
  arrears_chase:                 'Arrears',
  applicant_followup_overdue:    'Follow-up due',
  applicant_stage_stalled:       'Applicant stalled',
  applicant_referencing_stalled: 'Referencing stalled',
  deposit_not_registered:        'Deposit missing',
  inventory_missing_movein:      'Inventory missing',
  tenant_portal_inactive:        'Portal inactive',
  survey_not_sent:               'Survey unsent',
  landlord_message_unread:       'Landlord message',
  renewal_pending_too_long:      'Renewal pending',
  no_inspection:                 'No inspection',
  vacant_unit_matches:           'Applicant matches',
}

function formatRelative(date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
