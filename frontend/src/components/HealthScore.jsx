import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

const BREAKDOWN_ROUTES = {
  arrears:     '/payments',
  compliance:  '/compliance',
  maintenance: '/maintenance',
  voids:       '/properties',
  renewals:    '/renewals',
}

function issueRoute(text) {
  if (/compliance/i.test(text)) return '/compliance'
  if (/rent|arrears|payment/i.test(text)) return '/payments'
  if (/maintenance/i.test(text)) return '/maintenance'
  if (/vacant/i.test(text)) return '/properties'
  if (/lease|expir/i.test(text)) return '/renewals'
  if (/deposit/i.test(text)) return '/deposits'
  if (/inspection/i.test(text)) return '/inspections'
  return null
}

export default function HealthScore() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/intelligence/health-score').then(r => setData(r.data)).catch(() => {})
  }, [])

  if (!data) return null

  const { score, breakdown, max, issues, grade } = data

  const gradeColor =
    score >= 90 ? 'text-green-600' :
    score >= 70 ? 'text-indigo-600' :
    score >= 50 ? 'text-amber-600' : 'text-red-600'

  const ringColor =
    score >= 90 ? '#16a34a' :
    score >= 70 ? '#4f46e5' :
    score >= 50 ? '#d97706' : '#dc2626'

  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start gap-5">
        {/* Score ring */}
        <div className="shrink-0 relative">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle cx="50" cy="50" r="40" fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text x="50" y="46" textAnchor="middle" fontSize="20" fontWeight="bold" fill={ringColor}>{score}</text>
            <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#9ca3af">/ 100</text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900">Portfolio Health</h3>
            <span className={`text-sm font-bold ${gradeColor}`}>{grade}</span>
          </div>

          {/* Breakdown bars */}
          <div className="mt-3 space-y-1.5">
            {Object.entries(breakdown).map(([key, val]) => {
              const pct = Math.round((val / max[key]) * 100)
              const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500'
              const route = BREAKDOWN_ROUTES[key]
              const inner = (
                <>
                  <span className="text-xs text-gray-500 w-20 capitalize">{key}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{val}/{max[key]}</span>
                </>
              )
              return route ? (
                <Link key={key} to={route} className="flex items-center gap-2 rounded hover:bg-gray-50 -mx-1 px-1 transition-colors cursor-pointer">
                  {inner}
                </Link>
              ) : (
                <div key={key} className="flex items-center gap-2">{inner}</div>
              )
            })}
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="mt-3 space-y-1">
              {issues.map((issue, i) => {
                const route = issueRoute(issue)
                const content = (
                  <span className={`text-xs flex items-start gap-1.5 ${route ? 'text-amber-700 hover:text-amber-900 hover:underline cursor-pointer' : 'text-amber-700'}`}>
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    {issue}
                  </span>
                )
                return route
                  ? <Link key={i} to={route}>{content}</Link>
                  : <div key={i}>{content}</div>
              })}
            </div>
          )}
          {issues.length === 0 && (
            <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
              No issues detected
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
