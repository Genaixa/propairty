import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
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

function IssueSection({ title, icon, color, children }) {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50 border-red-200 text-red-800',
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${colors[color]}`}>
        <span>{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

export default function Alerts() {
  const [testStatus, setTestStatus] = useState(null)
  const [checkStatus, setCheckStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [issues, setIssues] = useState(null)
  const [issuesLoading, setIssuesLoading] = useState(true)

  useEffect(() => {
    api.get('/alerts/current-issues')
      .then(r => setIssues(r.data))
      .catch(() => {})
      .finally(() => setIssuesLoading(false))
  }, [])

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
    <div className="space-y-8">
      <PageHeader title="Alerts & Notifications" subtitle="Automated daily checks sent to your Telegram at 8am" />

      {/* Live issues panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">Current Issues</h3>
          {issues && issues.total_issues > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {issues.total_issues} issue{issues.total_issues !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {issuesLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
            Checking for issues…
          </div>
        ) : !issues || issues.total_issues === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-green-500 text-xl">✓</span>
            <p className="text-green-700 text-sm font-medium">No current issues — everything looks good.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.arrears?.length > 0 && (
              <IssueSection title="Rent Arrears" icon="💷" color="red">
                {issues.arrears.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.tenant_name}</p>
                      <p className="text-xs text-gray-400">{a.property} · due {a.due_date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-red-600">£{a.owed?.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{a.days_overdue}d overdue</p>
                    </div>
                  </div>
                ))}
              </IssueSection>
            )}

            {issues.expiring_certs?.length > 0 && (
              <IssueSection title="Compliance — Expiring Soon" icon="📋" color="amber">
                {issues.expiring_certs.map((c, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.cert_type}</p>
                      <p className="text-xs text-gray-400">{c.property}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.expired ? (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">EXPIRED</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{c.days_left}d left</span>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">Expires {c.expiry_date}</p>
                    </div>
                  </div>
                ))}
              </IssueSection>
            )}

            {issues.urgent_maintenance?.length > 0 && (
              <IssueSection title="Urgent Maintenance" icon="🔧" color="blue">
                {issues.urgent_maintenance.map((m, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400">{m.property} · {m.status}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      m.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {m.priority}
                    </span>
                  </div>
                ))}
              </IssueSection>
            )}
          </div>
        )}
      </div>

      {/* Alert types */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-3">Automated Alert Schedule</h3>
        <div className="grid grid-cols-1 gap-4">
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
      </div>

      {/* Telegram controls */}
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
