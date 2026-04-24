/**
 * Decorative Pexels illustrations for empty states and page headers.
 * Images are curated and served directly from Pexels CDN (free, attribution via Pexels link).
 */

export const ILLUSTRATIONS = {
  dashboard:   "https://images.pexels.com/photos/1656169/pexels-photo-1656169.jpeg?auto=compress&cs=tinysrgb&h=350",
  properties:  "https://images.pexels.com/photos/5849570/pexels-photo-5849570.jpeg?auto=compress&cs=tinysrgb&h=350",
  tenants:     "https://images.pexels.com/photos/5398820/pexels-photo-5398820.jpeg?auto=compress&cs=tinysrgb&h=350",
  maintenance: "https://images.pexels.com/photos/7019374/pexels-photo-7019374.jpeg?auto=compress&cs=tinysrgb&h=350",
  payments:    "https://images.pexels.com/photos/5849590/pexels-photo-5849590.jpeg?auto=compress&cs=tinysrgb&h=350",
  compliance:  "https://images.pexels.com/photos/7722614/pexels-photo-7722614.jpeg?auto=compress&cs=tinysrgb&h=350",
  analytics:   "https://images.pexels.com/photos/5849595/pexels-photo-5849595.jpeg?auto=compress&cs=tinysrgb&h=350",
  applicants:  "https://images.pexels.com/photos/5336955/pexels-photo-5336955.jpeg?auto=compress&cs=tinysrgb&h=350",
  deposits:    "https://images.pexels.com/photos/5273054/pexels-photo-5273054.jpeg?auto=compress&cs=tinysrgb&h=350",
  notices:     "https://images.pexels.com/photos/6077091/pexels-photo-6077091.jpeg?auto=compress&cs=tinysrgb&h=350",
  inspections: "https://images.pexels.com/photos/36766860/pexels-photo-36766860.jpeg?auto=compress&cs=tinysrgb&h=350",
  contractors: "https://images.pexels.com/photos/36522599/pexels-photo-36522599.jpeg?auto=compress&cs=tinysrgb&h=350",
  leases:      "https://images.pexels.com/photos/7734574/pexels-photo-7734574.jpeg?auto=compress&cs=tinysrgb&h=350",
  empty:       "https://images.pexels.com/photos/36470786/pexels-photo-36470786.jpeg?auto=compress&cs=tinysrgb&h=350",
  survey:      "https://images.pexels.com/photos/1254735/pexels-photo-1254735.jpeg?auto=compress&cs=tinysrgb&h=350",
  phone:       "https://images.pexels.com/photos/3965237/pexels-photo-3965237.jpeg?auto=compress&cs=tinysrgb&h=350",
  tax:         "https://images.pexels.com/photos/6927341/pexels-photo-6927341.jpeg?auto=compress&cs=tinysrgb&h=350",
  epc:         "https://images.pexels.com/photos/5849586/pexels-photo-5849586.jpeg?auto=compress&cs=tinysrgb&h=350",
  churn:       "https://images.pexels.com/photos/6834796/pexels-photo-6834796.jpeg?auto=compress&cs=tinysrgb&h=350",
  void:        "https://images.pexels.com/photos/6373674/pexels-photo-6373674.jpeg?auto=compress&cs=tinysrgb&h=350",
}

/**
 * PageHero — a soft illustrated banner at the top of a page.
 * Usage: <PageHero type="properties" title="Properties" subtitle="Manage your portfolio" />
 */
export function PageHero({ type, title, subtitle, children }) {
  const src = ILLUSTRATIONS[type] || ILLUSTRATIONS.empty
  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 h-32 sm:h-40">
      {/* Blurred background image */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'blur(2px) brightness(0.45)', transform: 'scale(1.05)' }}
        loading="lazy"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/60 to-transparent" />
      {/* Content */}
      <div className="relative h-full flex items-center justify-between px-7">
        <div>
          <h1 className="text-2xl font-bold text-white drop-shadow">{title}</h1>
          {subtitle && <p className="text-sm text-indigo-200 mt-1">{subtitle}</p>}
        </div>
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

/**
 * PageHeader — slim, consistent page header for all agent portal pages.
 * Usage: <PageHeader title="Maintenance" subtitle="Track and resolve property issues">
 *          <button>+ Add</button>
 *        </PageHeader>
 */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between gap-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  )
}

/**
 * EmptyState — shown when a list/table has no data.
 * Usage: <EmptyState type="maintenance" message="No jobs yet" />
 */
export function EmptyState({ type, message, action }) {
  const src = ILLUSTRATIONS[type] || ILLUSTRATIONS.empty
  return (
    <div className="flex flex-col items-center py-16 px-6 text-center">
      <div className="w-48 h-32 rounded-xl overflow-hidden mb-5 shadow-md opacity-80">
        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="text-gray-500 text-sm font-medium">{message}</p>
      {action && <div className="mt-4">{action}</div>}
      <a
        href="https://www.pexels.com"
        target="_blank"
        rel="noreferrer"
        className="text-xs text-gray-300 hover:text-gray-400 mt-4"
      >
        Photos by Pexels
      </a>
    </div>
  )
}
