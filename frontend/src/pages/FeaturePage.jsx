import { useParams, Link, Navigate } from 'react-router-dom'
import { getFeature, FEATURES } from '../data/featureContent'

// ── Mockup panels — styled UI previews per feature ───────────────────────��───

function MockupAI() {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 font-mono text-sm space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-gray-400 text-xs ml-2">AI Assistant</span>
      </div>
      {[
        { q: 'Which leases expire in the next 60 days?', a: '4 leases expire before 10 June: Flat 3 (12 May), 14 Argyle St (28 May), Unit 7 (3 Jun), Apartment 2B (10 Jun). Flat 3 is already on a rolling periodic.' },
        { q: 'Draft a Section 21 for Flat 3, 22 Oak Lane', a: 'Section 21 notice drafted for John Smith, Flat 3, 22 Oak Lane. Valid from today — requires 2 months notice. Deposit confirmed protected with DPS. Ready to download.' },
      ].map((ex, i) => (
        <div key={i} className="space-y-1">
          <div className="flex gap-2">
            <span className="text-indigo-400 shrink-0">You:</span>
            <span className="text-gray-200">{ex.q}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-emerald-400 shrink-0">AI:</span>
            <span className="text-gray-300 text-xs leading-relaxed">{ex.a}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 border border-gray-600 rounded-lg px-3 py-2 mt-2">
        <input className="bg-transparent text-gray-300 text-xs flex-1 outline-none" placeholder="Ask anything about your portfolio…" readOnly />
        <span className="text-indigo-400 text-xs">↵</span>
      </div>
    </div>
  )
}

function MockupDashboard({ rows }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-indigo-600 px-4 py-3 flex items-center gap-2">
        <span className="text-white font-bold text-sm">PropAIrty</span>
        <span className="text-indigo-300 text-xs ml-auto">Agent Dashboard</span>
      </div>
      <div className="p-4 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${r.highlight ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <span>{r.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                {r.sub && <p className="text-[10px] text-gray-500">{r.sub}</p>}
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.badge}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockupCompliance() {
  return (
    <MockupDashboard rows={[
      { icon: '🔥', label: 'Gas Safety — 14 Oak Lane', sub: 'Expired 3 days ago', value: 'EXPIRED', badge: 'bg-red-100 text-red-700', highlight: true },
      { icon: '⚡', label: 'EICR — Flat 3, Argyle St', sub: 'Expires in 18 days', value: '18 days', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '🌿', label: 'EPC — 7 Pine Close', sub: 'Valid until Mar 2027', value: 'Valid', badge: 'bg-green-100 text-green-700' },
      { icon: '🔒', label: 'Fire Risk — Mill Apartments', sub: 'Valid until Dec 2025', value: 'Valid', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupPayments() {
  return (
    <MockupDashboard rows={[
      { icon: '💷', label: 'J. Smith — Flat 3', sub: 'Overdue 12 days · £1,200 outstanding', value: '12 days', badge: 'bg-red-100 text-red-700', highlight: true },
      { icon: '💷', label: 'A. Patel — 14 Oak Lane', sub: 'Partial · £600 of £1,100 paid', value: 'Partial', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '💷', label: 'B. Johnson — Argyle St', sub: 'Paid on time', value: 'Paid', badge: 'bg-green-100 text-green-700' },
      { icon: '💷', label: 'C. Williams — Mill Apts', sub: 'Paid on time', value: 'Paid', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupMaintenance() {
  return (
    <MockupDashboard rows={[
      { icon: '🔧', label: 'Boiler not working — Flat 3', sub: 'Assigned: NE Gas Services · Urgent', value: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
      { icon: '💧', label: 'Leak under sink — 14 Oak Lane', sub: 'New · AI suggests: Plumber', value: 'New', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '🔌', label: 'No power in kitchen — Argyle', sub: 'Quote approved · Scheduled 15 May', value: 'Scheduled', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '🚪', label: 'Front door lock broken', sub: 'Complete · Invoice uploaded', value: 'Complete', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupDocuments() {
  return (
    <MockupDashboard rows={[
      { icon: '📄', label: 'AST Agreement — J. Smith', sub: 'Generated 3 Apr 2026 · Flat 3', value: 'PDF', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '⚖️', label: 'Section 21 — 14 Oak Lane', sub: 'Served 28 Mar 2026 · 2 months notice', value: 'PDF', badge: 'bg-red-100 text-red-700' },
      { icon: '💷', label: 'Rent Increase Letter — B. Johnson', sub: 'Section 13 · New rent £1,350 from June', value: 'PDF', badge: 'bg-amber-100 text-amber-700' },
      { icon: '🛡️', label: 'Deposit Receipt — C. Williams', sub: 'DPS registered · £2,400', value: 'PDF', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupWorkflows() {
  return (
    <MockupDashboard rows={[
      { icon: '💷', label: 'Rent overdue by 3 days → email tenant', sub: 'Active · Last triggered: today · 2 emails sent', value: 'ON', badge: 'bg-green-100 text-green-700' },
      { icon: '🏠', label: 'Lease expiring in 60 days → alert agent', sub: 'Active · 3 leases matched this week', value: 'ON', badge: 'bg-green-100 text-green-700' },
      { icon: '🔧', label: 'Maintenance job not updated in 7 days', sub: 'Active · 1 stalled job flagged', value: 'ON', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '📋', label: 'Compliance expiring in 30 days → Telegram', sub: 'Paused', value: 'OFF', badge: 'bg-gray-100 text-gray-500' },
    ]} />
  )
}

function MockupESigning() {
  return (
    <MockupDashboard rows={[
      { icon: '📄', label: 'AST Agreement — J. Smith', sub: 'Sent 2 Apr · Opened · Awaiting signature', value: 'Pending', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '📄', label: 'Renewal Offer — A. Patel', sub: 'Signed 1 Apr · Stored against tenancy', value: 'Signed', badge: 'bg-green-100 text-green-700' },
      { icon: '📄', label: 'Section 21 — B. Johnson', sub: 'Declined 28 Mar · Agent follow-up required', value: 'Declined', badge: 'bg-red-100 text-red-700', highlight: true },
      { icon: '📄', label: 'Deposit Receipt — C. Williams', sub: 'Signed 15 Mar · DPS confirmed', value: 'Signed', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupAuditTrail() {
  return (
    <MockupDashboard rows={[
      { icon: '🔧', label: 'Maintenance job #142 marked complete', sub: 'Sarah M. · 17 Apr 2026 14:32', value: 'Update', badge: 'bg-blue-100 text-blue-700' },
      { icon: '💷', label: 'Payment recorded — J. Smith £1,200', sub: 'Admin · 17 Apr 2026 09:15', value: 'Create', badge: 'bg-green-100 text-green-700' },
      { icon: '👤', label: 'Tenant profile edited — A. Patel', sub: 'Tom K. · 16 Apr 2026 17:44', value: 'Update', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '🗑️', label: 'Compliance cert deleted — Gas Safety', sub: 'Sarah M. · 16 Apr 2026 11:02', value: 'Delete', badge: 'bg-red-100 text-red-700', highlight: true },
    ]} />
  )
}

function MockupRightToRent() {
  return (
    <MockupDashboard rows={[
      { icon: '🛂', label: 'A. Mensah — BRP expires 14 May 2026', sub: 'Re-check due in 27 days', value: '27 days', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '🛂', label: 'K. Nowak — Passport valid', sub: 'EU settled status · No expiry', value: 'Valid', badge: 'bg-green-100 text-green-700' },
      { icon: '🛂', label: 'J. Smith — British passport', sub: 'Checked 1 Jan 2026', value: 'Valid', badge: 'bg-green-100 text-green-700' },
      { icon: '🛂', label: 'T. Osei — Visa expired 2 Apr 2026', sub: 'Re-check overdue · Urgent', value: 'EXPIRED', badge: 'bg-red-100 text-red-700', highlight: true },
    ]} />
  )
}

function MockupAccounting() {
  return (
    <MockupDashboard rows={[
      { icon: '💷', label: 'Gross rent — Apr 2026', sub: '12 properties · 18 units', value: '£21,400', badge: 'bg-green-100 text-green-700' },
      { icon: '🔧', label: 'Maintenance costs — Apr 2026', sub: '6 completed jobs', value: '−£1,840', badge: 'bg-red-100 text-red-700' },
      { icon: '📊', label: 'Net income — Apr 2026', sub: 'After maintenance · Before agency fee', value: '£19,560', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '📄', label: 'Export ready', sub: 'PDF and CSV · Apr 2026', value: 'Download', badge: 'bg-gray-100 text-gray-700' },
    ]} />
  )
}

function MockupMTD() {
  return (
    <MockupDashboard rows={[
      { icon: '🏛️', label: 'HMRC Connection', sub: 'Government Gateway · OAuth connected', value: '✓ Live', badge: 'bg-green-100 text-green-700' },
      { icon: '📅', label: 'Q1 2026/27 — Apr–Jun 2026', sub: 'Income £21,400 · Expenses £1,840', value: 'Submitted', badge: 'bg-green-100 text-green-700' },
      { icon: '📅', label: 'Q2 2026/27 — Jul–Sep 2026', sub: 'Income £22,100 · Expenses £2,150', value: 'Preview', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '📅', label: 'Q3 2026/27 — Oct–Dec 2026', sub: 'Not yet due', value: 'Upcoming', badge: 'bg-gray-100 text-gray-500' },
    ]} />
  )
}

function MockupMeterReadings() {
  return (
    <MockupDashboard rows={[
      { icon: '⚡', label: 'Electricity — Flat 3, 22 Oak Lane', sub: 'Submitted 28 Apr 2026 · James Smith', value: '4,821 kWh', badge: 'bg-yellow-100 text-yellow-700' },
      { icon: '🔥', label: 'Gas — Flat 3, 22 Oak Lane', sub: 'Submitted 28 Apr 2026 · James Smith', value: '1,203 m³', badge: 'bg-orange-100 text-orange-700' },
      { icon: '💧', label: 'Water — 14 Birchwood Close', sub: 'Submitted 25 Apr 2026 · Priya Patel', value: '312 m³', badge: 'bg-blue-100 text-blue-700' },
      { icon: '⚡', label: 'Electricity — 14 Birchwood Close', sub: 'Submitted 25 Apr 2026 · Priya Patel', value: '3,107 kWh', badge: 'bg-yellow-100 text-yellow-700' },
    ]} />
  )
}

function MockupAdvancePayments() {
  return (
    <MockupDashboard rows={[
      { icon: '💳', label: 'Advance received — James Smith', sub: 'Flat 3, 22 Oak Lane · 1 Apr 2026', value: '£3,600', badge: 'bg-green-100 text-green-700' },
      { icon: '✓', label: 'Apr 2026 — Allocated', sub: 'Part of £3,600 advance received 1 Apr 2026', value: '£1,200', badge: 'bg-green-100 text-green-700' },
      { icon: '✓', label: 'May 2026 — Allocated', sub: 'Part of £3,600 advance received 1 Apr 2026', value: '£1,200', badge: 'bg-green-100 text-green-700' },
      { icon: '✓', label: 'Jun 2026 — Allocated', sub: 'Part of £3,600 advance received 1 Apr 2026', value: '£1,200', badge: 'bg-green-100 text-green-700' },
    ]} />
  )
}

function MockupTenantPortal() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-indigo-600 px-4 py-3 flex items-center gap-2">
        <span className="text-white font-bold text-sm">Tenant Portal</span>
        <span className="text-indigo-300 text-xs ml-auto">James Smith · Flat 3, 22 Oak Lane</span>
      </div>
      <div className="p-4 space-y-2">
        {[
          { icon: '🏠', label: 'My Property', sub: 'Flat 3, 22 Oak Lane · EPC: C', value: 'View', badge: 'bg-indigo-100 text-indigo-700' },
          { icon: '💷', label: 'Rent — May due in 14 days', sub: '£1,200 · Last paid 1 Apr on time', value: 'Up to date', badge: 'bg-green-100 text-green-700' },
          { icon: '🔧', label: 'Maintenance — Boiler issue', sub: 'Reported 15 Apr · In Progress', value: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
          { icon: '🔄', label: 'Renewal offer received', sub: 'New rent £1,250 · Lease to Oct 2027', value: 'Review', badge: 'bg-amber-100 text-amber-700', highlight: true },
        ].map((r, i) => (
          <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${r.highlight ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <span>{r.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                <p className="text-[10px] text-gray-500">{r.sub}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.badge}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockupLandlordPortal() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
        <span className="text-white font-bold text-sm">Landlord Portal</span>
        <span className="text-emerald-200 text-xs ml-auto">David Chen · 3 properties</span>
      </div>
      <div className="p-4 space-y-2">
        {[
          { icon: '💷', label: 'Rent collected — Apr 2026', sub: '£4,700 of £4,950 · 95%', value: '95%', badge: 'bg-green-100 text-green-700' },
          { icon: '⚠️', label: 'Arrears — Flat 3', sub: '£250 outstanding · 12 days overdue', value: '£250', badge: 'bg-red-100 text-red-700', highlight: true },
          { icon: '📊', label: 'Portfolio yield (CFO)', sub: 'Avg 5.8% · 1 property flagged Watch', value: '5.8%', badge: 'bg-indigo-100 text-indigo-700' },
          { icon: '📄', label: 'April statement ready', sub: 'Auto-generated · PDF download', value: 'Download', badge: 'bg-gray-100 text-gray-700' },
        ].map((r, i) => (
          <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${r.highlight ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <span>{r.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                <p className="text-[10px] text-gray-500">{r.sub}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.badge}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockupContractorPortal() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-orange-500 px-4 py-3 flex items-center gap-2">
        <span className="text-white font-bold text-sm">Contractor Portal</span>
        <span className="text-orange-100 text-xs ml-auto">NE Gas Services · 3 active jobs</span>
      </div>
      <div className="p-4 space-y-2">
        {[
          { icon: '🔧', label: 'Boiler not working — Flat 3, Oak Lane', sub: 'Urgent · Assigned 15 Apr', value: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
          { icon: '💧', label: 'Leak under sink — 14 Maple St', sub: 'Standard · Awaiting acceptance', value: 'New', badge: 'bg-amber-100 text-amber-700', highlight: true },
          { icon: '✅', label: 'Annual boiler service — Mill Apts', sub: 'Completed 10 Apr · Photos uploaded', value: 'Complete', badge: 'bg-green-100 text-green-700' },
          { icon: '💬', label: 'Message from Tyne Lettings', sub: '14 Apr · "Can you attend tomorrow?"', value: 'Reply', badge: 'bg-indigo-100 text-indigo-700' },
        ].map((r, i) => (
          <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${r.highlight ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <span>{r.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                <p className="text-[10px] text-gray-500">{r.sub}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.badge}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockupAIInsights() {
  return (
    <MockupDashboard rows={[
      { icon: '💷', label: 'Rent optimisation — 3 units under market', sub: 'Flat 3 (£150/mo below), 14 Oak (£80), Unit 7 (£60)', value: 'Act now', badge: 'bg-amber-100 text-amber-700', highlight: true },
      { icon: '🔄', label: 'Churn risk — 2 tenants likely to leave', sub: 'A. Patel (high), J. Smith (medium) · Renewals in 90 days', value: '2 flagged', badge: 'bg-red-100 text-red-700', highlight: true },
      { icon: '📊', label: 'Portfolio health score', sub: 'Arrears, compliance, maintenance, renewals', value: '78/100', badge: 'bg-green-100 text-green-700' },
      { icon: '📧', label: 'Email triage — 1 new email', sub: '"Boiler still not fixed" → Maintenance · High priority', value: 'Triaged', badge: 'bg-indigo-100 text-indigo-700' },
    ]} />
  )
}

function MockupFiles() {
  return (
    <MockupDashboard rows={[
      { icon: '🏠', label: 'Flat 3, 22 Oak Lane', sub: '4 files · AST, Gas Safety, EPC, Deposit Receipt', value: 'View', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '👤', label: 'J. Smith — Tenant', sub: '3 files · Right to Rent, ID, Referencing report', value: 'View', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '🏦', label: 'D. Chen — Landlord', sub: '2 files · Management agreement, Insurance cert', value: 'View', badge: 'bg-indigo-100 text-indigo-700' },
      { icon: '🔧', label: 'NE Gas Services — Contractor', sub: '1 file · Gas Safe certificate', value: 'View', badge: 'bg-indigo-100 text-indigo-700' },
    ]} />
  )
}

function MockupSurveys() {
  return (
    <MockupDashboard rows={[
      { icon: '⭐', label: 'Boiler repair — Flat 3 · J. Smith', sub: '"Fixed quickly, very happy" · 17 Apr', value: '5/5', badge: 'bg-green-100 text-green-700' },
      { icon: '⭐', label: 'Leak repair — 14 Oak Lane · A. Patel', sub: '"Took 3 visits to fix" · 14 Apr', value: '2/5', badge: 'bg-red-100 text-red-700', highlight: true },
      { icon: '⭐', label: 'Lock replacement — Mill Apts · B. Jones', sub: '"Polite and on time" · 10 Apr', value: '4/5', badge: 'bg-green-100 text-green-700' },
      { icon: '⭐', label: 'Electrical fault — Argyle St · C. Williams', sub: '"No update for 5 days" · 8 Apr', value: '1/5', badge: 'bg-red-100 text-red-700', highlight: true },
    ]} />
  )
}

function MockupGeneric({ label }) {
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
      <div className="text-5xl mb-4">🖥️</div>
      <p className="text-gray-400 text-sm">Live {label} view — book a demo to see it in action</p>
      <a href="/#book-demo" className="inline-block mt-4 bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
        Book a demo
      </a>
    </div>
  )
}

const MOCKUPS = {
  ai:                MockupAI,
  compliance:        MockupCompliance,
  payments:          MockupPayments,
  maintenance:       MockupMaintenance,
  documents:         MockupDocuments,
  workflows:         MockupWorkflows,
  'e-signing':       MockupESigning,
  'audit-trail':     MockupAuditTrail,
  'right-to-rent':   MockupRightToRent,
  accounting:        MockupAccounting,
  'tenant-portal':   MockupTenantPortal,
  'landlord-portal': MockupLandlordPortal,
  'contractor-portal': MockupContractorPortal,
  'ai-insights':     MockupAIInsights,
  files:             MockupFiles,
  surveys:           MockupSurveys,
  mtd:               MockupMTD,
  'meter-readings':  MockupMeterReadings,
  'advance-payments': MockupAdvancePayments,
}

// ─────────────────────────────────────────────────────────────────────────────

export default function FeaturePage() {
  const { slug } = useParams()
  const feature = getFeature(slug)

  if (!feature) return <Navigate to="/" replace />

  const MockupComponent = MOCKUPS[feature.mockup]

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="font-bold text-indigo-600 text-xl">
          Prop<span className="text-gray-900">AI</span>rty
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">← All features</Link>
          <a href="/#book-demo" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Book a demo
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="text-6xl mb-5">{feature.icon}</div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">{feature.title}</h1>
        <p className="text-xl text-indigo-600 font-semibold mb-5">{feature.tagline}</p>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">{feature.description}</p>
        <p className="text-xs text-gray-400 mt-4 uppercase tracking-widest font-semibold">{feature.portal}</p>
      </section>

      {/* Mockup */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        {MockupComponent ? <MockupComponent /> : <MockupGeneric label={feature.title} />}
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {feature.howItWorks.map((s, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-sm font-bold mb-3">{s.step}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key capabilities */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What's included</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {feature.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
              <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
              <span className="text-sm text-gray-700 leading-relaxed">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Other features */}
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Explore other features</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {FEATURES.filter(f => f.slug !== slug).map(f => (
              <Link key={f.slug} to={`/features/${f.slug}`}
                className="bg-white border border-gray-200 rounded-xl p-3 text-center hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="text-2xl mb-1">{f.icon}</div>
                <p className="text-xs font-semibold text-gray-700 leading-tight">{f.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">See {feature.title} live</h2>
        <p className="text-gray-500 mb-8">Book a demo and we'll walk you through this feature on a real portfolio.</p>
        <a href="/#book-demo"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-indigo-100">
          Book a demo
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <Link to="/" className="text-indigo-600 font-semibold">PropAIrty</Link> · AI-powered property management for UK letting agents
        <span className="mx-2">·</span>
        <a href="mailto:info@genaixa.co.uk" className="hover:text-gray-600">info@genaixa.co.uk</a>
      </footer>
    </div>
  )
}
