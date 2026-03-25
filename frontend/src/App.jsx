import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './lib/auth'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import Tenants from './pages/Tenants'
import Leases from './pages/Leases'
import Maintenance from './pages/Maintenance'
import Payments from './pages/Payments'
import Compliance from './pages/Compliance'
import Alerts from './pages/Alerts'
import Documents from './pages/Documents'
import News from './pages/News'
import Settings from './pages/Settings'
import Contractors from './pages/Contractors'
import Inspections from './pages/Inspections'
import RentRisk from './pages/RentRisk'
import Renewals from './pages/Renewals'
import Files from './pages/Files'
import Analytics from './pages/Analytics'
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
import PortalPicker from './pages/PortalPicker'
import ContractorLogin from './pages/contractor/ContractorLogin'
import ContractorPortal from './pages/contractor/ContractorPortal'
import LandlordLogin from './pages/landlord/LandlordLogin'
import LandlordPortal from './pages/landlord/LandlordPortal'
import TenantLogin from './pages/tenant/TenantLogin'
import TenantPortal from './pages/tenant/TenantPortal'

function Protected({ children }) {
  return isLoggedIn() ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={<PortalPicker />} />
        <Route path="/login/agent" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/tenant/reset-password" element={<ResetPassword />} />
        <Route path="/landlord/reset-password" element={<ResetPassword />} />
        <Route path="/contractor/reset-password" element={<ResetPassword />} />
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
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/compliance" element={<Compliance />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/news" element={<News />} />
                <Route path="/contractors" element={<Contractors />} />
                <Route path="/inspections" element={<Inspections />} />
                <Route path="/risk" element={<RentRisk />} />
                <Route path="/renewals" element={<Renewals />} />
                <Route path="/files" element={<Files />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/dispatch" element={<Dispatch />} />
                <Route path="/deposits" element={<Deposits />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/applicants" element={<Applicants />} />
                <Route path="/notices" element={<Notices />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/valuation" element={<Valuation />} />
                <Route path="/ppm" element={<PPM />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Protected>
        } />
      </Routes>
    </BrowserRouter>
  )
}
