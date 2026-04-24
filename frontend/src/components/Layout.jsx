import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { logout } from '../lib/auth'
import AiChat from './AiChat'
import OtherPortals from './OtherPortals'
import ProfileDropdown from './ProfileDropdown'
import api from '../lib/api'

function getGroups(t) {
  return [
    {
      label: 'Portfolio', icon: '🏠',
      items: [
        { to: '/landlords',      label: 'Landlords',         icon: '🏢' },
        { to: '/properties',     label: t('nav.properties'), icon: '🏠' },
        { to: '/tenants',        label: t('nav.tenants'),    icon: '👤' },
        { to: '/meter-readings', label: 'Meter Readings',    icon: '📊' },
        { to: '/applicants',     label: t('nav.applicants'), icon: '🔍' },
        { to: '/leases',         label: t('nav.leases'),     icon: '📄' },
      ],
    },
    {
      label: 'Operations', icon: '🔧',
      items: [
        { to: '/contractors', label: t('nav.contractors'), icon: '🔨' },
        { to: '/maintenance', label: t('nav.maintenance'), icon: '🔧' },
        { to: '/ppm',         label: t('nav.ppm'),         icon: '🗓️' },
        { to: '/dispatch',    label: t('nav.dispatch'),    icon: '🚀' },
        { to: '/inspections', label: t('nav.inspections'), icon: '🔎' },
        { to: '/inventory',   label: t('nav.inventory'),   icon: '📝' },
        { to: '/checklists',  label: 'Checklists',          icon: '☑️' },
      ],
    },
    {
      label: 'Finance', icon: '💷',
      items: [
        { to: '/payments',    label: t('nav.payments'),    icon: '💷' },
        { to: '/deposits',    label: t('nav.deposits'),    icon: '🏦' },
        { to: '/accounting',  label: t('nav.accounting'),  icon: '🧾' },
        { to: '/tax-summary', label: 'Tax Summary',        icon: '🧮' },
      ],
    },
    {
      label: 'Compliance & Legal', icon: '📋',
      items: [
        { to: '/compliance',      label: t('nav.compliance'),  icon: '📋' },
        { to: '/right-to-rent',   label: 'Right to Rent',      icon: '🛂' },
        { to: '/notices',         label: t('nav.notices'),     icon: '⚖️' },
        { to: '/deposit-dispute', label: 'Deposit Dispute',    icon: '⚖️' },
        { to: '/documents',       label: t('nav.documents'),   icon: '📁' },
      ],
    },
    {
      label: 'Intelligence', icon: '🤖',
      items: [
        { to: '/analytics',             label: t('nav.analytics'),   icon: '📈' },
        { to: '/cfo',                   label: 'CFO Dashboard',      icon: '💼' },
        { to: '/alerts',                label: t('nav.alerts'),      icon: '🔔' },
        { to: '/renewals',              label: t('nav.renewals'),    icon: '🔄' },
        { to: '/risk',                  label: t('nav.risk'),        icon: '🎯' },
        { to: '/rent-optimisation',     label: 'Rent Optimiser',     icon: '💹' },
        { to: '/churn-risk',            label: 'Churn Risk',         icon: '⚠️' },
        { to: '/void-minimiser',        label: 'Void Minimiser',     icon: '🚨' },
        { to: '/valuation',             label: t('nav.valuation'),   icon: '🏷️' },
        { to: '/epc-roadmap',           label: 'EPC Roadmap',        icon: '🌿' },
        { to: '/contractor-performance',label: 'Contractor Perf.',   icon: '⭐' },
        { to: '/listing-generator',     label: 'Listing Generator',  icon: '✍️' },
        { to: '/insurance-claims',      label: 'Insurance Claims',   icon: '🛡️' },
        { to: '/lease-analyser',        label: 'Lease Analyser',     icon: '🔍' },
        { to: '/email-triage',          label: 'Email Triage',       icon: '📧' },
        { to: '/phone-agent',           label: 'AI Phone Agent',     icon: '📞' },
        { to: '/surveys',               label: 'Surveys',            icon: '⭐' },
      ],
    },
    {
      label: 'Admin', icon: '⚙️',
      items: [
        { to: '/files',      label: t('nav.files'),      icon: '📁' },
        { to: '/news',       label: t('nav.news'),       icon: '📰' },
        { to: '/workflows',  label: 'Workflows',         icon: '⚙️' },
        { to: '/audit-log',  label: 'Audit Trail',       icon: '📜' },
        { to: '/settings',   label: t('nav.settings'),   icon: '🔧' },
      ],
    },
  ]
}

