import { useState } from 'react'

/**
 * Reusable profile dropdown for all portals.
 *
 * Props:
 *   me          — { full_name, email, phone? }
 *   onUpdate    — async (patch) => updatedMe   — calls PATCH /me
 *   onPassword  — async ({ current, next })    — calls POST /me/change-password
 *   onLogout    — function
 *   accentClass — Tailwind focus-ring + button colour, e.g. 'focus:ring-indigo-500' + btn bg
 *   btnClass    — active button bg class, e.g. 'bg-indigo-600 hover:bg-indigo-700'
 *   hasPhone    — bool, default true
 */
export default function ProfileDropdown({ me, onUpdate, onPassword, onLogout, accentRing = 'focus:ring-indigo-500', btnClass = 'bg-indigo-600 hover:bg-indigo-700', hasPhone = true }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  function openDropdown() {
    setForm({ full_name: me.full_name, phone: me.phone || '' })
    setMsg('')
    setPwMsg('')
    setPw({ current: '', next: '', confirm: '' })
    setOpen(true)
  }

  async function saveDetails(e) {
    e.preventDefault()
    setSaving(true); setMsg('')
    try {
      await onUpdate(form)
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setMsg('Failed to save.')
    } finally { setSaving(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pw.next !== pw.confirm) { setPwMsg('Passwords do not match.'); return }
    setPwSaving(true); setPwMsg('')
    try {
      await onPassword({ current: pw.current, next: pw.next })
      setPwMsg('Updated!')
      setPw({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwMsg(''), 3000)
    } catch (err) {
      setPwMsg(err.response?.data?.detail || 'Failed.')
    } finally { setPwSaving(false) }
  }

  const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${accentRing}`

  return (
    <div className="relative">
      <button onClick={openDropdown}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors group">
        <span>Hello, <span className="font-medium">{me.full_name}</span></span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{me.full_name}</p>
                <p className="text-xs text-gray-400">{me.email}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>

            {/* My Details */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">My Details</p>
              {form && (
                <form onSubmit={saveDetails} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Full name</label>
                    <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  {hasPhone && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phone</label>
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className={inputCls} placeholder="+44…" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button type="submit" disabled={saving}
                      className={`text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors ${btnClass}`}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    {msg && <span className={`text-xs ${msg === 'Saved!' ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}
                  </div>
                </form>
              )}
            </div>

            {/* Change Password */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Change Password</p>
              <form onSubmit={savePassword} className="space-y-2">
                {[['current', 'Current password'], ['next', 'New password'], ['confirm', 'Confirm new']].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input type="password" value={pw[key]} onChange={e => setPw(f => ({ ...f, [key]: e.target.value }))}
                      className={inputCls} required />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={pwSaving}
                    className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                    {pwSaving ? 'Saving…' : 'Update'}
                  </button>
                  {pwMsg && <span className={`text-xs ${pwMsg.includes('Updated') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</span>}
                </div>
              </form>
            </div>

            {/* Sign out */}
            <div className="px-5 py-3">
              <button onClick={onLogout} className="w-full text-sm text-red-500 hover:text-red-700 font-medium text-left">Sign out</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
