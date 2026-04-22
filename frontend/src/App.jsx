import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { isLoggedIn } from './lib/auth'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import PropertyDetail from './pages/PropertyDetail'
import UnitDetail from './pages/UnitDetail'
import Tenants from './pages/Tenants'
import TenantDetail from './pages/TenantDetail'
import TenantMessages from './pages/TenantMessages'
import MeterReadings from './pages/MeterReadings'
import LandlordMessages from './pages/LandlordMessages'
import Leases from './pages/Leases'
import Maintenance from './pages/Maintenance'
import Payments from './pages/Payments'
import Compliance from './pages/Compliance'
import Alerts from './pages/Alerts'
import Documents from './pages/Documents'
import News from './pages/News'
import Settings from './pages/Settings'
import Contractors from './pages/Contractors'
import ContractorDetail from './pages/ContractorDetail'
import Landlords from './pages/Landlords'
import LandlordDetail from './pages/LandlordDetail'
import Inspections from './pages/Inspections'
import RentRisk from './pages/RentRisk'
import Renewals from './pages/Renewals'
import Files from './pages/Files'
import Analytics from './pages/Analytics'
import CFO from './pages/CFO'
import Dispatch from './pages/Dispatch'
import Deposits from './pages/Deposits'
import Accounting from './pages/Accounting'
import Applicants from './pages/Applicants'
import Notices from './pages/Notices'
import Inventory from './pages/Inventory'
import Valuation from './pages/Valuation'
import PPM from './pages/PPM'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import InviteAccept from './pages/InviteAccept'
import PortalPicker from './pages/PortalPicker'
import ContractorLogin from './pages/contractor/ContractorLogin'
import ContractorPortal from './pages/contractor/ContractorPortal'
import LandlordLogin from './pages/landlord/LandlordLogin'
import LandlordPortal from './pages/landlord/LandlordPortal'
import TenantLogin from './pages/tenant/TenantLogin'
import TenantPortal from './pages/tenant/TenantPortal'
import FeaturePage from './pages/FeaturePage'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Sign from './pages/Sign'
import PublicSite from './pages/PublicSite'
import PublicAbout from './pages/public/PublicAbout'
import PublicContact from './pages/public/PublicContact'
import PublicLandlords from './pages/public/PublicLandlords'
import PublicAreas from './pages/public/PublicAreas'
import PublicTenantAdvice from './pages/public/PublicTenantAdvice'
import PublicLandlordAdvice from './pages/public/PublicLandlordAdvice'
import PublicReviews from './pages/public/PublicReviews'
import PublicBlog from './pages/public/PublicBlog'
import PublicBlogPost from './pages/public/PublicBlogPost'
import PublicTerms from './pages/public/PublicTerms'
import PublicPrivacy from './pages/public/PublicPrivacy'
import PublicValuation from './pages/public/PublicValuation'
import PublicSitemap from './pages/public/PublicSitemap'
import PublicPortalLogin from './pages/public/PublicPortalLogin'
import PublicAccount from './pages/public/PublicAccount'
import PublicAccountLogin from './pages/public/PublicAccountLogin'
import RentOptimisation from './pages/RentOptimisation'
import ChurnRisk from './pages/ChurnRisk'
import EpcRoadmap from './pages/EpcRoadmap'
import ListingGenerator from './pages/ListingGenerator'
import VoidMinimiser from './pages/VoidMinimiser'
import InsuranceClaims from './pages/InsuranceClaims'
import ContractorPerformance from './pages/ContractorPerformance'
import PhoneAgent from './pages/PhoneAgent'
import RightToRent from './pages/RightToRent'
import Surveys from './pages/Surveys'
import DepositDispute from './pages/DepositDispute'
import Section13 from './pages/Section13'
import TaxSummary from './pages/TaxSummary'
import LeaseAnalyser from './pages/LeaseAnalyser'
import EmailTriage from './pages/EmailTriage'
import Workflows from './pages/Workflows'
import Checklists from './pages/Checklists'
import AuditLog from './pages/AuditLog'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// Detect agency subdomain: smith-lettings.propairty.co.uk → 'smith-lettings'
// OR resolve a fully custom domain via the backend
function getAgencySlug() {
  const host = window.location.hostname
  const match = host.match(/^([a-z0-9-]+)\.propairty\.co\.uk$/)
  if (match && match[1] !== 'www') return match[1]
  return null
}

function SiteRoute() {
  const { slug } = useParams()
  return <PublicSite slug={slug} />
}

function Protected({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />
}

function CustomDomainApp() {
  const [slug, setSlug] = React.useState(null)
  const [notFound, setNotFound] = React.useState(false)
  React.useEffect(() => {
    fetch('/api/public/resolve')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSlug(d.slug))
      .catch(() => setNotFound(true))
  }, [])
  if (notFound) return <div style={{padding:'2rem',fontFamily:'sans-serif'}}>Domain not configured. Visit <a href="https://propairty.co.uk">propairty.co.uk</a></div>
  if (!slug) return null
  return <PublicSite slug={slug} />
}

