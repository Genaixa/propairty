import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

function CopyBtn({ text, onCopy }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); onCopy?.(); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors shrink-0">
      {copied ? '✓' : 'copy'}
    </button>
  )
}

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

function apiGet(p) { return axios.get(`${API_BASE}/api/public${p}`) }
function apiPost(p, d) { return axios.post(`${API_BASE}/api/public${p}`, d) }

function storageKey(slug) { return `propairty_public_${slug}` }

const DEMO_ACCOUNTS = [
  { role: 'applicant', label: 'Applicant account', email: 'jamie@propairty.co.uk' },
]
const DEMO_PASSWORD = 'demo1234'

const ROLE_OPTS = [
  { value: 'tenant',   emoji: '🔑', label: 'Looking to rent',  sub: 'Save properties & book viewings' },
  { value: 'landlord', emoji: '🏠', label: 'I own a property', sub: 'Valuation & landlord services' },
]

export default function PublicAccountLogin({ slug: slugProp }) {
  const { slug: slugParam } = useParams()
  const slug = slugProp || slugParam
  const navigate = useNavigate()

  const [org, setOrg] = useState(null)
  const [tab, setTab] = useState('login')
  const [role, setRole] = useState('tenant')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const brand = org?.brand_color || '#4f46e5'

  useEffect(() => {
    apiGet(`/${slug}`).then(r => setOrg(r.data)).catch(() => {})
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey(slug)) || 'null')
      if (stored?.access_token) navigate(`/site/${slug}/account`, { replace: true })
    } catch {}
  }, [slug])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const isLogin = tab === 'login'
      const payload = isLogin
        ? { email, password }
        : { email, password, full_name: fullName, phone, role }
      const r = await apiPost(`/${slug}/account/${isLogin ? 'token' : 'register'}`, payload)
      localStorage.setItem(storageKey(slug), JSON.stringify(r.data))
      navigate(`/site/${slug}/account`, { replace: true })
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: `linear-gradient(135deg, ${brand}18 0%, #fff 60%)` }}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to={`/site/${slug}`}>
            <h1 className="text-3xl font-bold" style={{ color: brand }}>
              Prop<span className="text-gray-900">AI</span>rty
            </h1>
          </Link>
          <p className="text-gray-500 mt-1 text-sm">{org?.name || 'Agency Account'}</p>
        </div>

        {/* Login / Register tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          {['login', 'register'].map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError('') }}
              className="flex-1 py-2.5 text-sm font-semibold transition-colors"
              style={tab === t ? { backgroundColor: brand, color: '#fff' } : { backgroundColor: '#f9fafb', color: '#6b7280' }}>
              {t === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role picker — register only */}
          {tab === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTS.map(o => (
                  <button key={o.value} type="button" onClick={() => setRole(o.value)}
                    className="rounded-xl border-2 px-3 py-3 text-left transition-all"
                    style={role === o.value ? { borderColor: brand, backgroundColor: `${brand}10` } : { borderColor: '#e5e7eb' }}>
                    <div className="text-xl mb-1">{o.emoji}</div>
                    <p className="text-xs font-bold leading-snug" style={role === o.value ? { color: brand } : { color: '#1f2937' }}>{o.label}</p>
                    <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{o.sub}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': brand }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="07700 900000" type="tel"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              {tab === 'register'
                ? <span className="text-xs text-gray-400">At least 8 characters</span>
                : <Link to={`/site/${slug}`} className="text-xs hover:underline" style={{ color: brand }}>← Back to site</Link>
              }
            </div>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 pr-10" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                {showPassword
                  ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            style={{ backgroundColor: brand }}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign in' : `Create ${role} account`}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Demo access · password: {DEMO_PASSWORD}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {DEMO_ACCOUNTS.map(d => (
              <div key={d.role} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700">{d.label}</p>
                  <p className="text-[11px] font-mono text-gray-500 truncate">{d.email}</p>
                </div>
                <CopyBtn text={d.email} onCopy={() => { setTab('login'); setEmail(d.email); setPassword(DEMO_PASSWORD) }} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
