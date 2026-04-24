import { Link } from 'react-router-dom'

const COLORS = {
  indigo: { bar: 'bg-indigo-500', val: 'text-indigo-600', bg: 'bg-indigo-50' },
  green:  { bar: 'bg-emerald-500', val: 'text-emerald-600', bg: 'bg-emerald-50' },
  amber:  { bar: 'bg-amber-400',  val: 'text-amber-600',  bg: 'bg-amber-50' },
  red:    { bar: 'bg-red-500',    val: 'text-red-600',    bg: 'bg-red-50' },
  blue:   { bar: 'bg-blue-500',   val: 'text-blue-600',   bg: 'bg-blue-50' },
  violet: { bar: 'bg-violet-500', val: 'text-violet-600', bg: 'bg-violet-50' },
}

export default function StatCard({ label, value, sub, color = 'indigo', to, icon }) {
  const c = COLORS[color] || COLORS.indigo
  const inner = (
    <div className="relative overflow-hidden">
      {/* Accent bar */}
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${c.bar}`} />
      <div className="pl-4">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none mb-2">{label}</p>
          {icon && (
            <span className={`text-lg p-1.5 rounded-lg ${c.bg}`}>{icon}</span>
          )}
        </div>
        <p className={`text-2xl font-extrabold tracking-tight ${c.val}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1.5 font-medium">{sub}</p>}
      </div>
    </div>
  )

  const base = 'block bg-white rounded-xl border border-gray-200 p-4 transition-all'
  if (to) {
    return (
      <Link to={to} className={`${base} hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5`}>
        {inner}
      </Link>
    )
  }
  return <div className={base}>{inner}</div>
}
