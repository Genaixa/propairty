import { useParams } from 'react-router-dom'
import PublicLayout, { bt, useOrgData } from './PublicLayout'

const D = '#4f46e5'

export default function PublicSitemap() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  const sections = [
    {
      title: 'Properties',
      links: [
        { label: 'All properties to rent', href: `/site/${slug}` },
        { label: 'Area guides', href: `/site/${slug}/areas` },
      ],
    },
    {
      title: 'About us',
      links: [
        { label: 'About the agency', href: `/site/${slug}/about` },
        { label: 'Customer reviews', href: `/site/${slug}/reviews` },
        { label: 'News & Blog', href: `/site/${slug}/blog` },
      ],
    },
    {
      title: 'Landlords',
      links: [
        { label: 'Landlord services', href: `/site/${slug}/landlords` },
        { label: 'Free rental valuation', href: `/site/${slug}/valuation` },
        { label: 'Landlord advice', href: `/site/${slug}/landlord-advice` },
      ],
    },
    {
      title: 'Tenants',
      links: [
        { label: 'Tenant advice', href: `/site/${slug}/tenant-advice` },
        { label: 'Request a viewing', href: `/site/${slug}` },
      ],
    },
    {
      title: 'Contact & legal',
      links: [
        { label: 'Contact us', href: `/site/${slug}/contact` },
        { label: 'Terms & Conditions', href: `/site/${slug}/terms` },
        { label: 'Privacy Policy', href: `/site/${slug}/privacy` },
      ],
    },
  ]

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-10">Sitemap</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map(s => (
            <div key={s.title}>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{s.title}</h2>
              <ul className="space-y-2">
                {s.links.map(l => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm hover:underline" style={bt(brand)}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