export default function App() {
  const agencySlug = getAgencySlug()
  if (agencySlug) {
    return <PublicSite slug={agencySlug} />
  }

  // Fully custom domain (not *.propairty.co.uk and not the main app)
  const host = window.location.hostname
  const isMainHost = host === 'propairty.co.uk' || host === 'www.propairty.co.uk' || host === 'app.propairty.co.uk' || host === 'localhost' || host === '127.0.0.1'
  if (!isMainHost) {
    return <CustomDomainApp />
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={<PortalPicker />} />
        <Route path="/login/agent" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/tenant/reset-password" element={<ResetPassword />} />
        <Route path="/landlord/reset-password" element={<ResetPassword />} />
        <Route path="/contractor/reset-password" element={<ResetPassword />} />
        <Route path="/features/:slug" element={<FeaturePage />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/sign/:token" element={<Sign />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/site/:slug" element={<SiteRoute />} />
        <Route path="/site/:slug/about" element={<PublicAbout />} />
        <Route path="/site/:slug/contact" element={<PublicContact />} />
        <Route path="/site/:slug/landlords" element={<PublicLandlords />} />
        <Route path="/site/:slug/areas" element={<PublicAreas />} />
        <Route path="/site/:slug/tenant-advice" element={<PublicTenantAdvice />} />
        <Route path="/site/:slug/landlord-advice" element={<PublicLandlordAdvice />} />
        <Route path="/site/:slug/reviews" element={<PublicReviews />} />
        <Route path="/site/:slug/blog" element={<PublicBlog />} />
        <Route path="/site/:slug/blog/:postSlug" element={<PublicBlogPost />} />
        <Route path="/site/:slug/terms" element={<PublicTerms />} />
        <Route path="/site/:slug/privacy" element={<PublicPrivacy />} />
        <Route path="/site/:slug/valuation" element={<PublicValuation />} />
        <Route path="/site/:slug/sitemap" element={<PublicSitemap />} />
        <Route path="/site/:slug/login" element={<PublicPortalLogin />} />
        <Route path="/site/:slug/account/login" element={<PublicAccountLogin />} />
        <Route path="/site/:slug/account" element={<PublicAccount />} />
        <Route path="/contractor/login" element={<ContractorLogin />} />
        <Route path="/contractor/portal" element={<ContractorPortal />} />
        <Route path="/landlord/login" element={<LandlordLogin />} />
        <Route path="/landlord/portal" element={<LandlordPortal />} />
        <Route path="/tenant/login" element={<TenantLogin />} />
        <Route path="/tenant/portal" element={<TenantPortal />} />
        <Route path="/*" element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyDetail />} />
                <Route path="/properties/:propertyId/units/:unitId" element={<UnitDetail />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/tenants/:id" element={<TenantDetail />} />
                <Route path="/messages" element={<TenantMessages />} />
                <Route path="/meter-readings" element={<MeterReadings />} />
                <Route path="/landlord-messages" element={<LandlordMessages />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/compliance" element={<Compliance />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/news" element={<News />} />
                <Route path="/contractors" element={<Contractors />} />
                <Route path="/contractors/:id" element={<ContractorDetail />} />
                <Route path="/landlords" element={<Landlords />} />
                <Route path="/landlords/:id" element={<LandlordDetail />} />
                <Route path="/inspections" element={<Inspections />} />
                <Route path="/risk" element={<RentRisk />} />
                <Route path="/renewals" element={<Renewals />} />
                <Route path="/files" element={<Files />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/cfo" element={<CFO />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/deposits" element={<Deposits />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/applicants" element={<Applicants />} />
                <Route path="/notices" element={<Notices />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/valuation" element={<Valuation />} />
                <Route path="/ppm" element={<PPM />} />
                <Route path="/rent-optimisation" element={<RentOptimisation />} />
                <Route path="/churn-risk" element={<ChurnRisk />} />
                <Route path="/epc-roadmap" element={<EpcRoadmap />} />
                <Route path="/listing-generator" element={<ListingGenerator />} />
                <Route path="/void-minimiser" element={<VoidMinimiser />} />
                <Route path="/insurance-claims" element={<InsuranceClaims />} />
                <Route path="/contractor-performance" element={<ContractorPerformance />} />
                <Route path="/phone-agent" element={<PhoneAgent />} />
                <Route path="/right-to-rent" element={<RightToRent />} />
                <Route path="/surveys" element={<Surveys />} />
                <Route path="/deposit-dispute" element={<DepositDispute />} />
                <Route path="/section13" element={<Section13 />} />
                <Route path="/tax-summary" element={<TaxSummary />} />
                <Route path="/lease-analyser" element={<LeaseAnalyser />} />
                <Route path="/email-triage" element={<EmailTriage />} />
                <Route path="/workflows" element={<Workflows />} />
                <Route path="/checklists" element={<Checklists />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Protected>
        } />
      </Routes>
    </BrowserRouter>
  )
}
