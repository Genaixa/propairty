import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''

const D = '#4f46e5'

const ARTICLES = [
  {
    icon: '🔍', title: 'How to search for a rental property',
    body: `Start by defining your budget — a common rule of thumb is that rent should be no more than 35% of your take-home pay. Consider the costs beyond rent: council tax, utilities, broadband, and contents insurance can add £200–400/month.

Narrow your search to areas with good transport links to work and amenities you use regularly. Register with local letting agents and set up saved searches on property portals so you hear about new listings immediately.`,
  },
  {
    icon: '📋', title: 'Understanding your tenancy agreement',
    body: `An Assured Shorthold Tenancy (AST) is the most common type in England and Wales. Read it carefully before signing — pay attention to the break clause, notice periods, permitted alterations, and pet policy.

Your landlord must provide you with: a current gas safety certificate, the EPC, a copy of the How to Rent guide, and details of which deposit scheme is protecting your funds. Keep copies of all documents.`,
  },
  {
    icon: '💷', title: 'Deposits: what you need to know',
    body: `Your landlord can charge a maximum of 5 weeks' rent as a deposit (6 weeks if your annual rent exceeds £50,000). They must protect it in a government-approved scheme within 30 days and provide you with the scheme's details.

At the end of your tenancy, your landlord has 10 days to return your deposit or provide written reasons for deductions. Document the property's condition with photos at move-in and move-out.`,
  },
  {
    icon: '🛠️', title: 'Maintenance: your rights and responsibilities',
    body: `Your landlord is responsible for maintaining the structure and exterior, heating and hot water, electrical wiring, and appliances they provided. You are responsible for minor tasks like changing lightbulbs and keeping the property clean.

Report maintenance issues in writing (email is fine) so you have a record. In an emergency, contact your landlord or letting agent immediately. If repairs aren't made, you have legal options including contacting the local council.`,
  },
  {
    icon: '📅', title: 'Renewing or ending your tenancy',
    body: `If you want to stay, negotiate a renewal before your fixed term ends. Your landlord must give you at least 2 months' notice using a Section 21 form, or 2 weeks' notice if they have grounds under Section 8.

If you want to leave, check your notice period in the tenancy agreement — typically one month. Always give notice in writing. Clean the property thoroughly and return all keys on the last day to maximise your deposit return.`,
  },
  {
    icon: '⚖️', title: 'Your rights as a tenant',
    body: `You have the right to: live in the property undisturbed; have it maintained in a good state of repair; know who your landlord is; challenge unfair rent increases; and have a deposit returned promptly at the end of a tenancy.

Your landlord must give at least 24 hours' notice before entering the property except in an emergency. Harassment or illegal eviction is a criminal offence. If you have concerns, contact Shelter, Citizens Advice, or your local council.`,
  },
]

export default function PublicTenantAdvice() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D
  const [customArticles, setCustomArticles] = useState(null)

  useEffect(() => {
    if (!slug) return
    axios.get(`${API_BASE}/api/public/${slug}/blog?category=tenant_advice`)
      .then(r => { if (r.data.length > 0) setCustomArticles(r.data) })
      .catch(() => {})
  }, [slug])

  const articles = customArticles
    ? customArticles.map(p => ({ icon: '📄', title: p.title, body: p.excerpt || '', html: p.body }))
    : ARTICLES

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Tenant advice" subtitle="Everything you need to know about renting — from your first search to moving out." page="tenant_advice" brand={brand} />

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
          <h2 className="text-xl font-bold mb-2">Looking for a property?</h2>
          <p className="text-white/80 text-sm mb-5">Browse our current available lets.</p>
          <a href={`/site/${slug}`}
            className="bg-white font-semibold px-6 py-3 rounded-xl text-sm inline-block hover:bg-opacity-90 transition-colors shadow-sm"
            style={bt(brand)}>
            View properties
          </a>
        </div>
      </div>
    </PublicLayout>
  )
}
