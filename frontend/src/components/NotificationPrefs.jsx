import { useEffect, useState } from 'react'

/**
 * Reusable notification preferences panel for tenant/landlord/contractor portals.
 *
 * Props:
 *   getUrl   — GET endpoint for current prefs
 *   putUrl   — PUT endpoint to save prefs
 *   botName  — Telegram bot username e.g. "@PropAIrtyBot"
 */
export default function NotificationPrefs({ getUrl, putUrl, tokenKey = 'token', botName = '@PropAIrtyBot' }) {
  const [prefs, setPrefs] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` }
  }

  useEffect(() => {
    fetch(getUrl, { headers: authHeader() })
      .then(r => r.json())
      .then(setPrefs)
      .catch(() => {})
  }, [getUrl])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          notify_email: prefs.notify_email,
          notify_whatsapp: prefs.notify_whatsapp,
          notify_telegram: prefs.notify_telegram,
          whatsapp_number: prefs.whatsapp_number || '',
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (_) {}
    setSaving(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(`/link ${prefs.telegram_link_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!prefs) return null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Message Notifications</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Messages always appear in your portal. Choose how else you'd like to be alerted.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Email */}
        <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${prefs.notify_email ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <input
            type="checkbox"
            checked={prefs.notify_email}
            onChange={e => setPrefs(p => ({ ...p, notify_email: e.target.checked }))}
            className="mt-0.5 accent-indigo-600"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">📧 Email</p>
            <p className="text-xs text-gray-500 mt-0.5">Get an email with a preview and a link to your portal.</p>
          </div>
        </label>

        {/* WhatsApp */}
        <div className={`p-4 rounded-xl border-2 transition-colors ${prefs.notify_whatsapp ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notify_whatsapp}
              onChange={e => setPrefs(p => ({ ...p, notify_whatsapp: e.target.checked }))}
              className="mt-0.5 accent-green-600"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">💬 WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">Receive a WhatsApp message when someone writes to you.</p>
            </div>
          </label>
          {prefs.notify_whatsapp && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp number (with country code)</label>
              <input
                type="tel"
                value={prefs.whatsapp_number}
                onChange={e => setPrefs(p => ({ ...p, whatsapp_number: e.target.value }))}
                placeholder="+447911123456"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}
        </div>

        {/* Telegram */}
        <div className={`p-4 rounded-xl border-2 transition-colors ${prefs.notify_telegram ? 'border-sky-400 bg-sky-50' : 'border-gray-200'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notify_telegram}
              onChange={e => setPrefs(p => ({ ...p, notify_telegram: e.target.checked }))}
              className="mt-0.5 accent-sky-600"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800">✈️ Telegram</p>
              <p className="text-xs text-gray-500 mt-0.5">Get a Telegram message with a direct link to reply.</p>
            </div>
          </label>
          {prefs.notify_telegram && (
            <div className="mt-3 space-y-2">
              {prefs.telegram_linked ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full">✓ Linked</span>
                  <span className="text-xs text-gray-500">Your Telegram is connected</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600">
                    Open <strong>{botName}</strong> on Telegram and send this command:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-sky-200 rounded-lg px-3 py-1.5 text-xs font-mono text-sky-800 select-all">
                      /link {prefs.telegram_link_code}
                    </code>
                    <button
                      onClick={copyCode}
                      className="text-xs text-sky-600 hover:text-sky-800 font-semibold whitespace-nowrap"
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">Once sent, your account will be linked automatically.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
