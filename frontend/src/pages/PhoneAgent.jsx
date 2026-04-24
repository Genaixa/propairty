import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function PhoneAgent() {
  const [status, setStatus] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])

  useEffect(() => {
    api.get('/phone/setup').then(r => setStatus(r.data)).catch(() => {})
    api.get('/maintenance?limit=20').then(r => {
      const phoneLogs = r.data.filter(j => j.description?.includes('[PHONE INTAKE'))
      setRecentJobs(phoneLogs)
    }).catch(() => {})
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <PageHeader title="AI Phone Agent" subtitle="Twilio-powered voice intake for maintenance jobs" />
      </div>

      {/* Status banner */}
      <div className={`rounded-xl border p-5 ${
        status?.configured
          ? 'bg-green-50 border-green-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{status?.configured ? '✅' : '⚠️'}</span>
          <div>
            <p className={`font-semibold ${status?.configured ? 'text-green-800' : 'text-amber-800'}`}>
              {status?.configured ? 'Phone agent is active' : 'Phone agent not yet configured'}
            </p>
            <p className={`text-sm mt-0.5 ${status?.configured ? 'text-green-700' : 'text-amber-700'}`}>
              {status?.configured
                ? 'Tenants can call your Twilio number 24/7 to log maintenance issues.'
                : 'Follow the setup steps below to activate the 24/7 AI phone line.'}
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">How it works</h2>
        <div className="space-y-4">
          {[
            { icon: '📞', title: 'Tenant calls', desc: 'Tenant dials your dedicated Twilio phone number — any time, day or night.' },
            { icon: '🤖', title: 'AI greets & listens', desc: 'AI answers in a professional UK voice, greets them by name if recognised, and asks them to describe their issue.' },
            { icon: '🧠', title: 'Claude interprets', desc: 'Claude analyses the speech, extracts the issue, sets priority (urgent for heating/flooding/gas), and writes a clear title and description.' },
            { icon: '📋', title: 'Job created automatically', desc: 'A maintenance request appears in PropAIrty instantly, tagged [PHONE INTAKE] with transcript and AI summary.' },
            { icon: '🔖', title: 'Reference given', desc: 'AI reads back a reference number (e.g. MR-00042) so the tenant knows their issue is logged.' },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                {step.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      {!status?.configured && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Setup</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <Step n={1} title="Sign up at twilio.com">
              Buy a UK phone number (~£1/mo). Copy your Account SID and Auth Token.
            </Step>
            <Step n={2} title="Add to .env.production">
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono mt-2 text-gray-600">
{`TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
              </pre>
              Restart backend: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">systemctl restart propairty</code>
            </Step>
            <Step n={3} title="Configure your Twilio number">
              In Twilio console → Phone Numbers → your number → Voice &amp; Fax:
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mt-2 font-mono text-xs text-indigo-800">
                {status?.webhook_url || 'https://propairty.co.uk/api/phone/incoming'}
              </div>
              Method: <strong>HTTP POST</strong>
            </Step>
            <Step n={4} title="Share the number with tenants">
              Add it to your welcome pack, tenant portal, and email signatures. Tenants call it any time to report issues.
            </Step>
          </div>
        </div>
      )}

      {/* Recent phone intake jobs */}
      {recentJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent phone intake jobs</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentJobs.slice(0, 10).map(job => (
              <div key={job.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {job.reported_by} · {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                  job.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  job.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{job.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1">
        <p className="font-semibold text-gray-900">{title}</p>
        <div className="mt-1 text-gray-600">{children}</div>
      </div>
    </div>
  )
}
