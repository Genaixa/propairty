import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const CONFIG = {
  agent:      { endpoint: '/auth/forgot-password',       color: 'indigo',  label: 'PropAIrty',                  back: '/login' },
  tenant:     { endpoint: '/tenant/forgot-password',     color: 'violet',  label: 'Tenant Portal',               back: '/tenant/login' },
  landlord:   { endpoint: '/landlord/forgot-password',   color: 'emerald', label: 'Landlord Portal',             back: '/landlord/login' },
  contractor: { endpoint: '/contractor/forgot-password', color: 'orange',  label: 'Contractor Portal',           back: '/contractor/login' },
}

const colorCls = {
  indigo:  { ring: 'focus:ring-indigo-500',  btn: 'bg-indigo-600 hover:bg-indigo-700',  text: 'text-indigo-600' },
  violet:  { ring: 'focus:ring-violet-500',  btn: 'bg-violet-600 hover:bg-violet-700',  text: 'text-violet-600' },
  emerald: { ring: 'focus:ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700',text: 'text-emerald-600' },
  orange:  { ring: 'focus:ring-orange-500',  btn: 'bg-orange-600 hover:bg-orange-700',  text: 'text-orange-600' },
}

export default function ForgotPassword() {
  const [params] = useSearchParams()
  const type = params.get('type') || 'agent'
  const cfg = CONFIG[type] || CONFIG.agent
  const cls = colorCls[cfg.color]

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post(`${BASE}${cfg.endpoint}`, { email })
    } catch {
      // Always show success — prevents user enumeration
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${cls.text}`}>
            Prop<span className="text-gray-900">AI</span>rty
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{cfg.label}</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="text-gray-700 font-medium">Check your email</p>
            <p className="text-sm text-gray-500">
              If that address is registered, a password reset link has been sent. It expires in 1 hour.
            </p>
            <Link to={cfg.back} className={`block mt-4 text-sm font-medium ${cls.text} hover:underline`}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-gray-500">Enter your email address and we'll send you a reset link.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${cls.ring}`}
                placeholder="you@example.com" required
              />
            </div>
            <button type="submit" disabled={loading}
              className={`w-full ${cls.btn} text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60`}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link to={cfg.back} className={`${cls.text} hover:underline font-medium`}>Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
