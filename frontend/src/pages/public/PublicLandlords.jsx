import { useParams } from 'react-router-dom'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const D = '#4f46e5'

const IcoHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
)
const IcoSearch = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)
const IcoCash = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
)
const IcoWrench = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
)
const IcoShield = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)
const IcoChart = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)

const SERVICES = [
  { Icon: IcoHome,   title: 'Full management',     desc: 'End-to-end management covering tenant sourcing, rent collection, maintenance coordination and full legal compliance. We handle every aspect of your tenancy.' },
  { Icon: IcoSearch, title: 'Let only',             desc: 'We market your property on the major portals, conduct thorough referencing and provide you with a fully vetted tenant ready to move in.' },
  { Icon: IcoCash,   title: 'Rent collection',      desc: 'We collect rent each month, chase arrears promptly and transfer funds directly to your account with a detailed statement every time.' },
  { Icon: IcoWrench, title: 'Maintenance',           desc: 'Access to our vetted contractor network for prompt repairs and routine works. Every job is logged, quoted and confirmed before work begins.' },
  { Icon: IcoShield, title: 'Legal compliance',      desc: 'Gas safety, EPC, electrical certificates, right-to-rent checks, deposit registration — we track every deadline so your portfolio stays compliant.' },
  { Icon: IcoChart,  title: 'Financial reporting',   desc: 'Clear monthly statements and a year-end summary with all the detail your accountant needs. Available any time through your landlord portal.' },
]

const STEPS = [
  { n: '1', title: 'Free valuation', desc: 'We visit your property and provide a realistic market rent appraisal with no obligation.' },
  { n: '2', title: 'Marketing', desc: 'Professional photography, Rightmove & Zoopla listings, plus our own website to maximise exposure.' },
  { n: '3', title: 'Tenant referencing', desc: 'Comprehensive credit, employment and landlord reference checks on every applicant.' },
  { n: '4', title: 'Move-in', desc: 'Tenancy agreements, deposit registration, inventory and key handover all handled by us.' },
  { n: '5', title: 'Ongoing management', desc: 'Regular inspections, rent collection and 24/7 maintenance reporting throughout the tenancy.' },
]

export default function PublicLandlords() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Landlord services" subtitle="Professional property management that protects your investment and maximises your rental income." page="landlords" brand={brand}>
        <a href={`/site/${slug}/valuation`}
          className="mt-6 bg-white font-bold px-8 py-3 rounded-xl text-sm inline-block shadow-lg hover:bg-opacity-90 transition-colors"
          style={bt(brand)}>
          Get a free rental valuation →
        </a>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 space-y-16">

        {/* Services */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your property needs</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-sm">From a single let to a large portfolio — we have a service level to suit every landlord.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map(s => (
              <div key={s.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white" style={bb(brand)}>
                  <s.Icon />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-gray-50 rounded-3xl p-8 sm:p-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How it works</h2>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 hidden sm:block" />
            <div className="space-y-8">
              {STEPS.map(s => (
                <div key={s.n} className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0 z-10" style={bb(brand)}>
                    {s.n}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why us */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why choose {org?.name}?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { title: 'Proactive communication', body: 'Your dedicated property manager keeps you informed at every stage — listing, maintenance, renewals. No chasing required.' },
              { title: 'Vetted contractor network', body: 'Every maintenance job is handled by our approved contractors. Each job is quoted, logged and confirmed before work starts.' },
              { title: 'Full legal compliance', body: 'We track all certificate renewals, inspection deadlines and statutory requirements so your portfolio stays compliant.' },
            ].map(s => (
              <div key={s.title} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          {org?.founded_year && (
            <p className="text-center text-sm text-gray-400 mt-6">Serving landlords since {org.founded_year}.</p>
          )}
        </section>

        {/* CTA */}
        <section className="rounded-3xl text-white text-center py-14 px-6" style={bb(brand)}>
          <h2 className="text-3xl font-bold mb-3">Ready to let your property?</h2>
          <p className="text-white/80 mb-8 max-w-md mx-auto">Book a free, no-obligation rental valuation and find out how much your property could earn.</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a href={`/site/${slug}/valuation`}
              className="bg-white font-bold px-8 py-3.5 rounded-xl text-sm inline-block hover:bg-opacity-90 transition-colors shadow-md"
              style={bt(brand)}>
              Free valuation
            </a>
            <a href={`/site/${slug}/contact`}
              className="border border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl text-sm inline-block hover:bg-white/10">
              Contact us
            </a>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}
