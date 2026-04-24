import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''

const D = '#4f46e5'

const ARTICLES = [
  {
    icon: '📋', title: 'Legal obligations every landlord must meet',
    body: `Before letting a property you must ensure: a valid Energy Performance Certificate (EPC) rated E or above; annual gas safety checks by a Gas Safe registered engineer; an Electrical Installation Condition Report (EICR) every 5 years; working smoke alarms on each floor and a carbon monoxide alarm in rooms with combustion appliances.

You must also protect the deposit in a government-approved scheme within 30 days of receipt, provide the tenant with prescribed information, and supply the How to Rent guide.`,
  },
  {
    icon: '💷', title: 'Maximising your rental yield',
    body: `Rental yield = annual rent ÷ property value × 100. The UK average gross yield is around 5–6%, but varies significantly by location and property type.

To maximise yield: keep void periods short by pricing competitively; maintain the property well to retain good tenants; review rents annually; and consider light refurbishments (fresh paint, updated kitchen units) which often generate significant rent increases.`,
  },
  {
    icon: '👥', title: 'Tenant referencing: getting it right',
    body: `Thorough referencing significantly reduces your risk of rent arrears and property damage. A comprehensive reference should include: credit check; employment verification and income (rent should be ≤35% of gross income); previous landlord reference; and identity verification (right-to-rent check).

Use a regulated referencing service or a reputable letting agent. Be aware of equality legislation — you cannot discriminate based on protected characteristics.`,
  },
  {
    icon: '🛠️', title: 'Managing repairs and maintenance',
    body: `Prompt maintenance protects your asset and keeps tenants happy. Establish a routine inspection schedule (typically every 3–6 months) and respond to repair requests within 24 hours for emergencies, 5 working days for urgent issues.

Budget approximately 1% of the property's value per year for maintenance. For multiple properties, building relationships with reliable local contractors is essential. Keep records of all work carried out.`,
  },
  {
    icon: '📊', title: 'Understanding tax on rental income',
    body: `Rental income must be declared to HMRC. You can deduct allowable expenses including: letting agent fees; repairs and maintenance (not improvements); buildings and landlord insurance; mortgage interest (now limited to a 20% tax credit for most landlords); council tax and utilities while the property is void.

Consider the advantages of a limited company structure if you have multiple properties. The stamp duty surcharge of 3% applies to additional residential properties. Always consult a specialist property accountant.`,
  },
  {
    icon: '📝', title: 'Ending a tenancy: your options',
    body: `If you need the property back, you can serve a Section 21 notice (no-fault possession) giving at least 2 months' notice, provided the tenancy is correctly set up. If the tenant has breached the tenancy (e.g. rent arrears), you may serve a Section 8 notice citing specific grounds.

Possession proceedings through the courts can take 4–6 months if contested. Using a letting agent with a proven track record significantly reduces disputes and helps resolve issues before they escalate.`,
  },
]

export default function PublicLandlordAdvice() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D
  const [customArticles, setCustomArticles] = useState(null)

  useEffect(() => {
    if (!slug) return
    axios.get(`${API_BASE}/api/public/${slug}/blog?category=landlord_advice`)
      .then(r => { if (r.data.length > 0) setCustomArticles(r.data) })
      .catch(() => {})
  }, [slug])

  const articles = customArticles
    ? customArticles.map(p => ({ icon: '📄', title: p.title, body: p.excerpt || '', html: p.body }))
    : ARTICLES

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Landlord advice" subtitle="Expert guidance on letting your property legally, profitably and stress-free." page="landlord_advice" brand={brand} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {articles.map(a => (
          <article key={a.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{a.icon}</span>
              <h2 className="text-lg font-bold text-gray-900">{a.title}</h2>
            </div>
            {a.html
              ? <div className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: a.html }} />
              : <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{a.body}</div>
            }
          </article>
        ))}

        <div className="rounded-2xl text-white text-center py-10 px-6" style={bb(brand)}>
          <h2 className="text-xl font-bold mb-2">Ready to let your property?</h2>
          <p className="text-white/80 text-sm mb-5">Get a free, no-obligation rental valuation from our local experts.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <a href={`/site/${slug}/valuation`}
              className="bg-white font-semibold px-6 py-3 rounded-xl text-sm inline-block hover:bg-opacity-90 transition-colors shadow-sm"
              style={bt(brand)}>
              Free valuation
            </a>
            <a href={`/site/${slug}/landlords`}
              className="border border-white/30 text-white font-semibold px-6 py-3 rounded-xl text-sm inline-block hover:bg-white/10">
              Our landlord services
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
