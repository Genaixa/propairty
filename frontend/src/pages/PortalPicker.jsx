import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Portal definitions ────────────────────────────────────────────────────────
const PORTALS = [
  {
    key: 'agent',
    to: '/login/agent',
    label: 'Agent Portal',
    sub: 'Full control for your team',
    headline: 'Your whole portfolio.\nOne dashboard.',
    img: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay: 'bg-indigo-900/70',
    color: 'indigo',
    demo: { email: 'agentgoilem@propairty.co.uk' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    key: 'landlord',
    to: '/landlord/login',
    label: 'Landlord Portal',
    sub: 'Your properties at a glance',
    headline: 'Landlords informed.\nNot chasing.',
    img: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay: 'bg-emerald-900/65',
    color: 'emerald',
    demo: { email: 'robert@morrisonproperty.co.uk' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    key: 'tenant',
    to: '/tenant/login',
    label: 'Tenant Portal',
    sub: 'Self-service for renters',
    headline: 'Your home.\nAll in one place.',
    img: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay: 'bg-violet-900/70',
    color: 'violet',
    demo: { email: 'tenantgoilem@propairty.co.uk' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: 'contractor',
    to: '/contractor/login',
    label: 'Contractor Portal',
    sub: 'Jobs, quotes & invoices',
    headline: 'Jobs dispatched.\nEvery step tracked.',
    img: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay: 'bg-orange-900/70',
    color: 'orange',
    demo: { email: 'info@negasservices.co.uk' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
]

const DEMO_PASSWORD = 'demo1234'

// ── Portal colour helpers ──────────────────────────────────────────────────────
const C = {
  indigo:  { ring: 'ring-indigo-500',  bg: 'bg-indigo-50',  border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-600',  label: 'text-indigo-700',  btn: 'bg-indigo-600 hover:bg-indigo-700',  pill: 'bg-indigo-100 text-indigo-700',  tab: 'text-indigo-400 border-indigo-400' },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', label: 'text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700', pill: 'bg-emerald-100 text-emerald-700', tab: 'text-emerald-400 border-emerald-400' },
  violet:  { ring: 'ring-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600',  label: 'text-violet-700',  btn: 'bg-violet-600 hover:bg-violet-700',  pill: 'bg-violet-100 text-violet-700',  tab: 'text-violet-400 border-violet-400' },
  orange:  { ring: 'ring-orange-400',  bg: 'bg-orange-50',  border: 'border-orange-200', icon: 'bg-orange-100 text-orange-600',  label: 'text-orange-700',  btn: 'bg-orange-500 hover:bg-orange-600',  pill: 'bg-orange-100 text-orange-700',  tab: 'text-orange-400 border-orange-400' },
}

// ── Copy to clipboard helper ─────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  return (
    <button onClick={copy} className="text-[10px] text-slate-400 hover:text-white transition-colors px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 shrink-0">
      {copied ? '✓' : 'copy'}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PortalPicker() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActiveIdx(i => (i + 1) % PORTALS.length), 4500)
    return () => clearInterval(t)
  }, [paused])

  const active = PORTALS[activeIdx]

  return (
    <div className="min-h-screen flex font-sans">

      {/* ── Left panel ── */}
      <div className="w-full lg:w-[420px] xl:w-[480px] flex-shrink-0 flex flex-col justify-center bg-white px-8 py-10 xl:px-12">

        {/* Logo */}
        <div className="mb-10">
          <a href="/" className="text-xl font-bold text-indigo-600 tracking-tight">
            Prop<span className="text-gray-900">AI</span>rty
          </a>
        </div>

        <div className="max-w-sm w-full">

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Sign in</h2>
            <p className="text-sm text-gray-400">Choose your portal to continue.</p>
          </div>

          {/* Portal cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {PORTALS.map((p, i) => (
              <Link
                key={p.key}
                to={p.to}
                onMouseEnter={() => { setActiveIdx(i); setPaused(true) }}
                onMouseLeave={() => setPaused(false)}
                className={`group border-2 rounded-2xl p-4 transition-all duration-200 hover:shadow-md ${
                  activeIdx === i
                    ? `${C[p.color].bg} ${C[p.color].border}`
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${C[p.color].icon} transition-transform duration-200 group-hover:scale-110`}>
                  {p.icon}
                </div>
                <p className={`font-semibold text-sm ${C[p.color].label}`}>{p.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{p.sub}</p>
              </Link>
            ))}
          </div>

          {/* Agency Website link */}
          <a
            href="/site/tyne-lettings"
            className="flex items-center gap-3 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 rounded-2xl px-4 py-3 transition-all duration-200 hover:shadow-md mb-6 w-full"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-700">Agency Website</p>
              <p className="text-[11px] text-gray-400">Browse properties &amp; learn more</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>

        </div>
      </div>

      {/* ── Right panel — revolving portal showcase ── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden cursor-pointer group/panel">
        <Link to={active.to} className="absolute inset-0 z-20" aria-label={`Sign in to ${active.label}`} />
        {PORTALS.map((p, i) => (
          <div
            key={p.key}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === activeIdx ? 1 : 0, pointerEvents: i === activeIdx ? 'auto' : 'none' }}
          >
            <img src={p.img} alt="" className="w-full h-full object-cover object-center" />
            <div className={`absolute inset-0 ${p.overlay}`} />
          </div>
        ))}

        {/* Hover affordance */}
        <div className="absolute inset-0 bg-black/0 group-hover/panel:bg-black/10 transition-colors duration-300 z-10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-0 group-hover/panel:opacity-100 transition-opacity duration-200">
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
            <span>Sign in to {active.label}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-12 z-10 pointer-events-none">
          {/* Top — logo */}
          <div>
            <span className="text-xl font-bold text-white/90 tracking-tight">
              Prop<span className="text-white">AI</span>rty
            </span>
          </div>

          {/* Bottom — portal headline */}
          <div>
            {PORTALS.map((p, i) => (
              <div
                key={p.key}
                className="transition-opacity duration-700 absolute bottom-16 left-12 right-12"
                style={{ opacity: i === activeIdx ? 1 : 0 }}
              >
                <div className={`w-10 h-10 rounded-xl ${C[p.color].icon} flex items-center justify-center mb-5`}>
                  {p.icon}
                </div>
                <p className="text-white/50 text-sm font-medium mb-2 tracking-wide">{p.label}</p>
                <h3
                  className="text-4xl font-extrabold text-white leading-tight mb-3 tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {p.headline.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < p.headline.split('\n').length - 1 && <br />}</span>
                  ))}
                </h3>
                <p className="text-white/60 text-base leading-relaxed max-w-xs">{p.sub}</p>
              </div>
            ))}

            {/* Dot indicators */}
            <div className="flex gap-2 absolute bottom-8 left-12 z-30 pointer-events-auto">
              {PORTALS.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.preventDefault(); setActiveIdx(i); setPaused(true) }}
                  onMouseLeave={() => setPaused(false)}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
