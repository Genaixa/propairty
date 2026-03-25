import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import AiChat from './AiChat'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/properties', label: 'Properties', icon: '🏠' },
  { to: '/tenants', label: 'Tenants', icon: '👤' },
  { to: '/applicants', label: 'Applicants', icon: '🔍' },
  { to: '/leases', label: 'Leases', icon: '📄' },
  { to: '/maintenance', label: 'Maintenance', icon: '🔧' },
  { to: '/ppm', label: 'Planned Maint.', icon: '🗓️' },
  { to: '/payments', label: 'Payments', icon: '💷' },
  { to: '/compliance', label: 'Compliance', icon: '📋' },
  { to: '/notices', label: 'Notices', icon: '⚖️' },
  { to: '/deposits', label: 'Deposits', icon: '🏦' },
  { to: '/alerts', label: 'Alerts', icon: '🔔' },
  { to: '/documents', label: 'Documents', icon: '📄' },
  { to: '/inspections', label: 'Inspections', icon: '📋' },
  { to: '/inventory', label: 'Inventory', icon: '📝' },
  { to: '/risk', label: 'Rent Risk', icon: '🎯' },
  { to: '/renewals', label: 'Renewals', icon: '🔄' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/valuation', label: 'Valuation', icon: '🏷️' },
  { to: '/accounting', label: 'Accounting', icon: '🧾' },
  { to: '/files', label: 'Files', icon: '📁' },
  { to: '/dispatch', label: 'Dispatch', icon: '🚀' },
  { to: '/contractors', label: 'Contractors', icon: '🔨' },
  { to: '/news', label: 'News', icon: '📰' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">
            Prop<span className="text-gray-900">AI</span>rty
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Property Management</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full text-sm text-gray-500 hover:text-red-500 text-left px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>

      <AiChat />
    </div>
  )
}
