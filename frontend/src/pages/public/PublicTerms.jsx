import { useParams } from 'react-router-dom'
import PublicLayout, { bb, useOrgData } from './PublicLayout'

const D = '#4f46e5'

export default function PublicTerms() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {new Date().getFullYear()}</p>

        {[
          {
            title: '1. Use of this website',
            body: `This website is operated by ${org?.name || 'the agency'}. By using this site you agree to these terms. You may not use this site for any unlawful purpose or in a way that could damage or impair the service.`,
          },
          {
            title: '2. Property listings',
            body: `All property listings are provided for information purposes only. While we take every care to ensure accuracy, we cannot guarantee that listing details are complete, current or error-free. All listings are subject to availability and rental prices may change without notice.`,
          },
          {
            title: '3. Enquiries and applications',
            body: `Submitting a viewing request or enquiry through this website does not constitute a tenancy agreement or binding commitment. Tenancies are only formed upon signing of a formal tenancy agreement.`,
          },
          {
            title: '4. Intellectual property',
            body: `All content on this website — including text, images, logos and design — is the property of ${org?.name || 'the agency'} or its licensors. You may not reproduce or redistribute any content without prior written permission.`,
          },
          {
            title: '5. Limitation of liability',
            body: `To the extent permitted by law, we exclude all liability for any loss or damage arising from use of this website. We accept no responsibility for the content of external websites linked from these pages.`,
          },
          {
            title: '6. Privacy',
            body: `Your use of this site is also governed by our Privacy Policy. By using this site, you consent to our collection and use of personal data as described therein.`,
          },
          {
            title: '7. Changes to terms',
            body: `We reserve the right to modify these terms at any time. Continued use of the site following any changes constitutes acceptance of the revised terms.`,
          },
          {
            title: '8. Governing law',
            body: `These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
          },
        ].map(s => (
          <section key={s.title} className="mb-8">
            <h2 className="text-base font-bold text-gray-900 mb-2">{s.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
          </section>
        ))}

        {org?.email && (
          <div className="mt-10 bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <p className="text-sm text-gray-600">If you have any questions about these terms, please contact us at <a href={`mailto:${org.email}`} className="text-indigo-600 hover:underline">{org.email}</a>.</p>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
