import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function Signup() {
  const [form, setForm] = useState({ org_name: '', full_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/onboarding/signup', {
        org_name: form.org_name,
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      })
      localStorage.setItem('token', res.data.access_token)
      navigate('/dashboard')
    } catch (e) {
      setError(e.response?.data?.detail || 'Signup failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">
            Prop<span className="text-gray-900">AI</span>rty
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Create your account — it's free to start</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Agency Name</label>
            <input value={form.org_name} onChange={e => setForm({...form, org_name: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tyne Lettings Ltd" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
            <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Jane Smith" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@youragency.co.uk" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="At least 8 characters" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat password" required />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
        </p>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            By signing up you agree to our terms of service.<br/>
            Your data is isolated from other organisations.
          </p>
        </div>
      </div>
    </div>
  )
}
