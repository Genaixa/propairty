import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { FEATURES } from '../data/featureContent'
import PortalAiChat from '../components/PortalAiChat'

// ── Scroll fade-in hook ───────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

// ── SVG icon components ───────────────────────────────────────────────────
const IcoBuilding = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
)
const IcoHome = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)
const IcoUser = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)
const IcoWrench = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
)
const IcoGlobe = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)
const IcoSparkle = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
)
const IcoPhone = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
)
const IcoCamera = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
  </svg>
)
const IcoCheck = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)
const IcoDocument = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)
const IcoCurrency = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64" />
  </svg>
)
const IcoShield = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

const IcoBarChart = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const IcoScale = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
  </svg>
)
const IcoBell = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
)
const IcoCalendar = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

// ── FAQ helpers ───────────────────────────────────────────────────────────────
function FaqAnswer({ text }) {
  // Linkify "book a demo" → scrolls to #book-demo
  const parts = text.split(/(book a demo)/gi)
  return (
    <>
      {parts.map((part, i) =>
        /^book a demo$/i.test(part)
          ? <a key={i} href="#book-demo" className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2">{part}</a>
          : part
      )}
    </>
  )
}

// ── FAQ section ───────────────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  'General', 'Agent Portal', 'Landlord Portal', 'Tenant Portal',
  'Contractor Portal', 'Agency Website', 'AI & Automation',
]

