import { Link } from 'react-router-dom'

const DEMOS = [
  {
    id: 'applicant-to-tenant',
    title: 'Applicant to Tenant',
    duration: '90 sec',
    description: 'From first enquiry to signed tenancy — the full applicant pipeline, referencing, conversion, and document generation.',
    bullets: ['Applicant pipeline & kanban view', 'One-click stage advances', 'Convert to tenancy modal', 'AST & deposit receipt generated instantly'],
    videoSrc: '/uploads/Propairty_Explainer_Video_Script_Video.mp4',
    script: [
      { time: '0:00–0:08', label: 'Hook', voiceover: 'From first enquiry to signed tenancy — here\'s how Propairty handles the entire journey in one place.' },
      { time: '0:08–0:25', label: 'Applicant pipeline', voiceover: 'When a new enquiry comes in, it lands here — in your applicant pipeline. You can see every lead at a glance, organised by stage: Enquiry, Viewing Booked, Viewed, Referencing, and Approved. Each card shows the applicant\'s name, the property they\'re interested in, their budget, and their next follow-up date. Moving them forward is one click.' },
      { time: '0:25–0:40', label: 'Referencing & approval', voiceover: 'Once referencing comes back clear, you mark them approved — and the pipeline card turns green. Now you\'re ready to convert them to a tenant.' },
      { time: '0:40–1:05', label: 'Convert to Tenancy', voiceover: 'Hit \'Create Tenancy\' — enter the monthly rent, deposit amount, tenancy type, and start date. Propairty creates the tenancy record, links it to the property and landlord, and logs the deposit automatically.' },
      { time: '1:05–1:25', label: 'Documents generated', voiceover: 'Straight away, you can generate the Assured Shorthold Tenancy agreement and the Deposit Receipt — both pre-filled with the tenant\'s details, the property address, rent, and your agency\'s branding. One click. Ready to send.' },
      { time: '1:25–1:30', label: 'Close', voiceover: 'Enquiry to signed tenancy. No spreadsheets. No chasing. Just Propairty.' },
    ],
  },
  {
    id: 'maintenance-end-to-end',
    title: 'Maintenance End-to-End',
    duration: '90 sec',
    description: 'A tenant raises a repair — watch it travel from report to contractor dispatch to resolution without a single phone call.',
    bullets: ['Tenant raises job via portal', 'Auto-dispatch to contractor', 'Job tracked through to completion', 'Invoice logged automatically'],
    videoSrc: null,
    script: [],
  },
  {
    id: 'compliance-autopilot',
    title: 'Compliance Autopilot',
    duration: '60 sec',
    description: 'Gas certs, EPCs, EICRs — never miss a renewal. See how Propairty tracks every certificate and fires alerts before they expire.',
    bullets: ['Certificate expiry tracking', 'Automated alerts', 'Action logged against property', 'Full compliance audit trail'],
    videoSrc: null,
    script: [],
  },
  {
    id: 'renewal-flow',
    title: 'Renewal Flow',
    duration: '60 sec',
    description: 'Lease coming up? Send a renewal offer, get landlord approval, and have it signed — all without leaving Propairty.',
    bullets: ['Renewal offer generated', 'Landlord approves via portal', 'Tenant accepts digitally', 'New lease term recorded'],
    videoSrc: null,
    script: [],
  },
  {
    id: 'meet-mendy',
    title: 'Meet Mendy — Your AI Assistant',
    duration: '60 sec',
    description: 'Ask Mendy anything about your portfolio. Arrears, compliance gaps, maintenance status — answered in seconds.',
    bullets: ['Natural language queries', 'Portfolio-wide answers', 'Compliance & arrears summaries', 'Instant, accurate, no digging'],
    videoSrc: null,
    script: [],
  },
  {
    id: 'landlord-portal',
    title: 'The Landlord Portal',
    duration: '60 sec',
    description: 'What your landlords see when they log in — financials, maintenance, compliance, documents, and messages. All self-serve.',
    bullets: ['P&L and rent statements', 'Live maintenance updates', 'Compliance certificate status', 'Direct messaging with agency'],
    videoSrc: null,
    script: [],
  },
  {
    id: 'tenant-portal',
    title: 'The Tenant Portal',
    duration: '60 sec',
    description: 'What your tenants see — lease, payments, maintenance reporting, documents, notices, and AI chat support.',
    bullets: ['Rent & payment history', 'Raise maintenance jobs', 'View legal notices & documents', 'AI chat for common questions'],
    videoSrc: null,
    script: [],
  },
]

function ScriptBlock({ steps }) {
  if (!steps.length) return null
  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Video script</p>
      <div className="space-y-4">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4">
            <div className="text-xs text-indigo-400 font-mono whitespace-nowrap pt-0.5 w-24 shrink-0">{s.time}</div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">{s.label}</p>
              <p className="text-sm text-gray-500 leading-relaxed italic">"{s.voiceover}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Demos() {
  const ready = DEMOS.filter(d => d.videoSrc)
  const coming = DEMOS.filter(d => !d.videoSrc)

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-700/60 px-6 py-4 sticky top-0 bg-slate-900/95 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
            Prop<span className="text-white">AI</span>rty
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-slate-400 hover:text-white font-medium transition-colors hidden sm:block">Home</Link>
            <Link to="/login" className="border border-slate-600 hover:border-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Try it live
            </Link>
            <a href="/#book-demo" className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Book a demo
            </a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="bg-slate-900 py-20 px-6 text-center">
        <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-3">Product demos</p>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-5 leading-tight" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>
          See Propairty work.
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Short, specific walkthroughs of every workflow. Pick the one that matters most to your agency.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Ready videos */}
        {ready.length > 0 && (
          <div className="mb-16">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Watch now</h2>
            <div className="space-y-12">
              {ready.map(demo => (
                <div key={demo.id} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <video controls preload="metadata" className="w-full aspect-video bg-slate-900">
                    <source src={demo.videoSrc} type="video/mp4" />
                  </video>
                  <div className="p-8">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-2xl font-bold text-gray-900" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>{demo.title}</h3>
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full whitespace-nowrap">{demo.duration}</span>
                    </div>
                    <p className="text-gray-500 mb-5">{demo.description}</p>
                    <ul className="grid grid-cols-2 gap-2">
                      {demo.bullets.map((b, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <ScriptBlock steps={demo.script} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coming soon */}
        {coming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Coming soon</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {coming.map(demo => (
                <div key={demo.id} className="rounded-2xl border border-gray-100 p-6 bg-gray-50">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-lg font-bold text-gray-900">{demo.title}</h3>
                    <span className="text-xs font-semibold text-gray-400 bg-white border border-gray-200 px-3 py-1 rounded-full whitespace-nowrap">{demo.duration}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{demo.description}</p>
                  <ul className="space-y-1.5">
                    {demo.bullets.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-20 text-center bg-indigo-50 rounded-2xl px-8 py-12">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3" style={{fontFamily:"'Playfair Display', Georgia, serif"}}>Ready to see it live?</h2>
          <p className="text-gray-500 mb-6">Book a 30-minute walkthrough with your own data.</p>
          <a href="/#book-demo" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg">
            Book a demo
          </a>
        </div>
      </div>
    </div>
  )
}
