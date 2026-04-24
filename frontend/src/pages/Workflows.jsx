import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

const ACTION_LABELS = {
  email_tenant:   { label: 'Email tenant',   icon: '✉️' },
  email_landlord: { label: 'Email landlord', icon: '📧' },
  telegram_agent: { label: 'Alert agent',    icon: '💬' },
}

const TRIGGER_ICONS = {
  rent_overdue:        '⚠️',
  lease_expiring:      '🔄',
  maintenance_stale:   '🔧',
  viewing_reminder:    '📅',
  inspection_upcoming: '🔍',
  ppm_due:             '🗓️',
  deposit_unprotected: '🏦',
}

const ACTIONS = ['email_tenant', 'email_landlord', 'telegram_agent']

export default function Workflows() {
  const [rules, setRules] = useState([])
  const [triggers, setTriggers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', trigger: '', trigger_days: 7, action: 'telegram_agent' })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [rRes, tRes] = await Promise.all([
        api.get('/workflows'),
        api.get('/workflows/triggers'),
      ])
      setRules(rRes.data)
      setTriggers(tRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function toggle(rule) {
    await api.put(`/workflows/${rule.id}`, { is_active: !rule.is_active })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !rule.is_active } : r))
  }

  async function deleteRule(id) {
    if (!confirm('Delete this rule?')) return
    await api.delete(`/workflows/${id}`)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  async function updateDays(rule, days) {
    if (!days || isNaN(days)) return
    await api.put(`/workflows/${rule.id}`, { trigger_days: parseInt(days) })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, trigger_days: parseInt(days) } : r))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.trigger) return
    setSaving(true)
    try {
      const r = await api.post('/workflows', addForm)
      setRules(prev => [...prev, r.data])
      setShowAdd(false)
      setAddForm({ name: '', trigger: '', trigger_days: 7, action: 'telegram_agent' })
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create rule')
    }
    setSaving(false)
  }

  async function seedDefaults() {
    setSeeding(true)
    try {
      await api.post('/workflows/seed-defaults')
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to seed defaults')
    }
    setSeeding(false)
  }

  // Auto-fill name when trigger is selected
  function onTriggerChange(trigger) {
    const meta = triggers.find(t => t.trigger === trigger)
    setAddForm(f => ({
      ...f,
      trigger,
      name: meta ? meta.label : f.name,
      trigger_days: meta ? meta.default_days : f.trigger_days,
      action: meta ? meta.default_action : f.action,
    }))
  }

  const activeCount = rules.filter(r => r.is_active).length

  return (
    <div>
      <PageHeader title="Automated Workflows" subtitle="Rules that fire daily — emails and alerts triggered automatically">
        {rules.length === 0 && (
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {seeding ? 'Loading…' : '✨ Load defaults'}
          </button>
        )}
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add rule
        </button>
      </PageHeader>

      {/* Summary bar */}
      {rules.length > 0 && (
        <div className="flex gap-4 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-700">{activeCount}</p>
            <p className="text-xs text-indigo-500">Active rules</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{rules.length - activeCount}</p>
            <p className="text-xs text-gray-400">Paused</p>
          </div>
          <div className="ml-auto text-xs text-indigo-600 flex items-center">
            Rules run once daily at 8am
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">⚙️</p>
          <p className="text-gray-700 font-semibold mb-1">No workflow rules yet</p>
          <p className="text-gray-400 text-sm mb-5">Load the default rule set or create your own.</p>
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {seeding ? 'Loading…' : '✨ Load default rules'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const icon = TRIGGER_ICONS[rule.trigger] || '⚙️'
            const actionMeta = ACTION_LABELS[rule.action] || { label: rule.action, icon: '📢' }
            return (
              <div
                key={rule.id}
                className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 transition-opacity ${!rule.is_active ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl shrink-0">{icon}</span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {rule.trigger_label} ·{' '}
                    <span className="font-medium text-gray-700">{rule.trigger_days} {rule.trigger_unit}</span>
                    {' '}→ {actionMeta.icon} {actionMeta.label}
                  </p>
                </div>

                {/* Editable days */}
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={rule.trigger_days}
                    onBlur={e => updateDays(rule, e.target.value)}
                    className="w-14 text-center border border-gray-200 rounded-lg text-sm py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-xs text-gray-400">{rule.trigger_unit}</span>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggle(rule)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    rule.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none"
                  title="Delete rule"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add rule modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4">New Workflow Rule</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                <select
                  value={addForm.trigger}
                  onChange={e => onTriggerChange(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">— select trigger —</option>
                  {triggers.map(t => (
                    <option key={t.trigger} value={t.trigger}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule name</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="e.g. Rent overdue — chase email"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {triggers.find(t => t.trigger === addForm.trigger)?.unit || 'Days'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={addForm.trigger_days}
                    onChange={e => setAddForm(f => ({ ...f, trigger_days: parseInt(e.target.value) }))}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <select
                    value={addForm.action}
                    onChange={e => setAddForm(f => ({ ...f, action: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {ACTIONS.map(a => (
                      <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
