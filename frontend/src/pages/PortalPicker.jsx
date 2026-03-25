import { Link } from 'react-router-dom'

const portals = [
  {
    to: '/login/agent',
    label: 'Letting Agent',
    description: 'Manage your full property portfolio',
    color: 'indigo',
    icon: '🏢',
  },
  {
    to: '/landlord/login',
    label: 'Landlord',
    description: 'View your properties, financials & documents',
    color: 'emerald',
    icon: '🏠',
  },
  {
    to: '/tenant/login',
    label: 'Tenant',
    description: 'Pay rent, raise maintenance requests & more',
    color: 'violet',
    icon: '👤',
  },
  {
    to: '/contractor/login',
    label: 'Contractor',
    description: 'View and manage your assigned jobs',
    color: 'orange',
    icon: '🔧',
  },
]

const borderCls = {
  indigo:  'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50',
  emerald: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
  violet:  'border-violet-200 hover:border-violet-400 hover:bg-violet-50',
  orange:  'border-orange-200 hover:border-orange-400 hover:bg-orange-50',
}

const textCls = {
  indigo:  'text-indigo-600',
  emerald: 'text-emerald-600',
  violet:  'text-violet-600',
  orange:  'text-orange-600',
}

export default function PortalPicker() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-indigo-600">
            Prop<span className="text-gray-900">AI</span>rty
          </h1>
          <p className="text-gray-500 mt-2 text-sm">AI-powered property management</p>
          <p className="text-gray-700 font-medium mt-6">Who are you signing in as?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {portals.map(p => (
            <Link
              key={p.to}
              to={p.to}
              className={`bg-white border-2 ${borderCls[p.color]} rounded-2xl p-6 transition-all group`}
            >
              <div className="text-3xl mb-3">{p.icon}</div>
              <p className={`font-semibold text-base ${textCls[p.color]}`}>{p.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{p.description}</p>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          New to PropAIrty?{' '}
          <Link to="/signup" className="text-indigo-500 hover:underline font-medium">Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
