import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const CONFIG = {
  agent:      { endpoint: '/auth/reset-password',       color: 'indigo',  label: 'PropAIrty',         back: '/login' },
  tenant:     { endpoint: '/tenant/reset-password',     color: 'violet',  label: 'Tenant Portal',      back: '/tenant/login' },
  landlord:   { endpoint: '/landlord/reset-password',   color: 'emerald', label: 'Landlord Portal',    back: '/landlord/login' },
  contractor: { endpoint: '/contractor/reset-password', color: 'orange',  label: 'Contractor Portal',  back: '/contractor/login' },
}

const colorCls = {
  indigo:  { ring: 'focus:ring-indigo-500',  btn: 'bg-indigo-600 hover:bg-indigo-700',  text: 'text-indigo-600' },
  violet:  { ring: 'focus:ring-violet-500',  btn: 'bg-violet-600 hover:bg-violet-700',  text: 'text-violet-600' },
  emerald: { ring: 'focus:ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700',text: 'text-emerald-600' },
  orange:  { ring: 'focus:ring-orange-500',  btn: 'bg-orange-600 hover:bg-orange-700',  text: 'text-orange-600' },
}

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const type = params.get('type') || 'agent'
  const cfg = CONFIG[type] || CONFIG.agent
  const cls = colorCls[cfg.color]
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    try {
      await axios.post(`${BASE}${cfg.endpoint}`, { token, new_password: password })
      setDone(true)
      setTimeout(() => navigate(cfg.back), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired link — please request a new one')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center">
          <p className="text-red-500 font-medium">Invalid reset link.</p>
          <Link to={cfg.back} className={`block mt-4 text-sm ${cls.text} hover:underline`}>Back to sign in</Link>
        </div>
      </div>
    )
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

        {done ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-gray-700 font-medium">Password updated</p>
            <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">Set a new password</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${cls.ring}`}
                placeholder="At least 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${cls.ring}`}
                placeholder="Repeat your new password" required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading}
              className={`w-full ${cls.btn} text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60`}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
