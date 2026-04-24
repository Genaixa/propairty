/**
 * Thin footer strip shown at the bottom of each portal.
 * Lets users (and demo visitors) jump to any other portal in one click.
 *
 * Props:
 *   current — 'agent' | 'landlord' | 'tenant' | 'contractor'
 */

const ALL = [
  {
    key: 'agent',
    label: 'Agent Portal',
    href: '/login/agent',
    color: 'text-indigo-400 hover:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  {
    key: 'landlord',
    label: 'Landlord Portal',
    href: '/landlord/login',
    color: 'text-emerald-400 hover:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  {
    key: 'tenant',
    label: 'Tenant Portal',
    href: '/tenant/login',
    color: 'text-violet-400 hover:text-violet-300',
    dot: 'bg-violet-500',
  },
  {
    key: 'contractor',
    label: 'Contractor Portal',
    href: '/contractor/login',
    color: 'text-orange-400 hover:text-orange-300',
    dot: 'bg-orange-500',
  },
]

export default function OtherPortals({ current }) {
  const others = ALL.filter(p => p.key !== current)

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-slate-500 text-xs font-medium shrink-0">Other portals:</span>
      {others.map(p => (
        <a
          key={p.key}
          href={p.href}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${p.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </a>
      ))}
      <a
        href="/"
        className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors shrink-0"
      >
        propairty.co.uk ↗
      </a>
    </div>
  )
}