function NavGroup({ group, currentPath }) {
  const isActive = group.items.some(i => currentPath.startsWith(i.to))
  const [open, setOpen] = useState(isActive)

  useEffect(() => { if (isActive) setOpen(true) }, [currentPath])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors text-left ${
          isActive ? 'text-indigo-300' : 'text-indigo-600 hover:text-indigo-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <span>{group.icon}</span>
          {group.label}
        </span>
        <span className={`transition-transform text-xs ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-0.5 mb-1 ml-2 space-y-0.5 border-l border-indigo-900 pl-2">
          {group.items.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
                }`
              }
            >
              <span className="text-sm">{icon}</span>
              <span className="flex-1 truncate">{label}</span>
              {badge > 0 && (
                <span className="bg-violet-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// Roles that can see each nav group (absent = all roles allowed)
// negotiator: field-focused, no Finance or Intelligence
// accounts: finance-focused, no Operations
const GROUP_ROLE_GATES = {
  'Finance':      new Set(['admin', 'manager', 'accounts', 'read_only', 'agent']),
  'Operations':   new Set(['admin', 'manager', 'negotiator', 'read_only', 'agent']),
  'Intelligence': new Set(['admin', 'manager', 'read_only', 'agent']),
}

// Map route paths to feature flag keys
const ROUTE_FLAGS = {
  '/analytics': 'agent_analytics',
  '/cfo': 'agent_cfo',
  '/alerts': 'agent_alerts',
  '/renewals': 'agent_renewals',
  '/accounting': 'agent_accounting',
  '/dispatch': 'agent_dispatch',
  '/ppm': 'agent_ppm',
  '/audit-log': 'agent_audit_log',
  '/workflows': 'agent_workflows',
  '/checklists': 'agent_checklists',
  // Intelligence group — all gated under agent_ai_tools
  '/risk': 'agent_ai_tools',
  '/rent-optimisation': 'agent_ai_tools',
  '/churn-risk': 'agent_ai_tools',
  '/void-minimiser': 'agent_ai_tools',
  '/epc-roadmap': 'agent_ai_tools',
  '/contractor-performance': 'agent_ai_tools',
  '/listing-generator': 'agent_ai_tools',
  '/insurance-claims': 'agent_ai_tools',
  '/lease-analyser': 'agent_ai_tools',
  '/email-triage': 'agent_ai_tools',
  '/phone-agent': 'agent_ai_tools',
  '/surveys': 'agent_ai_tools',
  '/valuation': 'agent_ai_tools',
}

export default function Layout({ children }) {
  const [me, setMe] = useState(null)
  const [totalUnread, setTotalUnread] = useState(0)
  const [navFeatures, setNavFeatures] = useState({})
  const location = useLocation()
  const { t, i18n } = useTranslation()

  useEffect(() => { api.get('/auth/me').then(r => setMe(r.data)).catch(() => {}) }, [])
  useEffect(() => { api.get('/settings/features').then(r => {
    const flags = {}
    for (const items of Object.values(r.data.groups || {}))
      for (const f of items) flags[f.key] = f.enabled
    setNavFeatures(flags)
  }).catch(() => {}) }, [])

  useEffect(() => {
    function fetchUnread() {
      Promise.all([
        api.get('/tenants/messages/inbox').catch(() => ({ data: [] })),
        api.get('/landlord/messages/inbox').catch(() => ({ data: [] })),
        api.get('/contractors/messages/inbox').catch(() => ({ data: [] })),
      ]).then(([t, l, c]) => {
        const total =
          t.data.reduce((s, x) => s + (x.unread || 0), 0) +
          l.data.reduce((s, x) => s + (x.unread || 0), 0) +
          c.data.reduce((s, x) => s + (x.unread || 0), 0)
        setTotalUnread(total)
      })
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [])

  const userRole = me?.role || 'agent'
  const groups = getGroups(t).map(g => ({
    ...g,
    items: g.items.filter(item => {
      const flag = ROUTE_FLAGS[item.to]
      if (!flag) return true
      return navFeatures[flag] !== false
    })
  })).filter(g => {
    if (g.items.length === 0) return false
    const gate = GROUP_ROLE_GATES[g.label]
    if (!gate) return true
    return gate.has(userRole)
  })

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Sidebar + main row */}
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="w-60 bg-indigo-950 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-indigo-900">
          <NavLink to="/dashboard" className="block">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-indigo-300">Prop</span><span className="text-white">AI</span><span className="text-indigo-300">rty</span>
            </h1>
            <p className="text-xs text-indigo-500 mt-0.5">Agent Portal</p>
          </NavLink>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
              }`
            }
          >
            <span>📊</span>
            <span className="flex-1">{t('nav.dashboard')}</span>
            {totalUnread > 0 && (
              <span className="bg-violet-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </NavLink>

          {groups.map(group => (
            <NavGroup key={group.label} group={group} currentPath={location.pathname} />
          ))}
        </nav>

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top header bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <span className="text-sm text-gray-400">{me?.organisation_name}</span>
          <div className="flex items-center gap-4">
            {me && (
              <ProfileDropdown
                me={me}
                onUpdate={async (patch) => { const r = await api.patch('/auth/me', patch); setMe(r.data) }}
                onPassword={async ({ current, next }) => api.post('/auth/me/change-password', { current_password: current, new_password: next })}
                onLogout={logout}
                accentRing="focus:ring-indigo-500"
                btnClass="bg-indigo-600 hover:bg-indigo-700"
                hasPhone={false}
              />
            )}
          </div>
        </header>
        <div className="p-8 flex-1">{children}</div>
      </main>
      </div>{/* end sidebar+main row */}

      <OtherPortals current="agent" />
      <AiChat />
    </div>
  )
}
