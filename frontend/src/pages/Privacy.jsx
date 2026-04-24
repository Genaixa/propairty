import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-indigo-600">Prop<span className="text-gray-900">AI</span>rty</Link>
        <Link to="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-gray">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who we are</h2>
            <p>PropAIrty is a property management platform operated by Genaixa Ltd ("we", "us", "our"). We are registered in England and Wales. Our platform is used by letting agents, landlords, tenants and contractors to manage residential property.</p>
            <p className="mt-2">For data protection purposes, Genaixa Ltd is the Data Controller. Contact us at: <a href="mailto:privacy@propairty.co.uk" className="text-indigo-600 hover:underline">privacy@propairty.co.uk</a></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. What data we collect</h2>
            <p><strong>Letting agents:</strong> Name, email address, organisation name, login credentials.</p>
            <p className="mt-1"><strong>Landlords:</strong> Name, email address, phone number, property portfolio details.</p>
            <p className="mt-1"><strong>Tenants:</strong> Name, email address, phone number, WhatsApp number, date of birth, tenancy details, payment history, maintenance requests, documents.</p>
            <p className="mt-1"><strong>Contractors:</strong> Name, company name, trade, email address, phone number, job history.</p>
            <p className="mt-1"><strong>All users:</strong> Login activity, IP addresses (for security rate limiting), browser type.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How we use your data</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide and operate the PropAIrty platform</li>
              <li>To send rent reminders, receipts and maintenance updates (tenants)</li>
              <li>To generate tenancy documents, notices and financial reports</li>
              <li>To process online rent payments via Stripe</li>
              <li>To send automated alerts to letting agents via Telegram</li>
              <li>To comply with our legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Legal basis for processing</h2>
            <p><strong>Contract:</strong> Processing necessary to perform the service you have signed up for.</p>
            <p className="mt-1"><strong>Legitimate interests:</strong> Security monitoring, fraud prevention, service improvement.</p>
            <p className="mt-1"><strong>Legal obligation:</strong> Where required by UK law (e.g. tenancy deposit regulations, HMRC requirements).</p>
            <p className="mt-1"><strong>Consent:</strong> Where we ask for your consent (e.g. WhatsApp communications).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Who we share data with</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Stripe</strong> — payment processing. <a href="https://stripe.com/gb/privacy" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
              <li><strong>Twilio</strong> — WhatsApp and SMS communications</li>
              <li><strong>Cloudflare</strong> — DNS, CDN and backup storage (R2)</li>
              <li><strong>Anthropic</strong> — AI-powered features (Claude API). Data is not used to train models.</li>
              <li><strong>Your letting agent</strong> — tenants' data is accessible to the letting agency managing their tenancy</li>
            </ul>
            <p className="mt-2">We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data retention</h2>
            <p>We retain personal data for as long as your account is active or as required by law. Tenancy records are retained for 6 years after a tenancy ends (UK legal requirement for financial records). You may request deletion of your account and associated data at any time (see Section 8).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data storage and security</h2>
            <p>Data is stored on servers located in the European Economic Area. Database backups are encrypted and stored in Cloudflare R2 (Western Europe region). We use industry-standard security measures including TLS encryption in transit, hashed passwords, and rate-limited authentication.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Your rights</h2>
            <p>Under UK GDPR you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><strong>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong>Rectification</strong> — ask us to correct inaccurate data</li>
              <li><strong>Erasure</strong> — ask us to delete your data ("right to be forgotten")</li>
              <li><strong>Restriction</strong> — ask us to restrict processing of your data</li>
              <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
              <li><strong>Object</strong> — object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email <a href="mailto:privacy@propairty.co.uk" className="text-indigo-600 hover:underline">privacy@propairty.co.uk</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Cookies</h2>
            <p>We use only essential cookies required to keep you logged in (JWT tokens stored in localStorage). We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Complaints</h2>
            <p>If you are unhappy with how we handle your data, you have the right to complain to the Information Commissioner's Office (ICO): <a href="https://ico.org.uk" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a> or call 0303 123 1113.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Changes to this policy</h2>
            <p>We may update this policy from time to time. We will notify registered users of material changes by email. The current version is always available at propairty.co.uk/privacy.</p>
          </section>

        </div>
      </div>
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
        <Link to="/terms" className="hover:underline mr-4">Terms of Service</Link>
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        <span className="mx-4">·</span>
        © 2026 Genaixa Ltd
      </footer>
    </div>
  )
}
