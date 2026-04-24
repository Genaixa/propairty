import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function InviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    api.get(`/onboarding/invite-info/${token}`)
      .then(r => setInfo(r.data))
      .catch(err => setError(err.response?.data?.detail || 'This invite link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/onboarding/accept-invite', { token, password })
      localStorage.setItem('token', res.data.access_token)
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to set password')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
          {info && <p className="text-sm text-gray-500 mt-1">Join <strong>{info.org_name}</strong> on PropAIrty</p>}
        </div>

        {loading && <p className="text-center text-gray-400">Loading…</p>}

        {!loading && error && !info && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-center">
            <p className="text-sm font-semibold text-red-700">Invalid invite link</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && info && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 mb-2">
              <p><strong>Name:</strong> {info.full_name}</p>
              <p><strong>Email:</strong> {info.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Set your password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Activating account…' : 'Activate Account'}
            </button>
          </form>
        )}

        {success && (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <p className="font-semibold text-gray-900">Account activated!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecting to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  )
}
