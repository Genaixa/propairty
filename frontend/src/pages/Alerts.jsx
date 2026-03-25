import { useState } from 'react'
import api from '../lib/api'

function AlertCard({ icon, title, description, schedule }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-gray-500 text-sm mt-0.5">{description}</p>
        <p className="text-xs text-indigo-500 mt-1">{schedule}</p>
      </div>
    </div>
  )
}

export default function Alerts() {
  const [testStatus, setTestStatus] = useState(null)
  const [checkStatus, setCheckStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const sendTest = async () => {
    setLoading('test')
    try {
      await api.post('/alerts/test')
      setTestStatus('success')
    } catch {
      setTestStatus('error')
    }
    setLoading(false)
  }

  const runChecks = async () => {
    setLoading('checks')
    try {
      await api.post('/alerts/run-checks')
      setCheckStatus('success')
    } catch {
      setCheckStatus('error')
    }
    setLoading(false)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Alerts & Notifications</h2>
      <p className="text-gray-500 text-sm mb-8">PropAIrty sends alerts to your Telegram. All checks run automatically every day at 8am.</p>

      <div className="grid grid-cols-1 gap-4 mb-8">
        <AlertCard
          icon="💷"
          title="Rent Arrears"
          description="Alerts you when any payment is overdue or partially paid, with tenant name, unit, and amount owed."
          schedule="Daily at 8:00am — also available on demand"
        />
        <AlertCard
          icon="📋"
          title="Compliance Expiry"
          description="Warns you when any certificate (Gas Safety, EICR, EPC, Fire Risk, Legionella) is expired or expiring within 30 days."
          schedule="Daily at 8:00am — also available on demand"
        />
        <AlertCard
          icon="🔧"
          title="Urgent Maintenance"
          description="Instant alert when a new maintenance request is logged. Daily summary of all open high/urgent issues."
          schedule="Instant on creation + daily at 8:00am"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Telegram Connection</h3>
        <p className="text-sm text-gray-500 mb-5">Alerts are sent to <strong>@MyGoilemBot</strong> via Telegram.</p>

        <div className="flex gap-3">
          <button
            onClick={sendTest}
            disabled={loading === 'test'}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
          >
            {loading === 'test' ? 'Sending…' : 'Send Test Message'}
          </button>
          <button
            onClick={runChecks}
            disabled={loading === 'checks'}
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
          >
            {loading === 'checks' ? 'Running…' : 'Run All Checks Now'}
          </button>
        </div>

        {testStatus === 'success' && (
          <p className="text-green-600 text-sm mt-3">Test message sent — check your Telegram.</p>
        )}
        {checkStatus === 'success' && (
          <p className="text-green-600 text-sm mt-3">Checks complete — alerts sent for any issues found.</p>
        )}
        {(testStatus === 'error' || checkStatus === 'error') && (
          <p className="text-red-500 text-sm mt-3">Failed to send. Check that TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.</p>
        )}
      </div>
    </div>
  )
}
