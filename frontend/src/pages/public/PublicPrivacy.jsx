import { useParams } from 'react-router-dom'
import PublicLayout, { bb, useOrgData } from './PublicLayout'

const D = '#4f46e5'

export default function PublicPrivacy() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {new Date().getFullYear()}</p>

        {[
          {
            title: 'Who we are',
            body: `${org?.name || 'The agency'} is the data controller for information collected through this website. We are registered with the Information Commissioner's Office (ICO).`,
          },
          {
            title: 'What information we collect',
            body: `We collect information you provide when: submitting a viewing request or enquiry (name, email, phone); saving a property search (email address); submitting a review; or contacting us via our contact form. We may also collect technical data such as your IP address and browser type via cookies.`,
          },
          {
            title: 'How we use your information',
            body: `We use your information to: respond to enquiries and arrange property viewings; send you property alerts you've signed up for; maintain records of applications and communications; and improve our website and services. We do not sell your data to third parties.`,
          },
          {
            title: 'Legal basis for processing',
            body: `We process your data on the basis of: your consent (for search alerts and marketing); our legitimate interests (responding to enquiries, improving our service); and compliance with legal obligations (referencing checks, right-to-rent verification during tenancy applications).`,
          },
          {
            title: 'Data retention',
            body: `Enquiry data is retained for up to 2 years. Search alerts are deleted when you unsubscribe. Review submissions are retained indefinitely. You may request deletion of your data at any time.`,
          },
          {
            title: 'Your rights',
            body: `Under UK GDPR you have the right to: access your personal data; rectify inaccurate data; request erasure; object to processing; and lodge a complaint with the ICO (ico.org.uk). To exercise any of these rights, contact us at the address below.`,
          },
          {
            title: 'Cookies',
            body: `This website uses essential cookies to function. We may also use analytics cookies to understand how visitors use the site. You can control cookies through your browser settings. Disabling certain cookies may affect functionality.`,
          },
          {
            title: 'Changes to this policy',
            body: `We may update this Privacy Policy from time to time. The latest version is always available on this page.`,
          },
        ].map(s => (
          <section key={s.title} className="mb-8">
            <h2 className="text-base font-bold text-gray-900 mb-2">{s.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
          </section>
        ))}

        {org?.email && (
          <div className="mt-10 bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <p className="text-sm text-gray-600">Data protection enquiries: <a href={`mailto:${org.email}`} className="text-indigo-600 hover:underline">{org.email}</a></p>
            {org.address_text && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{org.address_text}</p>}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
