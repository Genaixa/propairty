import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export default function TenantLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const res = await axios.post(`${BASE}/tenant/token`, params)
      localStorage.setItem('tenant_token', res.data.access_token)
      navigate('/tenant/portal')
    } catch {
      setError('Invalid email or password, or portal access not enabled. Contact your letting agent.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-white">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-violet-600">
            Prop<span className="text-gray-900">AI</span>rty
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Tenant Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="••••••••" required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-6">
          Need access? Contact your letting agent to enable your portal.
        </p>
      </div>
    </div>
  )
}
