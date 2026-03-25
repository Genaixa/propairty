import { Link } from 'react-router-dom'

const features = [
  {
    icon: '🤖',
    title: 'AI Assistant Built In',
    desc: 'Ask anything — "Which tenants are in arrears?", "Draft a Section 21" — and get instant answers. No other property software does this.',
  },
  {
    icon: '📰',
    title: 'Daily Property News Briefing',
    desc: 'AI reads the UK property press every morning and tells you exactly what it means for your agency. Stay ahead of legislation changes automatically.',
  },
  {
    icon: '💷',
    title: 'Rent Tracking & Arrears',
    desc: 'Automatic payment schedules, overdue flagging, and Telegram alerts when rent is late. Know who owes what at a glance.',
  },
  {
    icon: '📋',
    title: 'Compliance Dashboard',
    desc: 'Gas safety, EICR, EPC, fire risk — track every certificate across every property. Get alerts before anything expires.',
  },
  {
    icon: '📄',
    title: 'Document Generation',
    desc: 'Generate ASTs, Section 21s, Section 8s, rent increase letters, and deposit receipts as PDFs in seconds.',
  },
  {
    icon: '🔧',
    title: 'Maintenance Management',
    desc: 'Log jobs, track progress, and let tenants report issues directly through their portal. Nothing falls through the cracks.',
  },
]

const portals = [
  {
    color: 'indigo',
    label: 'Agent Portal',
    title: 'Full control for your team',
    desc: 'Your agents manage properties, tenants, leases, compliance and documents — all in one place. Role-based access so admins control what agents see.',
    bg: 'bg-indigo-600',
    light: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  {
    color: 'emerald',
    label: 'Landlord Portal',
    title: 'Keep landlords in the loop',
    desc: 'Give each landlord their own login. They see their properties, rent status, compliance certificates, and maintenance jobs — without calling you.',
    bg: 'bg-emerald-600',
    light: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  {
    color: 'violet',
    label: 'Tenant Portal',
    title: 'Self-service for tenants',
    desc: 'Tenants view their lease, check payment history, and report maintenance issues. Fewer calls to your office.',
    bg: 'bg-violet-600',
    light: 'bg-violet-50',
    text: 'text-violet-600',
  },
]

const pricing = [
  {
    name: 'Starter',
    price: '£29',
    desc: 'Perfect for landlords managing their own portfolio',
    units: 'Up to 10 units',
    users: '1 user',
    highlight: false,
    features: ['All core features', 'AI assistant', 'Tenant & landlord portals', 'Document generation', 'Compliance tracking', 'Email support'],
  },
  {
    name: 'Professional',
    price: '£79',
    desc: 'For small letting agencies ready to scale',
    units: 'Up to 50 units',
    users: '5 users',
    highlight: true,
    features: ['Everything in Starter', 'Team management', 'Daily AI news briefing', 'Telegram alerts', 'Priority support', 'Maintenance management'],
  },
  {
    name: 'Agency',
    price: '£149',
    desc: 'Established agencies with large portfolios',
    units: 'Unlimited units',
    users: 'Unlimited users',
    highlight: false,
    features: ['Everything in Professional', 'Multiple organisations', 'Custom branding', 'API access', 'Dedicated onboarding', 'Phone support'],
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div>
          <span className="text-xl font-bold text-indigo-600">Prop<span className="text-gray-900">AI</span>rty</span>
          <span className="text-xs text-gray-400 ml-2 hidden sm:inline">AI-powered property management</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
          <Link to="/signup" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Start free trial
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>🤖</span> The only property management software with AI built in
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-5">
          Property management.<br />
          <span className="text-indigo-600">Powered by AI.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          PropAIrty gives letting agents and landlords everything they need to manage properties, tenants and compliance — with an AI assistant that actually understands your business.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/signup"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-indigo-200">
            Start your free 14-day trial
          </Link>
          <a href="mailto:info@propairty.co.uk"
            className="border border-gray-300 text-gray-700 hover:border-gray-400 font-semibold px-8 py-3.5 rounded-xl text-base transition-colors">
            Request a demo
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required · Cancel anytime · Setup in minutes</p>
      </section>

      {/* Social proof bar */}
      <div className="bg-gray-50 border-y border-gray-100 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-center gap-8 flex-wrap text-sm text-gray-500">
          <span>✓ GDPR compliant</span>
          <span>✓ UK-based data</span>
          <span>✓ Multi-tenant isolation</span>
          <span>✓ SSL encrypted</span>
          <span>✓ 99.9% uptime</span>
        </div>
      </div>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything you need. Nothing you don't.</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Built specifically for UK letting agents and landlords, with AI woven through every feature.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three portals */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Three portals. One platform.</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Give every stakeholder their own view — without managing multiple systems.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portals.map((p, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className={`${p.bg} px-5 py-4`}>
                  <span className="text-white text-xs font-bold uppercase tracking-wide">{p.label}</span>
                  <h3 className="text-white font-bold text-lg mt-1">{p.title}</h3>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI callout */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl px-8 py-12 text-center text-white">
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-3xl font-bold mb-4">Your AI property manager</h2>
          <p className="text-indigo-100 max-w-2xl mx-auto text-lg leading-relaxed mb-6">
            Ask it anything. <em>"Which leases expire next month?"</em> <em>"Draft a rent increase letter for Flat 3."</em> <em>"What does today's news mean for my agency?"</em> It reads the whole UK property press every morning and tells you what matters.
          </p>
          <Link to="/signup"
            className="inline-block bg-white text-indigo-600 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
            Try it free for 14 days
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 border-t border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500">14-day free trial on all plans. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {pricing.map((p, i) => (
              <div key={i} className={`bg-white rounded-xl border-2 ${p.highlight ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-gray-200'} overflow-hidden`}>
                {p.highlight && (
                  <div className="bg-indigo-600 text-white text-xs font-bold text-center py-1.5 uppercase tracking-wide">
                    Most Popular
                  </div>
                )}
                <div className="px-6 pt-6 pb-4">
                  <h3 className="font-bold text-gray-900 text-lg">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 mb-4">{p.desc}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold text-gray-900">{p.price}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                  </div>
                  <p className="text-xs text-gray-400">{p.units} · {p.users}</p>
                </div>
                <div className="px-6 pb-6">
                  <Link to="/signup"
                    className={`block w-full text-center py-2.5 rounded-lg font-semibold text-sm mb-5 transition-colors ${
                      p.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}>
                    Start free trial
                  </Link>
                  <ul className="space-y-2">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            Need a bespoke plan for a large portfolio or franchise?{' '}
            <a href="mailto:info@propairty.co.uk" className="text-indigo-600 hover:underline">Get in touch</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-indigo-600">Prop<span className="text-gray-900">AI</span>rty</span>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered property management for UK letting agents</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="mailto:info@propairty.co.uk" className="hover:text-gray-900">info@propairty.co.uk</a>
            <Link to="/login" className="hover:text-gray-900">Sign in</Link>
            <Link to="/signup" className="hover:text-gray-900">Sign up</Link>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} PropAIrty. All rights reserved. · Your data is isolated and never shared between organisations.
          </p>
        </div>
      </footer>

    </div>
  )
}