function FaqSection() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(null)

  useEffect(() => {
    fetch('/api/public/faq')
      .then(r => r.json())
      .then(d => setItems(d.faq || []))
      .catch(() => {})
  }, [])

  if (!items.length) return null

  // Group by category, preserving preferred order
  const byCategory = {}
  for (const item of items) {
    const cat = item.category || 'General'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }
  const categories = [
    ...CATEGORY_ORDER.filter(c => byCategory[c]),
    ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <section id="faq" className="bg-slate-50 border-t border-gray-200 py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Common questions.</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            From letting agents and property managers evaluating PropAIrty.
          </p>
        </div>

        <div className="space-y-10">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">{cat}</h3>
              <div className="space-y-2">
                {byCategory[cat].map((item, i) => {
                  const id = `${cat}-${i}`
                  const isOpen = open === id
                  return (
                    <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <button
                        onClick={() => setOpen(isOpen ? null : id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-800 leading-snug">{item.q}</span>
                        <svg
                          className={`w-5 h-5 text-indigo-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-gray-100 pt-3">
                          <FaqAnswer text={item.a} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10">
          Can't find your answer?{' '}
          <button onClick={() => document.querySelector('[title="Wendy — AI Assistant"]')?.click()}
            className="text-indigo-500 hover:text-indigo-700 font-medium underline underline-offset-2">
            Ask Wendy
          </button>
          {' '}or{' '}
          <a href="#book-demo" className="text-indigo-500 hover:text-indigo-700 font-medium underline underline-offset-2">
            book a demo
          </a>.
        </p>
      </div>
    </section>
  )
}

// ── Hero slides ───────────────────────────────────────────────────────────
const HERO_SLIDES = [
  {
    img:      'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay:  'bg-gray-900/60',
    headline: 'Property management.\nAI built in from the ground up.',
    sub:      'Four connected portals — agent, landlord, tenant, contractor — with an AI assistant woven through every feature.',
    cta:      { label: 'Book a demo', href: '#book-demo' },
    ctaSecondary: { label: 'Try it live — no account needed', to: '/login' },
  },
  {
    img:      'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay:  'bg-indigo-900/65',
    headline: 'Your whole portfolio.\nOne dashboard.',
    sub:      'Properties, tenants, compliance, maintenance, payments and documents — managed by your team from a single interface.',
    cta:      { label: 'See the agent portal', href: '#portals' },
  },
  {
    img:      'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay:  'bg-emerald-900/60',
    headline: 'Landlords informed.\nNot chasing.',
    sub:      'Every landlord gets their own portal. Live rent status, compliance certificates, maintenance jobs — no phone calls needed.',
    cta:      { label: 'See the landlord portal', href: '#portals' },
  },
  {
    img:      'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay:  'bg-violet-900/65',
    headline: 'Maintenance.\nFrom report to invoice — tracked.',
    sub:      'Tenants report issues via portal, AI triages severity, agents dispatch contractors, quotes approved, photos uploaded. Every step logged.',
    cta:      { label: 'See the workflow', href: '#maintenance' },
  },
  {
    img:      'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1920',
    overlay:  'bg-gray-900/55',
    headline: 'Your agency website.\nLive on day one.',
    sub:      'Every PropAIrty agency gets a fully branded property listings site — automatically. Properties go live the moment you mark them available.',
    cta:      { label: 'Book a demo', href: '#book-demo' },
  },
]

// ── Portal data ───────────────────────────────────────────────────────────────
const PORTALS = [
  {
    color: 'indigo',
    Icon: IcoBuilding,
    label: 'Agent Portal',
    title: 'Full control for your team',
    desc: 'The central hub. Manage every property, tenant, landlord, contractor, lease and compliance certificate. AI assistant, analytics, document generation and daily news briefing — all in one place.',
    pills: ['Properties & units', 'Tenant management', 'Compliance tracking', 'Document generation', 'Analytics & P&L', 'AI assistant', 'Maintenance dispatch', 'Applicants', 'Inspections', 'PPM schedules', 'Automated workflows', 'Team roles & permissions', 'Meter readings', 'Files & documents'],
    bg: 'bg-indigo-600',
  },
  {
    color: 'emerald',
    Icon: IcoHome,
    label: 'Landlord Portal',
    title: 'Keep landlords in the loop',
    desc: 'Each landlord gets their own login. They see their properties, live rent status, compliance certificates, maintenance jobs, legal notices, statements and can message you directly — no phone calls needed.',
    pills: ['Rent & arrears', 'Maintenance status', 'Compliance certs', 'Legal notices', 'Documents', 'Renewals', 'Direct messaging', 'CFO P&L', 'Rent statements', 'Inspections'],
    bg: 'bg-emerald-600',
  },
  {
    color: 'violet',
    Icon: IcoUser,
    label: 'Tenant Portal',
    title: 'Self-service for tenants',
    desc: 'Tenants view their lease, check payment history, report maintenance, read legal notices, view documents and message the agency. Fewer calls to your office. A better tenant experience.',
    pills: ['Lease & payments', 'Maintenance reporting', 'Document access', 'Legal notices', 'Direct messaging', 'AI chat support', 'Meter readings', 'Move-out checklist', 'Deposit protection', 'Rent statement', 'Right to Rent', 'Inspections'],
    bg: 'bg-violet-600',
  },
  {
    color: 'orange',
    Icon: IcoWrench,
    label: 'Contractor Portal',
    title: 'Contractors stay in sync',
    desc: 'Contractors log in to see their jobs, accept or decline, submit quotes, propose alternative dates, upload photos, mark complete and message the agency directly — no more chasing by phone.',
    pills: ['Accept / decline jobs', 'Quote submission', 'Propose reschedule', 'Photo evidence', 'Job calendar', 'Direct messaging', 'Invoice status', 'Profile management'],
    bg: 'bg-orange-500',
  },
]

// ── Comparison table data ─────────────────────────────────────────────────────
const COMPETITORS = [
  { name: 'PropAIrty', ai: true,  allPortals: true,  docGen: true,  dispatch: true, listingSite: true, highlight: true },
  { name: 'Arthur Online', ai: false, allPortals: false, docGen: false, dispatch: false, listingSite: false, highlight: false },
  { name: 'Goodlord', ai: false, allPortals: false, docGen: true,  dispatch: false, listingSite: false, highlight: false },
  { name: 'Fixflo (maintenance only)', ai: false, allPortals: false, docGen: false, dispatch: false, listingSite: false, highlight: false },
  { name: 'Reapit', ai: false, allPortals: false, docGen: true,  dispatch: false, listingSite: false, highlight: false },
]


// ── Feature icon mapping ──────────────────────────────────────────────────────
const FEATURE_ICON_MAP = {
  'ai-assistant':        IcoSparkle,
  'ai-news-briefing':    IcoBell,
  'rent-arrears':        IcoCurrency,
  'compliance':          IcoShield,
  'maintenance':         IcoWrench,
  'document-generation': IcoDocument,
  'analytics':           IcoBarChart,
  'property-listings':   IcoGlobe,
  'legal-notices':       IcoScale,
  'inspections':         IcoCamera,
  'deposit-management':  IcoShield,
  'renewals':            IcoCalendar,
  'applicants':          IcoUser,
  'ppm':                 IcoCalendar,
  'ai-dispatch':         IcoSparkle,
  'alerts':              IcoBell,
  'valuation-risk':      IcoBarChart,
  'multi-org':           IcoShield,
  'tenant-portal':       IcoUser,
  'landlord-portal':     IcoCurrency,
  'contractor-portal':   IcoWrench,
  'workflows':           IcoBell,
  'files':               IcoDocument,
  'e-signing':           IcoDocument,
  'ai-insights':         IcoSparkle,
  'ai-drafting':         IcoSparkle,
  'ai-phone':            IcoBell,
  'surveys':             IcoCamera,
  'accounting':          IcoCurrency,
  'right-to-rent':       IcoShield,
  'audit-trail':         IcoDocument,
  'ai-autopilot':        IcoSparkle,
  'applicant-matching':  IcoUser,
}

// ── Portal feature groups ─────────────────────────────────────────────────────
const PORTAL_TABS = [
  {
    id: 'agent',
    label: 'Agent Portal',
    who: 'Your letting agency team',
    color: 'indigo',
    tagline: 'The command centre for your entire portfolio — every tool an agent needs, in one place.',
    videoLabel: 'Agent portal walkthrough',
    features: [
      { slug: 'accounting',          title: 'Accounting & Reporting',    desc: 'Income and expenditure — ready for your accountant.' },
      { slug: 'ai-assistant',        title: 'AI Assistant',              desc: 'Ask your entire portfolio anything in plain English.' },
      { slug: 'ai-autopilot',        title: 'AI Autopilot',              desc: 'Nothing falls through the cracks — automatically.' },
      { slug: 'ai-drafting',         title: 'AI Drafting Suite',         desc: 'Documents, letters and analyses in seconds.' },
      { slug: 'ai-dispatch',         title: 'AI Maintenance Dispatch',   desc: 'Right contractor suggested before you read the job.' },
      { slug: 'ai-phone',            title: 'AI Phone Agent',            desc: 'Answers maintenance calls 24/7.' },
      { slug: 'ai-insights',         title: 'AI Portfolio Intelligence', desc: 'Seven AI tools that turn data into decisions.' },
      { slug: 'applicants',          title: 'Applicant Management',      desc: 'First enquiry to signed lease in one pipeline.' },
      { slug: 'applicant-matching',  title: 'Applicant Matching Engine', desc: 'Vacant unit? See which applicants fit best — scored automatically.' },
      { slug: 'audit-trail',         title: 'Audit Trail',               desc: 'Every action, timestamped and immutable.' },
      { slug: 'workflows',           title: 'Automated Workflows',       desc: 'Set the rules once. Let the system run them.' },
      { slug: 'compliance',          title: 'Compliance Dashboard',      desc: 'Every certificate, every property, one screen.' },
      { slug: 'ai-news-briefing',    title: 'Daily AI News Briefing',    desc: 'UK property news filtered for letting agents, daily.' },
      { slug: 'deposit-management',  title: 'Deposit Management',        desc: 'Protected, tracked and dispute-ready.' },
      { slug: 'document-generation', title: 'Document Generation',       desc: 'Legal documents drafted and ready in seconds.' },
      { slug: 'e-signing',           title: 'Electronic Signing',        desc: 'Send, sign and store — without a printer.' },
      { slug: 'files',               title: 'Files & Document Store',    desc: 'Every document against the right record.' },
      { slug: 'inspections',         title: 'Inspections & Inventory',   desc: 'Condition records that hold up in disputes.' },
      { slug: 'legal-notices',       title: 'Legal Notices',             desc: 'Section 21 & Section 8 — issued, tracked, stored.' },
      { slug: 'mtd',                 title: 'Making Tax Digital (HMRC)', desc: 'Quarterly submissions direct to HMRC — MTD ITSA compliant from day one.' },
      { slug: 'maintenance',         title: 'Maintenance Management',    desc: 'From tenant report to contractor completion — tracked.' },
      { slug: 'multi-org',           title: 'Multi-Org & Role Access',   desc: 'Separate agencies, separate data, one platform.' },
      { slug: 'ppm',                 title: 'Planned Maintenance (PPM)', desc: 'Preventative tasks on schedule, not on memory.' },
      { slug: 'analytics',           title: 'Portfolio Analytics',       desc: 'Occupancy, yield and revenue trends at a glance.' },
      { slug: 'renewals',            title: 'Renewals & Rent Reviews',   desc: 'Never miss a lease end date again.' },
      { slug: 'advance-payments',     title: 'Advance Rent Payments',     desc: 'Record a lump-sum advance and let the system allocate it across future months automatically.' },
      { slug: 'meter-readings',      title: 'Meter Readings',            desc: 'Tenant-submitted gas, electric and water readings — centrally logged and visible per tenancy.' },
      { slug: 'rent-arrears',        title: 'Rent & Arrears Tracking',   desc: 'Know who owes what before they even call you.' },
      { slug: 'right-to-rent',       title: 'Right to Rent & Referencing', desc: 'Legal checks tracked, documented and never missed.' },
      { slug: 'alerts',              title: 'Telegram Alerts',           desc: 'Critical events in your pocket, not your inbox.' },
      { slug: 'valuation-risk',      title: 'Valuation & Risk Tools',    desc: 'Know which properties are underperforming — and why.' },
    ],
  },
  {
    id: 'tenant',
    label: 'Tenant Portal',
    who: 'Your tenants',
    color: 'sky',
    tagline: 'Tenants handle the routine themselves — payments, maintenance, documents and messages — without calling your office.',
    videoLabel: 'Tenant portal walkthrough',
    features: [
      { slug: 'deposit-management',  title: 'Deposit Information',       desc: 'Scheme, reference number and protection status, visible at any time.' },
      { slug: 'e-signing',           title: 'Documents & E-Signing',     desc: 'View and sign tenancy documents directly in the portal.' },
      { slug: 'inspections',         title: 'Inspection Calendar',       desc: 'Upcoming and past inspections with condition notes.' },
      { slug: 'maintenance',         title: 'Maintenance Reporting',     desc: 'Report an issue in under a minute with category, priority and photo.' },
      { slug: 'tenant-portal',       title: 'My Property & Lease',       desc: 'Address, EPC, lease dates and key contacts — all in one place.' },
      { slug: 'legal-notices',       title: 'Notices',                   desc: 'Any legal notices served on the tenancy, visible in-portal.' },
      { slug: 'renewals',            title: 'Renewal Acceptance',        desc: 'View and accept or decline a renewal offer without calling the agency.' },
      { slug: 'rent-arrears',        title: 'Rent Payments',             desc: 'Full payment history, upcoming due dates, outstanding balance.' },
      { slug: 'meter-readings',       title: 'Meter Readings',            desc: 'Submit gas, electric and water readings — date-stamped and sent straight to the agency.' },
      { slug: 'right-to-rent',       title: 'Right to Rent',             desc: 'Check status and document expiry dates.' },
      { slug: 'surveys',             title: 'Satisfaction Surveys',      desc: 'Rate your service — agencies see feedback in real time.' },
    ],
  },
  {
    id: 'landlord',
    label: 'Landlord Portal',
    who: 'Your landlords',
    color: 'emerald',
    tagline: 'Landlords see exactly what they want — income, compliance, maintenance — without a phone call to your office.',
    videoLabel: 'Landlord portal walkthrough',
    features: [
      { slug: 'compliance',          title: 'Compliance Status',         desc: 'Certificates across all their properties with expiry dates.' },
      { slug: 'accounting',          title: 'Financial Dashboard (CFO)', desc: 'Net income, yield scores and 12-month rent forecast.' },
      { slug: 'inspections',         title: 'Inspection Reports',        desc: 'Scheduled and completed inspections with condition ratings.' },
      { slug: 'legal-notices',       title: 'Legal Notices',             desc: 'Section 21 and Section 8 notices on their properties.' },
      { slug: 'maintenance',         title: 'Maintenance Visibility',    desc: 'All jobs on their properties — open, in progress and completed.' },
      { slug: 'landlord-portal',     title: 'Portfolio Overview',        desc: 'Total rent, arrears, occupancy — live summary across all properties.' },
      { slug: 'rent-arrears',        title: 'Rent & Arrears',            desc: 'Every payment, due date and outstanding balance by property.' },
      { slug: 'document-generation', title: 'Rent Statements',           desc: 'Monthly statements emailed automatically, downloadable any time.' },
      { slug: 'renewals',            title: 'Upcoming Renewals',         desc: 'Leases expiring in the next 90 days.' },
    ],
  },
  {
    id: 'contractor',
    label: 'Contractor Portal',
    who: 'Your maintenance contractors',
    color: 'orange',
    tagline: 'Contractors receive jobs, update status and communicate with your team — no phone tag, no confusion.',
    videoLabel: 'Contractor portal walkthrough',
    features: [
      { slug: 'ai-autopilot',        title: 'AI Chaser Messages',        desc: 'Automatic job chasers when updates go quiet — from the AI Autopilot.' },
      { slug: 'inspections',         title: 'Job Calendar',              desc: 'Monthly calendar view of all scheduled job dates.' },
      { slug: 'maintenance',         title: 'Job Details & Updates',     desc: 'Full job context — property, description, priority, notes and photos.' },
      { slug: 'alerts',              title: 'Job Notifications',         desc: 'New job alerts via email, SMS or Telegram — contractor\'s choice.' },
      { slug: 'files',               title: 'Messages with Agency',      desc: 'Direct portal messaging — no back-and-forth over email.' },
      { slug: 'contractor-portal',   title: 'My Jobs Queue',             desc: 'Active, completed and cancelled jobs with filters and status badges.' },
    ],
  },
]

const PORTAL_COLORS = {
  indigo: { tab: 'bg-indigo-600 text-white', tabInactive: 'text-indigo-600 border-indigo-200 hover:bg-indigo-50', icon: 'text-indigo-500', iconBg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500', ring: 'ring-indigo-200' },
  sky:    { tab: 'bg-sky-500 text-white',    tabInactive: 'text-sky-600 border-sky-200 hover:bg-sky-50',           icon: 'text-sky-500',    iconBg: 'bg-sky-50',    badge: 'bg-sky-100 text-sky-700',    dot: 'bg-sky-500',    ring: 'ring-sky-200' },
  emerald:{ tab: 'bg-emerald-600 text-white',tabInactive: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50',icon: 'text-emerald-500',iconBg: 'bg-emerald-50',badge: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500',ring: 'ring-emerald-200' },
  orange: { tab: 'bg-orange-500 text-white', tabInactive: 'text-orange-600 border-orange-200 hover:bg-orange-50',  icon: 'text-orange-500', iconBg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'ring-orange-200' },
}

function PortalFeatureSection() {
  const [activeTab, setActiveTab] = useState('agent')
  const portal = PORTAL_TABS.find(p => p.id === activeTab)
  const colors = PORTAL_COLORS[portal.color]

  return (
    <section id="features" className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em] mb-3">Everything included</p>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
            57 features. One platform.
          </h2>
          <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
            Four connected portals — agent, landlord, tenant, contractor — sharing the same live data from day one.
            No bolt-ons. No integrations to manage.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {PORTAL_TABS.map(p => {
            const c = PORTAL_COLORS[p.color]
            const isActive = activeTab === p.id
            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 cursor-pointer ${
                  isActive ? c.tab + ' border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : c.dot}`} />
                {p.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {p.features.length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content: features + video side by side */}
        <div className={`rounded-2xl border ${colors.ring} ring-1 overflow-hidden`}>

          {/* Portal header strip */}
          <div className={`px-6 py-4 flex items-center gap-4 ${colors.iconBg} border-b border-gray-100`}>
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest ${colors.icon}`}>{portal.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{portal.tagline}</p>
            </div>
            <span className={`ml-auto text-xs font-medium px-3 py-1 rounded-full ${colors.badge}`}>
              For {portal.who}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

            {/* Features list — 3 columns */}
            <div className="lg:col-span-3 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {portal.features.map((f) => {
                  const Icon = FEATURE_ICON_MAP[f.slug] || IcoSparkle
                  return (
                    <Link
                      key={f.slug}
                      to={`/features/${f.slug}`}
                      className="group flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${colors.iconBg} group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-4 h-4 ${colors.icon}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 leading-snug">{f.title}</p>
                        <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{f.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Video panel — 2 columns */}
            <div className="lg:col-span-2 p-6 flex flex-col">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{portal.videoLabel}</p>

              {/* Video embed — replace src with real Loom/YouTube embed URL */}
              <div className="relative flex-1 min-h-56 bg-gray-900 rounded-xl overflow-hidden group cursor-pointer">
                {portal.videoSrc ? (
                  <iframe
                    src={portal.videoSrc}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    {/* Placeholder thumbnail */}
                    <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center`}>
                      <svg className={`w-8 h-8 ${colors.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">{portal.videoLabel}</p>
                      <p className="text-gray-500 text-xs mt-1">Demo video coming soon</p>
                    </div>
                    <a href="#book-demo" className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${colors.tab} hover:opacity-90`}>
                      Book a live demo instead
                    </a>
                  </div>
                )}
              </div>

              {/* CTA below video */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-700 mb-1">Try it now</p>
                <p className="text-xs text-gray-400 mb-3">Log in with demo credentials and explore the {portal.label} yourself.</p>
                <a
                  href="/portal-picker"
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colors.icon} hover:underline cursor-pointer`}
                >
                  Open demo portal
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  )
}

// ── Demo booking form ─────────────────────────────────────────────────────────
function DemoForm() {
  const [form, setForm] = useState({ name: '', email: '', agency: '', units: '', message: '' })
  const [status, setStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const r = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(r.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <IcoCheck className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Thanks — we'll be in touch shortly.</h3>
      <p className="text-gray-500 text-sm">We usually respond within one business day.</p>
    </div>
  )

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Your name</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Jane Smith"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Work email</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="jane@youragency.co.uk"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Agency name</label>
          <input required value={form.agency} onChange={e => set('agency', e.target.value)}
            placeholder="Tyne Lettings Ltd"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Number of properties</label>
          <select value={form.units} onChange={e => set('units', e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="">Select…</option>
            <option>Under 25</option>
            <option>25 – 75</option>
            <option>75 – 200</option>
            <option>200+</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Anything you'd like us to know? (optional)</label>
        <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={3}
          placeholder="Current software, pain points, specific features you want to see…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
      </div>
      {status === 'error' && (
        <p className="text-red-500 text-sm">Something went wrong — please email us directly at info@genaixa.co.uk</p>
      )}
      <button type="submit" disabled={status === 'sending'}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-base transition-colors shadow-lg shadow-indigo-100">
        {status === 'sending' ? 'Sending…' : 'Request a demo'}
      </button>
      <p className="text-center text-xs text-gray-400">We'll reach out to arrange a time that suits you.</p>
    </form>
  )
}

// ── ROI Calculator ────────────────────────────────────────────────────────────
function RoiCalculator() {
  const [ref, visible] = useFadeIn()
  const [props, setProps] = useState(75)
  const hours = props < 25 ? 6 : props < 75 ? 11 : props < 150 ? 18 : props < 300 ? 28 : 42
  const days = Math.round((hours * 52) / 8)
  const saving = Math.round(hours * 25 * 52)
  return (
    <section ref={ref} className="bg-white py-24 border-t border-gray-100"
      style={{opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease'}}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em] mb-3">ROI calculator</p>
        <h2 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
          How much time could you save?
        </h2>
        <p className="text-gray-400 mb-12 leading-relaxed">Drag the slider to your portfolio size and see the estimate.</p>
        <div className="bg-slate-50 rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Properties managed</span>
              <span className="text-2xl font-extrabold text-indigo-600">{props}</span>
            </div>
            <input type="range" min={5} max={500} step={5} value={props} onChange={e => setProps(+e.target.value)}
              className="w-full h-2 bg-indigo-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-2"><span>5</span><span>500+</span></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              [hours + 'h', 'saved per week', 'text-indigo-600'],
              [days + ' days', 'reclaimed per year', 'text-violet-600'],
              ['£' + saving.toLocaleString(), 'value at £25/hr', 'text-emerald-600'],
            ].map(([val, label, color]) => (
              <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
                <p className="text-xs text-gray-400 mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-5">Based on average time savings reported by letting agents using comparable automation.</p>
        </div>
        <div className="mt-8">
          <a href="#book-demo" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all duration-200 shadow-lg shadow-indigo-100 hover:-translate-y-0.5 cursor-pointer">
            See it in your agency
          </a>
        </div>
      </div>
    </section>
  )
}

// ── UK Compliance section ─────────────────────────────────────────────────────
function UkCompliance() {
  const [ref, visible] = useFadeIn()
  const items = [
    { icon: IcoShield, title: 'Section 21 & Section 8', desc: 'Generate legally compliant notices in one click. Dates, grounds and serving requirements pre-filled.' },
    { icon: IcoCheck,  title: 'Deposit Protection', desc: 'Log deposits, generate receipts, track scheme registration — all tied to the tenancy record.' },
    { icon: IcoUser,   title: 'Right to Rent', desc: 'Record checks, upload documents, set expiry reminders. Full audit trail for Home Office compliance.' },
    { icon: IcoBell,   title: 'Gas Safety & EICRs', desc: 'Certificate expiry tracked per property. Automated alerts before the renewal date hits.' },
    { icon: IcoGlobe,  title: 'EPC Tracking', desc: 'EPC ratings and expiry dates on every property. Flag portfolios below the minimum rating threshold.' },
    { icon: IcoCalendar, title: 'PPM Schedules', desc: 'Planned preventative maintenance — scheduled jobs fired automatically so nothing gets missed.' },
  ]
  return (
    <section ref={ref} className="bg-slate-900 py-24"
      style={{opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease'}}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-3">Built for the UK</p>
          <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
            UK compliance. <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Built in.</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">Not an afterthought. Every UK-specific requirement is handled inside Propairty — no extra software, no manual tracking.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-800 transition-all duration-200 group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center mb-4 group-hover:bg-indigo-600/40 transition-colors duration-200">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-white text-sm mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Blog preview ──────────────────────────────────────────────────────────────
const BLOG_POSTS = [
  { title: 'Section 21 in 2026: What Letting Agents Need to Know', category: 'Compliance', date: 'Apr 2026', slug: '#' },
  { title: 'AI in Property Management: Separating Hype from Reality', category: 'Technology', date: 'Mar 2026', slug: '#' },
  { title: 'How to Cut Maintenance Response Time Without Hiring More Staff', category: 'Operations', date: 'Mar 2026', slug: '#' },
]

function BlogPreview() {
  const [ref, visible] = useFadeIn()
  return (
    <section ref={ref} className="bg-white py-24 border-t border-gray-100"
      style={{opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease'}}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em] mb-3">Common questions we answer</p>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>Insights for letting agents.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {BLOG_POSTS.map(post => (
            <div key={post.title} className="bg-slate-50 rounded-2xl p-6 border border-gray-100">
              <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mb-4">{post.category}</span>
              <h3 className="font-bold text-gray-900 leading-snug mb-3 text-sm">{post.title}</h3>
              <p className="text-xs text-gray-400">{post.date}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-8 text-sm text-gray-400">
          Ask <button onClick={() => document.querySelector('[title="Wendy — AI Assistant"]')?.click()} className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 cursor-pointer">Wendy</button> any of these questions — she knows Propairty inside out.
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [heroIdx, setHeroIdx] = useState(0)
  const [showStickyCta, setShowStickyCta] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_SLIDES.length), 4500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 680)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ── */}
      <nav className="border-b border-slate-700/60 px-6 py-4 sticky top-0 bg-slate-900/95 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="#" className="text-xl font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Prop<span className="text-white">AI</span>rty</a>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <Link to="/demos" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Watch demos</Link>
            <Link to="/login" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Sign in</Link>
            <Link to="/login" className="border border-slate-600 hover:border-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Try it live
            </Link>
            <a href="#book-demo" className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Book a demo
            </a>
          </div>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(o => !o)} className="sm:hidden flex flex-col gap-1.5 p-2 cursor-pointer" aria-label="Menu">
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden mt-3 pb-4 border-t border-slate-700/50 pt-4 flex flex-col gap-3 px-2">
            <Link to="/demos" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-300 font-medium py-2">Watch demos</Link>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-slate-300 font-medium py-2">Sign in</Link>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="border border-slate-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center">Try it live</Link>
            <a href="#book-demo" onClick={() => setMobileMenuOpen(false)} className="bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg text-center">Book a demo</a>
          </div>
        )}
      </nav>

      {/* ── Hero — revolving 5-slide banner ── */}
      <section className="relative overflow-hidden" style={{height: 620}}>
        {HERO_SLIDES.map((s, i) => (
          <div key={i} className="absolute inset-0 transition-opacity duration-1000"
            style={{opacity: i === heroIdx ? 1 : 0, pointerEvents: i === heroIdx ? 'auto' : 'none'}}>
            <img src={s.img} alt="" className="w-full h-full object-cover object-center" />
            <div className={`absolute inset-0 ${s.overlay}`} />
          </div>
        ))}
        <div className="relative z-10 h-full text-white text-center px-6 py-12">
          {HERO_SLIDES.map((s, i) => (
            <div key={i} className="absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-700"
              style={{opacity: i === heroIdx ? 1 : 0, pointerEvents: i === heroIdx ? 'auto' : 'none'}}>
              <h1 className="text-5xl sm:text-7xl font-extrabold text-white leading-none tracking-tight mb-6 drop-shadow-lg max-w-4xl"
                style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
                {s.headline.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < s.headline.split('\n').length - 1 && <br />}</span>
                ))}
              </h1>
              <p className="text-lg text-white/85 max-w-2xl mb-8 leading-relaxed drop-shadow">{s.sub}</p>
              <div className="flex items-center gap-4 flex-wrap justify-center">
                {s.cta && (
                  <a href={s.cta.href}
                    className="bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg hover:bg-indigo-50">
                    {s.cta.label}
                  </a>
                )}
                {s.ctaSecondary && (
                  <Link to={s.ctaSecondary.to}
                    className="border-2 border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-3.5 rounded-xl text-base transition-colors">
                    {s.ctaSecondary.label}
                  </Link>
                )}
              </div>
            </div>
          ))}
          {/* Dots */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
            {HERO_SLIDES.map((_, i) => (
              <button key={i} onClick={() => setHeroIdx(i)}
                className={`rounded-full transition-all duration-300 ${i === heroIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/45 hover:bg-white/70'}`} />
            ))}
          </div>
        </div>
      </section>


      {/* ── Stats bar ── */}
      <div className="bg-slate-900 border-y border-slate-700/50">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-slate-700/50">
          {[
            ['57', 'features built in', 'not bolted on'],
            ['4', 'connected portals', 'one live dataset'],
            ['100%', 'UK-built', 'GDPR-compliant'],
            ['1', 'subscription', 'no integrations'],
          ].map(([num, label, sub]) => (
            <div key={label} className="text-center sm:px-6">
              <p className="text-3xl font-extrabold text-white tracking-tight">{num}</p>
              <p className="text-sm font-semibold text-slate-300 mt-0.5">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Product video ── */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-4">See it in action</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
            Watch Propairty work.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">From first enquiry to signed tenancy — the full journey, handled.</p>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10">
            <video
              controls
              preload="metadata"
              className="w-full aspect-video bg-slate-950"
              poster=""
            >
              <source src="/uploads/Propairty_Product_Launch_Video_Video.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a href="#book-demo" className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-400/30 hover:-translate-y-0.5">
              Book a demo
            </a>
            <Link to="/demos" className="inline-block border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all duration-200">
              Watch all demos
            </Link>
          </div>
        </div>
      </section>

      <RoiCalculator />

      {/* ── UI Preview / Screenshots ── */}
      <section id="portals" className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-white mb-3" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>Everything in one place.</h2>
            <p className="text-slate-400 max-w-xl mx-auto">A fast, purposeful interface your whole team will actually use. No training. No manual.</p>
          </div>

          {/* Main dashboard mockup */}
          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-slate-700 mb-8">
            {/* Browser chrome */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">
                app.propairty.co.uk/dashboard
              </div>
            </div>
            {/* Dashboard UI mockup */}
            <div className="bg-gray-50 flex" style={{minHeight: '420px'}}>
              {/* Sidebar */}
              <div className="w-52 bg-indigo-900 text-white flex-shrink-0 p-4 hidden md:block">
                <div className="font-bold text-indigo-200 text-sm mb-6 mt-1">Prop<span className="text-white">AI</span>rty</div>
                {['Dashboard','Properties','Tenants','Maintenance','Payments','Compliance','Documents','Analytics'].map((item, i) => (
                  <div key={i} className={`text-xs px-3 py-2 rounded-lg mb-0.5 cursor-default ${i === 0 ? 'bg-indigo-600 text-white font-semibold' : 'text-indigo-300 hover:bg-indigo-800'}`}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-400">Good morning</p>
                    <h3 className="text-base font-bold text-gray-900">Portfolio Overview</h3>
                  </div>
                  <div className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Ask AI</div>
                </div>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Properties', value: '24', sub: '127 units total', color: 'indigo' },
                    { label: 'Rent Collected', value: '£42,800', sub: '94% this month', color: 'emerald' },
                    { label: 'Open Jobs', value: '8', sub: '2 overdue', color: 'orange' },
                    { label: 'Compliance', value: '96%', sub: '3 expiring soon', color: 'violet' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                      <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                      <p className="text-lg font-bold text-gray-900">{card.value}</p>
                      <p className="text-xs text-gray-400">{card.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Recent activity + AI panel */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Recent Maintenance</p>
                    {[
                      { addr: 'Flat 3, Park View Court', issue: 'Boiler not working', status: 'In Progress', dot: 'bg-orange-400' },
                      { addr: '12 Maple Street', issue: 'Leak under kitchen sink', status: 'Assigned', dot: 'bg-blue-400' },
                      { addr: 'Unit 7, The Sidings', issue: 'Front door lock faulty', status: 'Completed', dot: 'bg-emerald-400' },
                    ].map((job, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${job.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{job.addr}</p>
                          <p className="text-xs text-gray-400 truncate">{job.issue}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{job.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-indigo-900 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-indigo-200 mb-3">AI Assistant</p>
                    <div className="bg-indigo-800 rounded-lg p-3 mb-2">
                      <p className="text-xs text-indigo-100">"Which leases expire in the next 60 days?"</p>
                    </div>
                    <div className="bg-indigo-700 rounded-lg p-3 mb-3">
                      <p className="text-xs text-indigo-100 leading-relaxed">You have <strong className="text-white">7 leases</strong> expiring before 10 June. 3 tenants have not yet been contacted about renewal. Would you like me to draft renewal offer letters?</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-indigo-800 rounded-lg px-3 py-1.5 text-xs text-indigo-300">Ask anything…</div>
                      <div className="bg-indigo-600 rounded-lg px-3 py-1.5 text-xs text-white font-medium">Send</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Three smaller feature mockups */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Compliance */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-700">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 ml-2">Compliance</span>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-gray-900 mb-3">Compliance Dashboard</p>
                {[
                  { cert: 'Gas Safety', prop: 'Park View Ct', days: 12, color: 'text-red-600 bg-red-50' },
                  { cert: 'EICR', prop: 'Maple Street', days: 34, color: 'text-orange-600 bg-orange-50' },
                  { cert: 'EPC', prop: 'The Sidings', days: 180, color: 'text-emerald-600 bg-emerald-50' },
                  { cert: 'Fire Risk', prop: 'Oak Lane', days: 201, color: 'text-emerald-600 bg-emerald-50' },
                ].map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{c.cert}</p>
                      <p className="text-xs text-gray-400">{c.prop}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.color}`}>{c.days}d</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rent tracker */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-700">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 ml-2">Payments</span>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-gray-900 mb-1">Rent This Month</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-2xl font-extrabold text-gray-900">£42,800</span>
                  <span className="text-xs text-emerald-600 font-semibold mb-1">↑ 94%</span>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1 h-16 mb-3">
                  {[60,75,55,90,82,94,88,72,96,85,91,94].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{height: `${h}%`, background: i === 11 ? '#4f46e5' : '#e0e7ff'}} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: 'T. Harrison', status: 'Paid', color: 'text-emerald-600' },
                    { name: 'S. Okonkwo', status: 'Overdue 4d', color: 'text-red-600' },
                    { name: 'M. Patel', status: 'Paid', color: 'text-emerald-600' },
                  ].map((t, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600">{t.name}</span>
                      <span className={`font-semibold ${t.color}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Document generation */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-700">
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 ml-2">Documents</span>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-gray-900 mb-3">Generate Document</p>
                <div className="space-y-2 mb-3">
                  {[
                    { label: 'Assured Shorthold Tenancy', active: true },
                    { label: 'Section 21 Notice', active: false },
                    { label: 'Section 8 Notice', active: false },
                    { label: 'Rent Increase Letter', active: false },
                    { label: 'Deposit Receipt', active: false },
                  ].map((d, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg border cursor-default ${d.active ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-100 text-gray-500'}`}>
                      {d.label}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center text-xs bg-indigo-600 text-white font-bold py-2 rounded-lg cursor-default">Generate PDF</div>
                  <div className="text-center text-xs bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg cursor-default">Sign</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Five portals ── */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12 relative">
            {/* Decorative watermark */}
            <span className="absolute left-1/2 -translate-x-1/2 -top-4 text-[160px] font-extrabold text-slate-50 select-none pointer-events-none leading-none"
              style={{fontFamily:"'Playfair Display', Georgia, serif"}}>5.</span>
            <div className="relative">
              <h2 className="text-4xl font-extrabold text-gray-900 mb-3" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>Every role in the chain.<br/>Their own interface.</h2>
              <p className="text-gray-500 max-w-2xl mx-auto">Agents, landlords, tenants and contractors each get a purpose-built portal — plus every agency gets a public listings site. All running off the same live data.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Agent Portal ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              <div className="bg-indigo-600 px-6 py-4">
                <div className="flex items-center gap-2 mb-1"><IcoBuilding className="w-5 h-5 text-indigo-200" /><span className="text-white text-xs font-bold uppercase tracking-widest">Agent Portal</span></div>
                <h3 className="text-white font-bold text-xl">Full control for your team</h3>
              </div>
              {/* Mockup */}
              <div className="border-b border-gray-200 bg-gray-50 flex overflow-hidden" style={{height:'190px'}}>
                <div className="w-32 bg-indigo-950 p-2.5 flex-shrink-0">
                  <div className="text-indigo-300 text-[9px] font-bold mb-3">PropAIrty</div>
                  {['Dashboard','Properties','Tenants','Maintenance','Compliance','Documents','Analytics'].map((item, i) => (
                    <div key={i} className={`text-[8px] px-2 py-1 rounded mb-0.5 ${i === 0 ? 'bg-indigo-600 text-white font-semibold' : 'text-indigo-400'}`}>{item}</div>
                  ))}
                </div>
                <div className="flex-1 p-3 overflow-hidden">
                  <div className="flex gap-1 mb-2">
                    <p className="text-[9px] text-gray-400">Good morning · </p>
                    <p className="text-[9px] font-semibold text-gray-700">Portfolio Overview</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {[['£42,800','Rent Roll','bg-emerald-500'],['94%','Occupancy','bg-indigo-500'],['8','Open Jobs','bg-orange-500'],['96%','Compliance','bg-violet-500']].map(([v,l,bar],i) => (
                      <div key={i} className="relative overflow-hidden bg-white rounded-lg p-1.5 border border-gray-200">
                        <div className={`absolute top-0 left-0 w-0.5 h-full ${bar}`}/>
                        <div className="pl-1.5 text-[9px] font-bold text-gray-900">{v}</div>
                        <div className="pl-1.5 text-[8px] text-gray-400">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-indigo-950 rounded-lg p-2">
                    <p className="text-[8px] text-indigo-300 mb-1">AI Assistant</p>
                    <p className="text-[8px] text-white">"Which leases expire next month?"</p>
                    <p className="text-[8px] text-indigo-300 mt-0.5">→ 7 leases expiring before 10 June…</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500 leading-relaxed mb-4">The central hub. Manage every property, tenant, landlord, contractor, lease and compliance certificate. AI assistant, analytics, document generation and daily news briefing — all in one place.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Properties & units','Tenant management','Compliance tracking','Document generation','Analytics & P&L','AI assistant','Maintenance dispatch','Applicants','Inspections','PPM schedules','Automated workflows','Team roles & permissions','Meter readings','Files & documents'].map((pill, j) => (
                    <span key={j} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{pill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Landlord Portal ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              <div className="bg-emerald-600 px-6 py-4">
                <div className="flex items-center gap-2 mb-1"><IcoHome className="w-5 h-5 text-emerald-200" /><span className="text-white text-xs font-bold uppercase tracking-widest">Landlord Portal</span></div>
                <h3 className="text-white font-bold text-xl">Keep landlords in the loop</h3>
              </div>
              {/* Mockup */}
              <div className="border-b border-gray-200 bg-gray-50 flex overflow-hidden" style={{height:'190px'}}>
                <div className="w-32 bg-emerald-950 p-2.5 flex-shrink-0">
                  <div className="text-emerald-300 text-[9px] font-bold mb-3">Landlord Portal</div>
                  {['Overview','Properties','Financials','Arrears','Maintenance','Compliance','Documents','Messages'].map((item, i) => (
                    <div key={i} className={`text-[8px] px-2 py-1 rounded mb-0.5 ${i === 0 ? 'bg-emerald-600 text-white font-semibold' : 'text-emerald-400'}`}>{item}</div>
                  ))}
                </div>
                <div className="flex-1 p-3 overflow-hidden">
                  <p className="text-[9px] font-semibold text-gray-700 mb-2">Welcome back, John</p>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {[['£6,200','Monthly Rent','bg-emerald-500'],['£5,800','Collected','bg-emerald-400'],['£400','Arrears','bg-red-500']].map(([v,l,bar],i) => (
                      <div key={i} className="relative overflow-hidden bg-white rounded-lg p-1.5 border border-gray-200">
                        <div className={`absolute top-0 left-0 w-0.5 h-full ${bar}`}/>
                        <div className="pl-1.5 text-[9px] font-bold text-gray-900">{v}</div>
                        <div className="pl-1.5 text-[8px] text-gray-400">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[['3','Properties','bg-indigo-500'],['2','Open Jobs','bg-orange-500'],['5','Certs','bg-violet-500'],['1','Renewals','bg-emerald-500']].map(([n,l,dot],i) => (
                      <div key={i} className="bg-white rounded-lg p-1.5 border border-gray-200 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                        <div><div className="text-[9px] font-bold text-gray-900">{n}</div><div className="text-[8px] text-gray-400">{l}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Each landlord gets their own login. They see their properties, live rent status, compliance certificates, maintenance jobs, legal notices, statements and can message you directly — no phone calls needed.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Rent & arrears','Maintenance status','Compliance certs','Legal notices','Documents','Renewals','Direct messaging','CFO P&L','Rent statements','Inspections'].map((pill, j) => (
                    <span key={j} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{pill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tenant Portal ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200">
              <div className="bg-violet-600 px-6 py-4">
                <div className="flex items-center gap-2 mb-1"><IcoUser className="w-5 h-5 text-violet-200" /><span className="text-white text-xs font-bold uppercase tracking-widest">Tenant Portal</span></div>
                <h3 className="text-white font-bold text-xl">Self-service for tenants</h3>
              </div>
              {/* Mockup */}
              <div className="border-b border-gray-200 bg-gray-50 flex overflow-hidden" style={{height:'190px'}}>
                <div className="w-32 bg-violet-950 p-2.5 flex-shrink-0">
                  <div className="text-violet-300 text-[9px] font-bold mb-3">Tenant Portal</div>
                  {['My Property','Payments','Messages','Maintenance','My Lease','Documents','Deposit'].map((item, i) => (
                    <div key={i} className={`text-[8px] px-2 py-1 rounded mb-0.5 ${i === 0 ? 'bg-violet-600 text-white font-semibold' : 'text-violet-400'}`}>{item}</div>
                  ))}
                </div>
                <div className="flex-1 p-3 overflow-hidden">
                  <p className="text-[9px] font-semibold text-gray-700 mb-2">Flat 3, Park View Court</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-2 mb-2">
                    <p className="text-[8px] font-semibold text-gray-600 mb-1">My Lease</p>
                    <div className="space-y-0.5">
                      {[['Rent','£950/month'],['Lease ends','31 Oct 2025'],['Deposit','£1,425 protected']].map(([k,v],i)=>(
                        <div key={i} className="flex justify-between text-[8px]">
                          <span className="text-gray-400">{k}</span><span className="font-medium text-gray-800">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-2">
                    <p className="text-[8px] font-semibold text-gray-600 mb-1">Last Payments</p>
                    {[['Apr 2026','Paid','text-emerald-600'],['Mar 2026','Paid','text-emerald-600'],['Feb 2026','Paid','text-emerald-600']].map(([m,s,c],i)=>(
                      <div key={i} className="flex justify-between text-[8px] py-0.5">
                        <span className="text-gray-500">{m}</span><span className={`font-semibold ${c}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Tenants view their lease, check payment history, report maintenance, read legal notices, view documents and message the agency. Fewer calls to your office. A better tenant experience.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Lease & payments','Maintenance reporting','Document access','Legal notices','Direct messaging','AI chat support','Meter readings','Move-out checklist','Deposit protection','Rent statement','Right to Rent','Inspections'].map((pill, j) => (
                    <span key={j} className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full">{pill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Contractor Portal ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-orange-500 px-6 py-4">
                <div className="flex items-center gap-2 mb-1"><IcoWrench className="w-5 h-5 text-orange-200" /><span className="text-white text-xs font-bold uppercase tracking-widest">Contractor Portal</span></div>
                <h3 className="text-white font-bold text-xl">Contractors stay in sync</h3>
              </div>
              {/* Mockup — left sidebar dark, right pane white */}
              <div className="border-b border-gray-200 overflow-hidden" style={{height:'210px'}}>
                <div className="flex h-full">
                  {/* Sidebar */}
                  <div className="bg-orange-950 w-20 flex-shrink-0 flex flex-col py-2 px-1.5 gap-0.5">
                    {['Jobs','Msgs','Cal','Profile'].map((label,i)=>(
                      <div key={i} className={`flex items-center gap-1 px-1.5 py-1 rounded text-[7px] font-medium ${i===0?'bg-orange-600 text-white':'text-orange-400'}`}>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Right pane */}
                  <div className="flex-1 bg-white overflow-hidden p-2 space-y-1.5">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-1">
                      {[['3','Active','border-orange-400 text-orange-600'],['12','Done','border-emerald-400 text-emerald-600'],['15','Total','border-gray-300 text-gray-600']].map(([n,l,c],i)=>(
                        <div key={i} className={`border-l-2 ${c} bg-gray-50 rounded px-1.5 py-1 text-center`}>
                          <div className="text-xs font-bold">{n}</div>
                          <div className="text-[7px] text-gray-400 uppercase">{l}</div>
                        </div>
                      ))}
                    </div>
                    {/* Filter tabs */}
                    <div className="flex gap-0.5 bg-gray-100 rounded p-0.5">
                      {['Active','Completed','Cancelled','All'].map((t,i)=>(
                        <div key={i} className={`text-[6px] px-1.5 py-0.5 rounded font-medium ${i===0?'bg-white text-gray-800 shadow-sm':'text-gray-400'}`}>{t}</div>
                      ))}
                    </div>
                    {/* Job rows */}
                    {[
                      {title:'Boiler replacement',addr:'Flat 3, Park View',status:'In Progress',dot:'bg-blue-400'},
                      {title:'Leak repair — propose reschedule',addr:'12 Maple Street',status:'Pending',dot:'bg-amber-400'},
                      {title:'Lock replacement',addr:'Unit 7, The Sidings',status:'Completed',dot:'bg-emerald-400'},
                    ].map((j,i)=>(
                      <div key={i} className="border border-gray-100 rounded px-2 py-1 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${j.dot}`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-[7px] font-medium text-gray-800 truncate">{j.title}</p>
                          <p className="text-[6px] text-gray-400">{j.addr}</p>
                        </div>
                        <span className={`text-[6px] font-medium flex-shrink-0 ${i===1?'text-amber-500':'text-gray-400'}`}>{j.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Contractors log in to see their jobs, accept or decline, submit quotes, propose alternative dates, upload photos, mark complete and message the agency directly — no more chasing by phone.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Accept / decline jobs','Quote submission','Propose reschedule','Photo evidence','Job calendar','Direct messaging','Invoice status','Profile management'].map((pill, j) => (
                    <span key={j} className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full">{pill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Public Agency Website ── (full width) */}
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-indigo-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1"><IcoGlobe className="w-5 h-5 text-indigo-300" /><span className="text-white text-xs font-bold uppercase tracking-widest">Public Agency Website</span></div>
                  <h3 className="text-white font-bold text-xl">Your agency, online — automatically</h3>
                </div>
                <div className="text-right hidden sm:block">
                  <a href="/site/tyne-lettings" className="text-right group">
                    <p className="text-indigo-300 text-xs group-hover:text-indigo-200 transition-colors">Live example ↗</p>
                    <p className="text-white text-xs font-mono group-hover:text-indigo-200 transition-colors">propairty.co.uk/site/tyne-lettings</p>
                  </a>
                </div>
              </div>
              {/* Mockup — full width, landscape */}
              <div className="border-b border-gray-200 overflow-hidden bg-gray-50" style={{height:'260px'}}>
                {/* Browser chrome */}
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex items-center gap-2">
                  <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-400"/><div className="w-2 h-2 rounded-full bg-yellow-400"/><div className="w-2 h-2 rounded-full bg-green-400"/></div>
                  <div className="flex-1 bg-white rounded px-2 py-0.5 text-[9px] text-gray-400 border border-gray-200">propairty.co.uk/site/tyne-lettings</div>
                </div>
                {/* Website UI */}
                <div className="overflow-hidden" style={{height:'236px'}}>
                  {/* Agency nav */}
                  <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center justify-between">
                    <div className="font-bold text-indigo-700 text-[10px]">Tyne Lettings</div>
                    <div className="flex gap-3 text-[7px] text-gray-500">
                      {['Properties','Landlords','About','Contact'].map(n=><span key={n}>{n}</span>)}
                    </div>
                    <div className="bg-indigo-600 text-white text-[7px] px-2 py-0.5 rounded font-semibold">Free Valuation</div>
                  </div>
                  {/* Hero — photo background */}
                  <div className="relative px-4 py-3 flex flex-col justify-end" style={{height:'70px',background:'linear-gradient(to right, #1e3a5f 0%, #2d6a9f 50%, #1a4a7a 100%)'}}>
                    {/* fake photo overlay */}
                    <div className="absolute inset-0 opacity-30" style={{background:'url(https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg) center/cover'}} />
                    <div className="relative z-10">
                      <p className="text-white text-[10px] font-bold drop-shadow">Properties to Rent in Tyne &amp; Wear</p>
                      <p className="text-blue-200 text-[7px]">24 homes available · Updated today</p>
                    </div>
                    {/* carousel dots */}
                    <div className="absolute bottom-1.5 right-4 flex gap-1">
                      {[1,2,3,4,5].map(d=><div key={d} className={`rounded-full ${d===1?'bg-white w-3 h-1.5':'bg-white/40 w-1.5 h-1.5'}`}/>)}
                    </div>
                  </div>
                  {/* Filter bar */}
                  <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-1.5">
                    {['Any beds ▾','Any type ▾','£500–£2000 ▾','Sort: Newest ▾'].map(f=>(
                      <div key={f} className="bg-gray-100 border border-gray-200 rounded text-[7px] text-gray-600 px-2 py-0.5">{f}</div>
                    ))}
                    <div className="ml-auto flex gap-1">
                      {['Grid','List','Map'].map((v,i)=>(
                        <div key={i} className={`text-[6px] px-1.5 py-0.5 rounded ${i===0?'bg-indigo-600 text-white':'bg-gray-100 text-gray-400'}`}>{v}</div>
                      ))}
                    </div>
                  </div>
                  {/* Property cards */}
                  <div className="px-3 py-2 grid grid-cols-4 gap-2">
                    {[
                      {addr:'Flat 3, Park View Court',beds:2,bath:1,rent:'£950',badge:'Featured',badgeColor:'bg-amber-400 text-white',photo:'linear-gradient(135deg,#667eea,#764ba2)'},
                      {addr:'12 Maple Street',beds:3,bath:2,rent:'£1,200',badge:'New',badgeColor:'bg-emerald-500 text-white',photo:'linear-gradient(135deg,#f093fb,#f5576c)'},
                      {addr:'Unit 7, The Sidings',beds:1,bath:1,rent:'£725',badge:null,badgeColor:'',photo:'linear-gradient(135deg,#4facfe,#00f2fe)'},
                      {addr:'Regent Terrace, NE1',beds:4,bath:2,rent:'£1,650',badge:'Reduced',badgeColor:'bg-red-500 text-white',photo:'linear-gradient(135deg,#43e97b,#38f9d7)'},
                    ].map((p,i)=>(
                      <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                        <div className="relative" style={{height:'42px',background:p.photo}}>
                          {p.badge && <span className={`absolute top-1 left-1 text-[6px] font-bold px-1 py-0.5 rounded ${p.badgeColor}`}>{p.badge}</span>}
                          <button className="absolute top-1 right-1 text-white/80 text-[10px]">♡</button>
                        </div>
                        <div className="p-1">
                          <p className="text-[7px] font-semibold text-gray-800 leading-tight truncate">{p.addr}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[6px] text-gray-400">{p.beds}bd · {p.bath}ba</span>
                          </div>
                          <p className="text-[7px] font-bold text-indigo-700 mt-0.5">{p.rent}<span className="font-normal text-gray-400"> pcm</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Every agency on PropAIrty gets a fully branded public property listings site — automatically. Tenants browse available properties, filter by beds and price, enquire directly, and request valuations. No extra setup. No website builder. Properties marked as available appear on your site instantly.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Live property listings','Featured properties','Tenant enquiry forms','Valuation requests','Blog & area guides','Landlord info pages','Custom domain support','Review section'].map((pill, j) => (
                    <span key={j} className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{pill}</span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Maintenance workflow ── */}
      <section id="maintenance" className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>From report to closed job.<br/>Nothing falls through.</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">Every step tracked across all four portals. Every party sees exactly where a job stands.</p>
          </div>

          {/* Step rows — 4 then 3, connected by arrows */}
          {[
            [
              { Icon: IcoPhone,   step:1, title:'Tenant reports issue',       desc:'Via portal — description, location, photos attached',                    color:'bg-white border-gray-200', iconCls:'text-violet-600 bg-violet-50', num:'text-violet-500', titleCls:'text-gray-900', descCls:'text-gray-500' },
              { Icon: IcoSparkle, step:2, title:'AI triages & scores',        desc:'Severity, category & contractor suggestion in seconds',                  color:'bg-white border-gray-200', iconCls:'text-indigo-600 bg-indigo-50', num:'text-indigo-500', titleCls:'text-gray-900', descCls:'text-gray-500' },
              { Icon: IcoCheck,   step:3, title:'Agent assigns job',           desc:'One click to dispatch the right contractor',                             color:'bg-white border-gray-200', iconCls:'text-indigo-600 bg-indigo-50', num:'text-indigo-500', titleCls:'text-gray-900', descCls:'text-gray-500' },
              { Icon: IcoWrench,  step:4, title:'Contractor accepts & quotes', desc:'Accepts via portal, submits a quote, confirms date or proposes alternative', color:'bg-white border-gray-200', iconCls:'text-orange-600 bg-orange-50', num:'text-orange-500', titleCls:'text-gray-900', descCls:'text-gray-500' },
            ],
            [
              { Icon: IcoCurrency, step:5, title:'Agent approves quote & date',  desc:'Approves quote, adjusts date if needed — landlord notified, everything timestamped', color:'bg-white border-gray-200', iconCls:'text-emerald-600 bg-emerald-50', num:'text-emerald-600', titleCls:'text-gray-900', descCls:'text-gray-500' },
              { Icon: IcoCamera,   step:6, title:'Work done, photos uploaded',   desc:'Contractor marks complete and attaches before/after evidence',          color:'bg-white border-gray-200', iconCls:'text-orange-600 bg-orange-50', num:'text-orange-500', titleCls:'text-gray-900', descCls:'text-gray-500' },
              { Icon: IcoCheck,    step:7, title:'Invoice paid, all portals updated', desc:'Tenant, landlord & agent see the closed job instantly',            color:'bg-white border-gray-200', iconCls:'text-emerald-600 bg-emerald-50', num:'text-emerald-600', titleCls:'text-gray-900', descCls:'text-gray-500' },
            ],
          ].map((row, rowIdx) => (
            <div key={rowIdx} className={`mb-6 last:mb-0`}>
              <div className="grid gap-3" style={{gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`}}>
                {row.map((s, i) => (
                  <div key={s.step} className="relative flex items-start gap-3">
                    {/* Card */}
                    <div className={`flex-1 border rounded-2xl p-4 ${s.color}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconCls}`}><s.Icon className="w-4 h-4" /></div>
                        <span className={`text-xs font-bold uppercase tracking-widest ${s.num}`}>Step {s.step}</span>
                      </div>
                      <h3 className={`font-bold text-sm leading-snug mb-1 ${s.titleCls || 'text-gray-900'}`}>{s.title}</h3>
                      <p className={`text-xs leading-relaxed ${s.descCls || 'text-gray-500'}`}>{s.desc}</p>
                    </div>
                    {/* Arrow between cards (not after last in row) */}
                    {i < row.length - 1 && (
                      <div className="flex-shrink-0 self-center text-slate-600 text-lg font-light select-none px-0.5">→</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Down arrow between rows */}
              {rowIdx === 0 && (
                <div className="text-center mt-3 text-slate-600 text-xl select-none">↓</div>
              )}
            </div>
          ))}

          {/* Bottom callout */}
          <div className="mt-12 bg-indigo-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold text-lg">Zero jobs lost. Zero chasing contractors.</p>
              <p className="text-indigo-100 text-sm mt-0.5">Every party sees exactly where a job stands — in real time.</p>
            </div>
            <div className="flex items-center gap-6 flex-shrink-0">
              {[[IcoUser,'Tenant'],[IcoBuilding,'Agent'],[IcoHome,'Landlord'],[IcoWrench,'Contractor']].map(([Icon, label]) => (
                <div key={label} className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center mx-auto mb-1"><Icon className="w-4 h-4 text-white" /></div>
                  <p className="text-indigo-100 text-[10px] whitespace-nowrap">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PortalFeatureSection />

      {/* ── Autopilot callout ── */}
      <section className="bg-slate-900 py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — copy */}
            <div>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-4">AI Autopilot</p>
              <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight tracking-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
                Things get logged.<br />
                Then silently forgotten.<br />
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Not any more.</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Every letting agency has the same problem: jobs get assigned, messages get sent, renewals get flagged — and then life moves on and nothing gets followed up.
              </p>
              <p className="text-slate-300 text-lg leading-relaxed mb-8">
                PropAIrty's AI Autopilot has memory and persistence so your team doesn't have to. It watches every open workflow across all four portals and steps in the moment something stalls — chasing contractors, nudging tenants, alerting agents.
              </p>
              <div className="space-y-4 mb-10">
                {[
                  { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Jobs actually get finished' },
                  { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', text: 'Tenants actually get replies' },
                  { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', text: "Renewals don't sneak up on anyone" },
                  { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Arrears get chased before they compound' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    </div>
                    <span className="text-slate-200 font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-sm italic border-l-2 border-indigo-500/40 pl-4">
                "That's worth a lot more than another reporting chart."
              </p>
            </div>

            {/* Right — visual */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 bg-indigo-600/10 rounded-3xl blur-3xl" />
              <div className="relative bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="text-sm font-semibold text-white">AI Autopilot</span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">Active</span>
                  </div>
                  <span className="text-xs text-slate-500">Runs every 4 hours</span>
                </div>

                {/* Activity feed */}
                <div className="p-5 space-y-3">
                  {[
                    { time: '09:02', color: 'amber',  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Chased contractor', detail: 'Job #47 — no update for 5 days', sub: 'Swift Plumbing Ltd messaged via portal' },
                    { time: '09:02', color: 'blue',   icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', label: 'Alerted agent', detail: 'Sarah Mitchell — message unanswered 26h', sub: 'Notification sent to agent dashboard' },
                    { time: '09:02', color: 'purple', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Reminded tenant', detail: 'Renewal offer — no response after 7 days', sub: 'Oliver Bennett messaged via tenant portal' },
                    { time: '09:02', color: 'rose',   icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Chased arrears', detail: '£850 overdue — 6 days', sub: 'James Okafor messaged via tenant portal' },
                    { time: '09:02', color: 'green',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'All other workflows up to date', detail: '24 checks passed', sub: 'Next run at 13:00' },
                  ].map((item, i) => {
                    const colorMap = {
                      amber:  { bg: 'bg-amber-500/20',  icon: 'text-amber-400',  dot: 'bg-amber-500' },
                      blue:   { bg: 'bg-blue-500/20',   icon: 'text-blue-400',   dot: 'bg-blue-500' },
                      purple: { bg: 'bg-purple-500/20', icon: 'text-purple-400', dot: 'bg-purple-500' },
                      rose:   { bg: 'bg-rose-500/20',   icon: 'text-rose-400',   dot: 'bg-rose-500' },
                      green:  { bg: 'bg-green-500/20',  icon: 'text-green-400',  dot: 'bg-green-500' },
                    }[item.color]
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-700/40 hover:bg-slate-700/70 transition-colors">
                        <div className={`w-8 h-8 rounded-lg ${colorMap.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <svg className={`w-4 h-4 ${colorMap.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{item.label}</span>
                            <span className="text-xs text-slate-500">{item.time}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
                          <p className="text-xs text-slate-500 mt-0.5 italic">{item.sub}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── AI callout ── */}
      <section className="bg-slate-50 border-t border-gray-100 py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-indigo-950 rounded-2xl overflow-hidden">
          <div className="px-8 pt-12 pb-8 text-center">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-4">AI assistant</p>
            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Your portfolio. Answers in plain English.</h2>
            <p className="text-indigo-300 max-w-xl mx-auto text-base leading-relaxed">
              The AI assistant reads your live data — leases, payments, maintenance jobs, compliance certs, notices.
              Real answers with names, dates and amounts from your actual portfolio.
            </p>
          </div>

          {/* Chat mockup */}
          <div className="mx-6 md:mx-16 mb-8 rounded-xl border border-indigo-800 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-indigo-800 bg-indigo-900/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-indigo-300 font-medium">AI Assistant — connected to your live portfolio</span>
            </div>
            <div className="bg-indigo-900/40 p-5 space-y-4">
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs leading-relaxed">
                  Which leases expire in the next 60 days?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-indigo-800/60 text-indigo-100 text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-sm leading-relaxed">
                  You have <strong className="text-white">7 leases</strong> expiring before 10 June — Flat 3 Park View Court, 12 Maple St, Unit 7 The Sidings and 4 others. 3 tenants haven't been contacted about renewal yet. Want me to draft the letters?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs leading-relaxed">
                  Yes. Also — which gas safety certs expire this quarter?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-indigo-800/60 text-indigo-100 text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-sm leading-relaxed">
                  Drafting renewal letters now…<br />
                  Gas safety certs: <strong className="text-white">4 expiring before 30 June</strong> — Park View Ct (12 Apr), Maple St (3 May), Oak Lane (18 May), Regent Terrace (27 Jun). I can add Telegram reminders for each.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-indigo-800 bg-indigo-900/60">
              <div className="flex-1 bg-indigo-900 rounded-lg px-3 py-2 text-xs text-indigo-500 select-none">Ask anything about your portfolio…</div>
              <div className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg select-none">Send</div>
            </div>
          </div>

          <div className="text-center pb-10">
            <a href="#book-demo" className="inline-block bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
              Book a demo
            </a>
          </div>
        </div>
      </div>
      </section>

      {/* ── Competitor comparison ── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-[0.2em] mb-3">The honest comparison</p>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-3" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>How we compare.</h2>
            <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">Most property management software was built before AI existed. Propairty was built with it from day one.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-500">Platform</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">AI Built-in</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">4 Portals</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">Doc Gen</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">AI Dispatch</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-500">Listing Site</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.map((c, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${c.highlight ? 'bg-indigo-50' : ''}`}>
                    <td className={`py-3 pr-4 font-medium ${c.highlight ? 'text-indigo-700 font-bold' : 'text-gray-500'}`}>
                      {c.highlight && <span className="text-indigo-500 mr-1">★</span>}{c.name}
                    </td>
                    <td className="text-center py-3 px-3">{c.ai ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="text-center py-3 px-3">{c.allPortals ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="text-center py-3 px-3">{c.docGen ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="text-center py-3 px-3">{c.dispatch ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-lg">—</span>}</td>
                    <td className="text-center py-3 px-3">{c.listingSite ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span> : <span className="text-gray-300 text-lg">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">Based on publicly available information, April 2026.</p>
          </div>
        </div>
      </section>

      <UkCompliance />

      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── Book a demo ── */}
      <section id="book-demo" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 py-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-4">Get started</p>
            <h2 className="text-5xl font-extrabold text-white mb-4" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>Book a demo.</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
              See Propairty on a live portfolio. We'll walk you through every feature and answer your questions.
            </p>
          </div>
          <DemoForm />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-10 bg-slate-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <span className="font-bold text-indigo-400 text-lg">Prop<span className="text-white">AI</span>rty</span>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Complete AI-powered property management for UK letting agents and landlords.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-slate-400 text-xs uppercase tracking-wide">Product</p>
                <a href="#book-demo" className="block text-slate-500 hover:text-white transition-colors">Book a demo</a>
                <Link to="/demos" className="block text-slate-500 hover:text-white transition-colors">Watch demos</Link>
                <Link to="/login" className="block text-slate-500 hover:text-white transition-colors">Sign in</Link>
                <a href="#faq" className="block text-slate-500 hover:text-white transition-colors">FAQ</a>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-400 text-xs uppercase tracking-wide">Legal</p>
                <Link to="/privacy" className="block text-slate-500 hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="block text-slate-500 hover:text-white transition-colors">Terms of Service</Link>
                <a href="mailto:info@genaixa.co.uk" className="block text-slate-500 hover:text-white transition-colors">Contact</a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} PropAIrty. Your data is isolated and never shared between organisations.
            </p>
            <p className="text-xs text-slate-600">Built in the UK</p>
          </div>
        </div>
      </footer>

      {/* ── Sticky mobile CTA ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 sm:hidden transition-all duration-300 ${showStickyCta ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <div className="bg-slate-900/95 backdrop-blur border-t border-slate-700/50 px-4 py-3 flex gap-3">
          <Link to="/login" className="flex-1 border border-slate-600 text-white text-sm font-semibold py-2.5 rounded-xl text-center transition-colors">
            Try it live
          </Link>
          <a href="#book-demo" className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors">
            Book a demo
          </a>
        </div>
      </div>

      {/* Wendy — prospect AI assistant */}
      <PortalAiChat
        apiUrl="/api/public/wendy"
        isPublic
        name="Wendy"
        color="indigo"
        greeting="Hi! I'm Wendy, PropAIrty's AI assistant. Ask me anything about the platform — portals, features, how it works, pricing — I'm here to help."
        footerNote="Ask me anything about PropAIrty"
        suggestions={[
          'What portals does PropAIrty have?',
          'How does the tenant portal work?',
          'What AI features are included?',
          'How do I get started?',
        ]}
      />
    </div>
  )
}
