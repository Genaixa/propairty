import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import landlordApi from '../../lib/landlordApi'
import NotificationPrefs from '../../components/NotificationPrefs'
import PortalAiChat from '../../components/PortalAiChat'
import OtherPortals from '../../components/OtherPortals'
import ProfileDropdown from '../../components/ProfileDropdown'
import { PageHeader } from '../../components/Illustration'

async function downloadBlob(url, filename) {
  const token = localStorage.getItem('landlord_token')
  const BASE = import.meta.env.VITE_API_URL || '/api'
  const res = await fetch(`${BASE}/landlord/${url}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { alert('Failed to generate PDF'); return }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const statusBadge = (status, extra = '') => {
  const map = {
    valid: 'bg-green-100 text-green-700', expiring_soon: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-red-100 text-red-700', paid: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-600', overdue: 'bg-red-100 text-red-700',
    partial: 'bg-orange-100 text-orange-700', open: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700', scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700', occupied: 'bg-blue-100 text-blue-700',
    vacant: 'bg-gray-100 text-gray-500', sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
  }
  const cls = map[status] || 'bg-gray-100 text-gray-600'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls} ${extra}`}>{status?.replace(/_/g, ' ')}</span>
}

const landlordDlUrl = (fileId) => {
  const token = localStorage.getItem('landlord_token') || ''
  return `/api/uploads/${fileId}/download?token=${encodeURIComponent(token)}`
}

const NAV_ICONS = {
  Overview:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>,
  Properties:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></svg>,
  CFO:         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-3c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V10.125zm-9 1.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v7.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 01-1.125-1.125V12zm13.5-8.625c0-.621.504-1.125 1.125-1.125h2.25C20.496 2.25 21 2.754 21 3.375v16.5c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V3.375z"/></svg>,
  Financials:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 1.5h5.25m-5.75 5.25h4.5a4.5 4.5 0 004.5-4.5v-3a4.5 4.5 0 00-4.5-4.5h-4.5A4.5 4.5 0 003 9.75v3a4.5 4.5 0 004.5 4.5z"/></svg>,
  Arrears:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
  Maintenance: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.5-1.021l1.2-1.2a6 6 0 00-8.485-8.485l1.2 1.2m5.5 1.021a5.97 5.97 0 00-1.2-1.2m0 0l-1.786 1.786"/></svg>,
  Compliance:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Notices:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"/></svg>,
  Renewals:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>,
  Inspections: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>,
  Documents:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>,
  Deposits:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>,
  Statements:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>,
  Messages:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>,
}

const NAV = [
  { key: 'Overview' },
  { key: 'Properties' },
  { key: 'CFO' },
  { key: 'Financials' },
  { key: 'Arrears' },
  { key: 'Deposits' },
  { key: 'Maintenance' },
  { key: 'Compliance' },
  { key: 'Notices' },
  { key: 'Renewals' },
  { key: 'Inspections' },
  { key: 'Documents' },
  { key: 'Statements' },
  { key: 'Messages' },
]

export default function LandlordPortal() {
  const [tab, setTab] = useState('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [me, setMe] = useState(null)
  const [properties, setProperties] = useState([])
  const [financials, setFinancials] = useState(null)
  const [arrears, setArrears] = useState([])
  const [compliance, setCompliance] = useState([])
  const [deposits, setDeposits] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [renewals, setRenewals] = useState([])
  const [inspections, setInspections] = useState([])
  const [documents, setDocuments] = useState([])
  const [notices, setNotices] = useState([])
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgUnread, setMsgUnread] = useState(0)
  const [stmtYear, setStmtYear] = useState(new Date().getFullYear())
  const [stmtMonth, setStmtMonth] = useState(new Date().getMonth() + 1)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()
  const [portalFeatures, setPortalFeatures] = useState({})

  useEffect(() => {
    landlordApi.get('/me').then(r => setMe(r.data)).catch(() => {})
    landlordApi.get('/portal/properties').then(r => setProperties(r.data)).catch(() => {})
    landlordApi.get('/portal/financials').then(r => setFinancials(r.data)).catch(() => {})
    landlordApi.get('/portal/arrears').then(r => setArrears(r.data)).catch(() => {})
    landlordApi.get('/portal/compliance').then(r => setCompliance(r.data)).catch(() => {})
    landlordApi.get('/portal/deposits').then(r => setDeposits(r.data)).catch(() => {})
    landlordApi.get('/portal/maintenance').then(r => setMaintenance(r.data)).catch(() => {})
    landlordApi.get('/portal/renewals').then(r => setRenewals(r.data)).catch(() => {})
    landlordApi.get('/portal/inspections').then(r => setInspections(r.data)).catch(() => {})
    landlordApi.get('/portal/documents').then(r => setDocuments(r.data)).catch(() => {})
    landlordApi.get('/portal/notices').then(r => setNotices(r.data)).catch(() => {})
    landlordApi.get('/features').then(r => setPortalFeatures(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    function pollUnread() {
      landlordApi.get('/portal/messages/unread-count').then(r => setMsgUnread(r.data.count)).catch(() => {})
    }
    pollUnread()
    const iv = setInterval(pollUnread, 15000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (tab === 'Messages') {
      landlordApi.get('/portal/messages').then(r => {
        setMessages(r.data)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }).catch(() => {})
    }
  }, [tab])

  useEffect(() => {
    if (tab === 'Renewals' && renewals.length > 0) {
      renewals.forEach(r => {
        if (r.renewal_id) landlordApi.post(`/portal/renewals/${r.renewal_id}/viewed`).catch(() => {})
      })
    }
  }, [tab, renewals])

  function logout() {
    localStorage.removeItem('landlord_token')
    navigate('/landlord/login')
  }

  function goTo(key) {
    setTab(key)
    setSidebarOpen(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!msgInput.trim()) return
    setMsgSending(true)
    try {
      const r = await landlordApi.post('/portal/messages', { body: msgInput.trim() })
      setMessages(prev => [...prev, r.data])
      setMsgInput('')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { } finally { setMsgSending(false) }
  }

  const arrearsCount = arrears.length
  const unreadMsgs = messages.filter(m => m.sender_type === 'agent' && !m.read).length

  const NAV_FLAGS = {
    'Financials': 'landlord_financials', 'Arrears': 'landlord_arrears',
    'Deposits': 'landlord_deposits',
    'Maintenance': 'landlord_maintenance', 'Compliance': 'landlord_compliance',
    'Notices': 'landlord_notices', 'Renewals': 'landlord_renewals',
    'Inspections': 'landlord_inspections', 'Documents': 'landlord_documents',
    'Statements': 'landlord_statements', 'Messages': 'landlord_messages',
    'CFO': 'landlord_cfo',
  }
  const visibleNAV = NAV.filter(item => {
    const flag = NAV_FLAGS[item.key]
    if (!flag) return true
    return portalFeatures[flag] !== false
  })

  const sidebarContent = (
    <>
      <nav className="bg-emerald-950 rounded-xl overflow-hidden">
        {visibleNAV.map((item) => {
          const badge =
            item.key === 'Arrears' ? arrearsCount :
            item.key === 'Messages' ? (unreadMsgs || msgUnread) : 0
          return (
            <button key={item.key} onClick={() => goTo(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors cursor-pointer
                ${tab === item.key ? 'bg-emerald-600 text-white' : 'text-emerald-300 hover:bg-emerald-900 hover:text-white'}`}>
              <span className="shrink-0 opacity-80">{NAV_ICONS[item.key]}</span>
              <span className="flex-1">{item.key}</span>
              {badge > 0 && (
                <span className={`text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0 ${
                  tab === item.key ? 'bg-white text-emerald-600' :
                  item.key === 'Arrears' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}>{badge > 9 ? '9+' : badge}</span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button onClick={() => setSidebarOpen(v => !v)}
            className="sm:hidden p-2 -ml-1 text-gray-500 hover:text-emerald-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => goTo('Overview')} className="text-left">
            <h1 className="text-xl font-bold text-emerald-600 hover:opacity-80 transition-opacity">
              Prop<span className="text-gray-900">AI</span>rty
              <span className="hidden sm:inline text-sm font-normal text-gray-400 ml-2">Landlord Portal</span>
            </h1>
          </button>
        </div>
        <div className="flex items-center gap-3">
          {me && (
            <ProfileDropdown
              me={me}
              onUpdate={async (patch) => { const r = await landlordApi.patch('/me', patch); setMe(r.data) }}
              onPassword={async ({ current, next }) => landlordApi.post('/me/change-password', { current_password: current, new_password: next })}
              onLogout={logout}
              accentRing="focus:ring-emerald-500"
              btnClass="bg-emerald-600 hover:bg-emerald-700"
            />
          )}
          <button
            onClick={() => { landlordApi.post('/portal/report/viewed').catch(() => {}); downloadBlob('portal/report', `PropAIrty-Report-${new Date().toISOString().slice(0, 7)}.pdf`) }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg transition-colors">
            Download Report
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex gap-6 items-start">
        {/* Mobile sidebar drawer */}
        <aside className={`fixed top-0 left-0 h-full w-64 bg-emerald-950 z-40 p-4 pt-6 overflow-y-auto transition-transform duration-200 sm:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-emerald-200">Menu</span>
            <button onClick={() => setSidebarOpen(false)} className="text-emerald-400 hover:text-white text-xl leading-none">&times;</button>
          </div>
          {sidebarContent}
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden sm:block w-52 shrink-0 sticky top-6">
          {sidebarContent}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* Overview */}
          {tab === 'Overview' && (
            <div className="space-y-5">
              <PageHeader title={me ? `Welcome back, ${me.full_name.split(' ')[0]}` : 'Overview'} subtitle="Your portfolio at a glance" />

              {/* Arrears alert banner */}
              {arrearsCount > 0 && (
                <button onClick={() => goTo('Arrears')} className="w-full flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-left hover:bg-red-100 transition-colors cursor-pointer">
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
                  <p className="text-sm font-semibold text-red-700">{arrearsCount} tenant{arrearsCount > 1 ? 's' : ''} in arrears — tap to view</p>
                  <span className="ml-auto text-red-400 text-sm">→</span>
                </button>
              )}

              {/* Summary cards */}
              {financials && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Monthly Rent', value: `£${financials.total_rent.toLocaleString()}`, valColor: 'text-gray-900', bar: 'bg-emerald-500', onClick: () => goTo('Financials') },
                    { label: 'Collected', value: `£${financials.collected.toLocaleString()}`, valColor: 'text-emerald-600', bar: 'bg-emerald-400', onClick: () => goTo('Financials') },
                    { label: 'Arrears', value: `£${financials.arrears.toLocaleString()}`, valColor: financials.arrears > 0 ? 'text-red-600' : 'text-gray-900', bar: financials.arrears > 0 ? 'bg-red-500' : 'bg-emerald-500', onClick: () => goTo('Arrears') },
                  ].map(c => (
                    <button key={c.label} onClick={c.onClick} className="relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
                      <div className={`absolute top-0 left-0 w-1 h-full ${c.bar}`} />
                      <div className="pl-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
                        <p className={`text-2xl font-extrabold mt-1 ${c.valColor}`}>{c.value}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick-access cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: 'Properties',  label: 'Properties',   count: properties.length, color: 'text-indigo-500' },
                  { key: 'Maintenance', label: 'Open Jobs',    count: maintenance.filter(j => j.status === 'open' || j.status === 'in_progress').length, color: 'text-amber-500', alert: maintenance.filter(j => j.status === 'open' || j.status === 'in_progress').length > 0 },
                  { key: 'Compliance',  label: 'Certificates', count: compliance.length, color: 'text-emerald-500', alert: compliance.some(c => c.status === 'expired') },
                  { key: 'Renewals',    label: 'Renewals',     count: renewals.length, color: 'text-sky-500' },
                  { key: 'Inspections', label: 'Inspections',  count: inspections.length, color: 'text-violet-500' },
                  { key: 'Documents',   label: 'Documents',    count: documents.length, color: 'text-gray-500' },
                ].map(c => (
                  <button key={c.key} onClick={() => goTo(c.key)}
                    className={`bg-white rounded-xl border p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${c.alert ? 'border-amber-200 hover:border-amber-300' : 'border-gray-200 hover:border-emerald-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={c.color}>{NAV_ICONS[c.key]}</span>
                      <span className={`text-2xl font-extrabold ${c.alert ? 'text-amber-600' : 'text-gray-900'}`}>{c.count}</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
                  </button>
                ))}
              </div>

              {/* Recent maintenance */}
              {maintenance.filter(j => j.status !== 'completed').length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Active Maintenance</p>
                    <button onClick={() => goTo('Maintenance')} className="text-xs text-emerald-600 hover:underline">View all</button>
                  </div>
                  {maintenance.filter(j => j.status !== 'completed').slice(0, 3).map(j => (
                    <div key={j.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between">
                      <p className="text-sm text-gray-800 truncate mr-3">{j.title}</p>
                      {statusBadge(j.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Properties */}
          {tab === 'Properties' && (
            <div className="space-y-4">
              <PageHeader title="Your Properties" subtitle="All properties and units assigned to your account" />
              {properties.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                  No properties assigned yet. Contact your letting agent.
                </div>
              )}
              {properties.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      <p className="text-sm text-gray-500">{p.address}</p>
                    </div>
                    <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full capitalize">{p.property_type}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {p.units.map(u => (
                      <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500">
                            {u.tenant_name ? `Tenant: ${u.tenant_name}` : 'Vacant'}
                            {u.lease_end ? ` · Lease ends ${u.lease_end}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">£{u.rent_amount}/mo</span>
                          {statusBadge(u.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CFO */}
          {tab === 'CFO' && <LandlordCFOTab />}

          {/* Financials */}
          {tab === 'Financials' && (
            <div>
              <PageHeader title="Payment History" subtitle="Rent collected, expected, and outstanding by property" />
              {!financials?.payments.length ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No payment records.</div>
              ) : (() => {
                // Group payments by property → unit
                const byProp = {}
                financials.payments.forEach(p => {
                  const key = p.property_name
                  if (!byProp[key]) byProp[key] = {}
                  const uKey = `${p.unit_name}||${p.tenant_name}`
                  if (!byProp[key][uKey]) byProp[key][uKey] = { unit: p.unit_name, tenant: p.tenant_name, payments: [] }
                  byProp[key][uKey].payments.push(p)
                })
                return Object.entries(byProp).map(([propName, units]) => (
                  <div key={propName} className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"/></svg>
                      {propName}
                    </h3>
                    {Object.values(units).map(({ unit, tenant, payments: ups }) => (
                      <div key={unit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-800">{unit}</span>
                          {tenant && tenant !== '—' && (
                            <span className="text-xs text-gray-500">· {tenant}</span>
                          )}
                        </div>
                        <table className="w-full text-sm">
                          <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                              <th className="px-5 py-2 text-left">Due Date</th>
                              <th className="px-5 py-2 text-right">Amount Due</th>
                              <th className="px-5 py-2 text-right">Paid</th>
                              <th className="px-5 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {ups.map(p => (
                              <tr key={p.id}>
                                <td className="px-5 py-2.5 text-gray-700">{p.due_date}</td>
                                <td className="px-5 py-2.5 text-right text-gray-700">£{p.amount_due}</td>
                                <td className="px-5 py-2.5 text-right text-gray-700">{p.amount_paid != null ? `£${p.amount_paid}` : '—'}</td>
                                <td className="px-5 py-2.5 text-center">{statusBadge(p.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}

          {/* Arrears */}
          {tab === 'Arrears' && (
            <div>
              <PageHeader title="Rent Arrears" subtitle="Tenants with outstanding rent balances" />
              {arrears.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No tenants currently in arrears.</div>
              ) : (
                <div className="space-y-3">
                  {arrears.map((a, i) => {
                    const isUrgent = a.days_overdue >= 7
                    const isMid = a.days_overdue >= 1
                    return (
                      <div key={i} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isUrgent ? 'border-red-200' : isMid ? 'border-amber-200' : 'border-gray-200'}`}>
                        <div className={`px-5 py-3 flex items-center justify-between ${isUrgent ? 'bg-red-50' : isMid ? 'bg-amber-50' : 'bg-gray-50'}`}>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{a.tenant_name}</p>
                            <p className="text-xs text-gray-500">{a.property} · {a.unit}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isUrgent ? 'bg-red-100 text-red-700' : isMid ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {a.days_overdue}d overdue
                            </span>
                            <button
                              onClick={() => {
                                setMsgInput(`Hi, I'd like to chase the arrears for ${a.tenant_name} at ${a.property} · ${a.unit}. They owe £${a.total_owed.toLocaleString()} (${a.days_overdue} days overdue). Please can you look into this?`)
                                goTo('Messages')
                              }}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer">
                              Message agent →
                            </button>
                          </div>
                        </div>
                        <div className="px-5 py-3 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Amount owed</p>
                            <p className="font-semibold text-red-700">£{a.total_owed.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Payments overdue</p>
                            <p className="font-medium text-gray-800">{a.payments_overdue}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Oldest due</p>
                            <p className="font-medium text-gray-800">{a.oldest_due_date}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Maintenance */}
          {tab === 'Maintenance' && (
            <div>
              <PageHeader title="Maintenance Jobs" subtitle="Open and completed maintenance requests across your properties" />
              <div className="space-y-3">
                {maintenance.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No maintenance jobs.</div>
                )}
                {maintenance.map(j => (
                  <div key={j.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{j.title}</p>
                        {j.description && <p className="text-sm text-gray-500 mt-0.5">{j.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">{j.created_at?.slice(0, 10)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {statusBadge(j.status)}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          j.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          j.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                        }`}>{j.priority}</span>
                      </div>
                    </div>
                    {j.actual_cost != null && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Cost: £{Number(j.actual_cost).toFixed(2)}</span>
                        {j.invoice_ref && <span className="text-gray-400">Inv: {j.invoice_ref}</span>}
                        {j.assigned_to && <span className="text-gray-400">· {j.assigned_to}</span>}
                      </div>
                    )}
                    {(j.status === 'open' || j.status === 'in_progress') && (
                      <button
                        onClick={() => {
                          setMsgInput(`Hi, I'd like an update on the maintenance job: "${j.title}". Could you let me know the current status and when it's expected to be resolved?`)
                          goTo('Messages')
                        }}
                        className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline cursor-pointer">
                        Message agent for update →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance */}
          {tab === 'Compliance' && (
            <div>
              <PageHeader title="Compliance Certificates" subtitle="Gas safety, EPC, EICR and other compliance records" />
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 text-left">Property</th>
                      <th className="px-6 py-3 text-left">Certificate</th>
                      <th className="px-6 py-3 text-left">Issued</th>
                      <th className="px-6 py-3 text-left">Expires</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {compliance.map(c => {
                      const rowCls = c.status === 'expired' ? 'bg-red-50' : c.status === 'expiring_soon' ? 'bg-amber-50' : ''
                      return (
                        <tr key={c.id} className={rowCls}>
                          <td className="px-6 py-3 text-gray-600 text-xs">{c.property_name}</td>
                          <td className="px-6 py-3 font-medium text-gray-900">{c.label}</td>
                          <td className="px-6 py-3 text-gray-600">{c.issue_date || '—'}</td>
                          <td className={`px-6 py-3 font-medium ${c.status === 'expired' ? 'text-red-700' : c.status === 'expiring_soon' ? 'text-amber-700' : 'text-gray-600'}`}>{c.expiry_date || '—'}</td>
                          <td className="px-6 py-3 text-center">
                            {statusBadge(c.status)}
                            {c.days_remaining != null && c.days_remaining >= 0 && (
                              <span className="text-xs text-gray-400 ml-1">({c.days_remaining}d)</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {c.upload_id ? (
                              <a href={landlordDlUrl(c.upload_id)} target="_blank" rel="noreferrer"
                                className="text-xs text-emerald-600 hover:underline font-medium">
                                📎 View →
                              </a>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {compliance.length === 0 && (
                      <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">No certificates on record.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Renewals */}
          {tab === 'Renewals' && (
            <div>
              <PageHeader title="Lease Renewals" subtitle="Tenancies expiring within the next 90 days" />
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {renewals.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No leases expiring within 90 days.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Tenant</th>
                        <th className="px-6 py-3 text-left">Property / Unit</th>
                        <th className="px-6 py-3 text-left">End Date</th>
                        <th className="px-6 py-3 text-right">Days Left</th>
                        <th className="px-6 py-3 text-right">Monthly Rent</th>
                        <th className="px-6 py-3 text-center">Renewal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {renewals.map(r => {
                        const cls = r.days_remaining <= 30 ? 'text-red-700 font-bold' : r.days_remaining <= 60 ? 'text-amber-700 font-semibold' : 'text-gray-700'
                        return (
                          <tr key={r.lease_id}>
                            <td className="px-6 py-3 font-medium text-gray-900">{r.tenant_name}</td>
                            <td className="px-6 py-3 text-gray-600">{r.property} · {r.unit}</td>
                            <td className="px-6 py-3 text-gray-600">{r.end_date}</td>
                            <td className={`px-6 py-3 text-right ${cls}`}>{r.days_remaining}d</td>
                            <td className="px-6 py-3 text-right text-gray-700">£{r.monthly_rent?.toLocaleString()}</td>
                            <td className="px-6 py-3 text-center">{r.renewal_status ? statusBadge(r.renewal_status) : <span className="text-xs text-gray-400">None sent</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Inspections */}
          {tab === 'Inspections' && (
            <div>
              <PageHeader title="Inspections" subtitle="Routine and move-in/out inspection reports" />
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {inspections.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No inspections on record.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Type</th>
                        <th className="px-6 py-3 text-left">Property / Unit</th>
                        <th className="px-6 py-3 text-left">Scheduled</th>
                        <th className="px-6 py-3 text-left">Inspector</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3 text-left">Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inspections.map(i => (
                        <tr key={i.id}>
                          <td className="px-6 py-3 font-medium text-gray-900">{i.type}</td>
                          <td className="px-6 py-3 text-gray-600">{i.property} · {i.unit}</td>
                          <td className="px-6 py-3 text-gray-600">{i.scheduled_date?.slice(0, 10) || '—'}</td>
                          <td className="px-6 py-3 text-gray-600">{i.inspector_name || '—'}</td>
                          <td className="px-6 py-3 text-center">{statusBadge(i.status)}</td>
                          <td className="px-6 py-3 text-gray-600 capitalize">{i.overall_condition || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          {tab === 'Documents' && (() => {
            const DOC_ICON = (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            )
            const SIGNED_ICON = (
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
            )
            const CAT_META = {
              agreement:        { icon: DOC_ICON, label: 'Tenancy Agreements' },
              certificate:      { icon: DOC_ICON, label: 'Compliance Certificates' },
              invoice:          { icon: DOC_ICON, label: 'Invoices' },
              correspondence:   { icon: DOC_ICON, label: 'Correspondence' },
              signed_document:  { icon: SIGNED_ICON, label: 'Electronically Signed Documents' },
              other:            { icon: DOC_ICON, label: 'Other Documents' },
            }
            const grouped = {}
            // Put signed docs first in grouping
            const sorted = [...documents].sort((a, b) => {
              if (a.source === 'esign' && b.source !== 'esign') return -1
              if (b.source === 'esign' && a.source !== 'esign') return 1
              return 0
            })
            sorted.forEach(d => {
              const cat = d.category || 'other'
              if (!grouped[cat]) grouped[cat] = []
              grouped[cat].push(d)
            })
            const API_BASE = import.meta.env.VITE_API_URL || ''
            return (
              <div>
                <PageHeader title="Documents" subtitle="Tenancy agreements, certificates, and signed documents" />
                {documents.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No documents on record.</div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(grouped).map(([cat, docs]) => {
                      const meta = CAT_META[cat] || { icon: '📎', label: cat }
                      const isEsignGroup = cat === 'signed_document'
                      return (
                        <div key={cat}>
                          <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                            <span>{meta.icon}</span> {meta.label}
                          </h3>
                          <div className="space-y-2">
                            {docs.map(d => {
                              const isEsigned = d.source === 'esign'
                              // For upload docs, extract numeric id from "upload-123"
                              const uploadNumericId = !isEsigned ? String(d.id).replace('upload-', '') : null
                              const downloadHref = isEsigned
                                ? `${API_BASE}/api/signing/${d.token}/download`
                                : `${API_BASE}/api/landlord/portal/documents/${uploadNumericId}/download`
                              return (
                                <div key={d.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${isEsigned ? 'border-green-200 bg-green-50 hover:border-green-400' : 'border-gray-200 hover:border-emerald-300'}`}>
                                  <span className="shrink-0">{isEsigned ? SIGNED_ICON : DOC_ICON}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{d.original_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {d.property && d.property !== '—' && <span>{d.property}</span>}
                                      {d.unit && <span> · {d.unit}</span>}
                                      {d.tenant && <span> · {d.tenant}</span>}
                                      {d.file_size && <span> · {Math.round(d.file_size / 1024)}kb</span>}
                                      {d.created_at && <span> · {d.created_at.slice(0, 10)}</span>}
                                    </p>
                                    {d.description && <p className={`text-xs mt-0.5 ${isEsigned ? 'text-green-700 font-medium' : 'text-gray-500'}`}>{d.description}</p>}
                                    {isEsigned && <p className="text-xs text-green-600 mt-0.5">Signed by {d.signer_name} · Legally binding under Electronic Communications Act 2000</p>}
                                  </div>
                                  <a href={downloadHref}
                                    className={`text-xs hover:underline shrink-0 font-medium ${isEsigned ? 'text-green-700' : 'text-emerald-600'}`}
                                    target="_blank" rel="noopener noreferrer">
                                    Download →
                                  </a>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Deposits */}
          {tab === 'Deposits' && (
            <div>
              <PageHeader title="Tenancy Deposits" subtitle="Deposit protection status across all properties" />
              {deposits.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No deposit records found.</div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3 text-left">Property / Unit</th>
                        <th className="px-6 py-3 text-left">Tenant</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3 text-left">Scheme</th>
                        <th className="px-6 py-3 text-left">Reference</th>
                        <th className="px-6 py-3 text-left">Protected</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deposits.map(d => (
                        <>
                          <tr key={d.lease_id}>
                            <td className="px-6 py-3">
                              <p className="font-medium text-gray-900">{d.property_name}</p>
                              <p className="text-xs text-gray-500">{d.unit_name}</p>
                            </td>
                            <td className="px-6 py-3 text-gray-700">{d.tenant_name}</td>
                            <td className="px-6 py-3 text-right font-medium text-gray-900">{d.deposit_amount != null ? `£${Number(d.deposit_amount).toLocaleString()}` : '—'}</td>
                            <td className="px-6 py-3 text-gray-600">{d.scheme || <span className="text-gray-300">Not recorded</span>}</td>
                            <td className="px-6 py-3 text-gray-500 text-xs">{d.scheme_reference || '—'}</td>
                            <td className="px-6 py-3 text-gray-600 text-xs">{d.protected_date || '—'}</td>
                            <td className="px-6 py-3 text-center">{statusBadge(d.status)}</td>
                          </tr>
                          {d.status === 'disputed' && d.dispute_summary && (
                            <tr key={`${d.lease_id}-dispute`} className="bg-purple-50">
                              <td colSpan={7} className="px-6 py-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-xs font-semibold text-purple-700 mb-1">Dispute in Progress</p>
                                    <p className="text-xs text-purple-600 whitespace-pre-line">{d.dispute_summary.split('\n').filter(l => !l.startsWith('PDF: ')).join('\n')}</p>
                                  </div>
                                  {d.dispute_pdf_url && (
                                    <button
                                      onClick={async () => {
                                        const path = d.dispute_pdf_url.replace(/^\/api\/landlord/, '')
                                        const r = await landlordApi.get(path, { responseType: 'blob' })
                                        const url = URL.createObjectURL(r.data)
                                        const a = document.createElement('a'); a.href = url; a.download = d.dispute_pdf_url.split('/').pop(); a.click()
                                        URL.revokeObjectURL(url)
                                      }}
                                      className="shrink-0 text-xs font-medium text-purple-700 border border-purple-300 rounded-lg px-3 py-1.5 hover:bg-purple-100 whitespace-nowrap">
                                      Download PDF
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Statements */}
          {tab === 'Statements' && (
            <div>
              <PageHeader title="Rent Statements" subtitle="Download monthly statements for your records" />
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm text-gray-600 mb-5">
                  Download a monthly statement showing expected rent, amounts collected, and any outstanding balances across all your properties.
                  Statements are also emailed to you automatically on the 1st of each month.
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Year</label>
                    <select value={stmtYear} onChange={e => setStmtYear(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {[...Array(5)].map((_, i) => {
                        const y = new Date().getFullYear() - i
                        return <option key={y} value={y}>{y}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Month</label>
                    <select value={stmtMonth} onChange={e => setStmtMonth(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => downloadBlob(`portal/statement/${stmtYear}/${stmtMonth}`, `Statement-${stmtYear}-${String(stmtMonth).padStart(2, '0')}.pdf`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notices */}
          {tab === 'Notices' && (
            <div>
              <PageHeader title="Legal Notices" subtitle="Section 21 and Section 8 notices served on your properties" />
              {notices.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">No legal notices on your properties.</div>
              ) : (
                <div className="space-y-3">
                  {notices.map(n => (
                    <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{n.notice_type}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.tenant_name} · {n.property}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{n.notice_type?.includes('21') ? 'S21' : n.notice_type?.includes('8') ? 'S8' : 'Notice'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                        {n.served_date && <span>Served: <span className="font-medium text-gray-700">{n.served_date}</span></span>}
                        {n.possession_date && <span>Possession date: <span className="font-medium text-gray-700">{n.possession_date}</span></span>}
                        {n.arrears_amount > 0 && <span>Arrears: <span className="font-medium text-red-600">£{Number(n.arrears_amount).toFixed(2)}</span></span>}
                      </div>
                      {n.custom_notes && <p className="mt-2 text-xs text-gray-400 italic">{n.custom_notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {tab === 'Messages' && (
            <div>
              <PageHeader title="Messages" subtitle="Direct messages with your letting agent" />
              <NotificationPrefs
                getUrl="/api/landlord/portal/notification-prefs"
                putUrl="/api/landlord/portal/notification-prefs"
                tokenKey="landlord_token"
              />
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" style={{ height: '520px' }}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Messages with your letting agent</p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-gray-400 text-center mt-10">No messages yet. Send a message to your agent below.</p>
                  )}
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === 'landlord' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                        m.sender_type === 'landlord'
                          ? 'bg-emerald-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        <p>{m.body}</p>
                        <p className={`text-xs mt-1 ${m.sender_type === 'landlord' ? 'text-emerald-200' : 'text-gray-400'}`}>
                          {m.created_at ? new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={sendMessage} className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button type="submit" disabled={msgSending || !msgInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
      <OtherPortals current="landlord" />
      <PortalAiChat
        apiUrl="/api/landlord/portal/ai-chat"
        tokenKey="landlord_token"
        name="Mendy"
        color="emerald"
        suggestions={[
          "What's my total rent roll this month?",
          "Are there any arrears on my properties?",
          "Which units are vacant?",
          "What open maintenance jobs are on my properties?",
        ]}
      />
    </div>
  )
}

// ── Landlord CFO tab ────────────────────────────────────────────────────────

const fmtGBP = n => `£${Math.round(n || 0).toLocaleString()}`

function LandlordCFOTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feePct, setFeePct] = useState(10)

  useEffect(() => {
    setLoading(true)
    landlordApi.get('/cfo', { params: { fee_pct: feePct } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [feePct])

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading your P&L…</p>
      </div>
    </div>
  )
  if (!data) return null

  const { kpis, scorecard, push_actions, drop_actions, forecast } = data
  const verdictStyle = v => ({
    star: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    ok: 'bg-sky-50 text-sky-700 ring-sky-200',
    watch: 'bg-amber-50 text-amber-700 ring-amber-200',
    drop: 'bg-red-50 text-red-700 ring-red-200',
  })[v] || 'bg-gray-50 text-gray-700 ring-gray-200'
  const verdictLabel = v => ({ star: 'Star', ok: 'OK', watch: 'Watch', drop: 'Drop' })[v] || '—'

  const maxGross = Math.max(1, ...forecast.map(f => f.gross_rent))

  return (
    <div className="space-y-5">
      <PageHeader title="CFO — Portfolio P&L" subtitle="What your properties earned, what they cost, and where to push next.">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Agency fee %</label>
          <input
            type="number" min="0" max="100" step="0.5" value={feePct}
            onChange={e => setFeePct(Number(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Net income (12mo)</p>
          <p className={`text-2xl font-bold mt-1 ${kpis.net_income_12mo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtGBP(kpis.net_income_12mo)}</p>
          <p className="text-xs text-gray-400 mt-0.5">rent − repairs − fees</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Gross rent</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmtGBP(kpis.gross_rent_12mo)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtGBP(kpis.monthly_rent_roll)}/mo run-rate</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Maintenance</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmtGBP(kpis.maintenance_12mo)}</p>
          <p className="text-xs text-gray-400 mt-0.5">actual cost 12mo</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Agency fee</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{fmtGBP(kpis.agency_fee_12mo)}</p>
          <p className="text-xs text-gray-400 mt-0.5">at {kpis.fee_pct}%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Occupancy</p>
          <p className={`text-xl font-bold mt-1 ${kpis.occupancy_pct >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{kpis.occupancy_pct.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{kpis.occupied_units}/{kpis.units} units</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Net yield on rent</p>
          <p className="text-xl font-bold text-sky-600 mt-1">{kpis.yield_pct.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-0.5">after all costs</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Annual run-rate (net)</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{fmtGBP(kpis.net_run_rate)}</p>
          <p className="text-xs text-gray-400 mt-0.5">forward projection</p>
        </div>
      </div>

      {/* Push / Drop */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-emerald-50/60 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><span className="text-emerald-600">↗</span> Push this</h3>
            <span className="text-xs text-gray-500">{push_actions.length} action{push_actions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {push_actions.length === 0 && <div className="px-5 py-8 text-center text-sm text-gray-400">Nothing to push — looks optimised.</div>}
            {push_actions.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-600">+{fmtGBP(a.net_impact_annual)}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">net/yr</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-red-50/60 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><span className="text-red-600">↘</span> Consider dropping</h3>
            <span className="text-xs text-gray-500">{drop_actions.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {drop_actions.length === 0 && <div className="px-5 py-8 text-center text-sm text-gray-400">No underperformers — every property pulls its weight.</div>}
            {drop_actions.map((d, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${verdictStyle(d.verdict)}`}>{verdictLabel(d.verdict)}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{d.property_name}</span>
                  </div>
                  <ul className="text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                    {d.reasons.slice(0, 3).map((r, j) => <li key={j}>{r}</li>)}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-red-600">−{fmtGBP(d.drag_estimate)}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">drag/yr</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast — simple bar chart without recharts dep */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">12-month rent forecast</h3>
        <div className="space-y-1.5">
          {forecast.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-20 shrink-0 tabular-nums">{f.month}</span>
              <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-emerald-500/80 flex items-center px-2"
                  style={{ width: `${(f.net_income / maxGross) * 100}%` }}>
                </div>
                {f.at_risk_rent > 0 && (
                  <div className="absolute inset-y-0 bg-red-400/70"
                    style={{
                      left: `${(f.net_income / maxGross) * 100}%`,
                      width: `${(f.at_risk_rent * (1 - feePct/100) / maxGross) * 100}%`,
                    }} />
                )}
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className="text-[11px] font-semibold text-gray-700 tabular-nums">
                    {fmtGBP(f.net_income)}{f.at_risk_rent > 0 ? ` · ${fmtGBP(f.at_risk_rent)} at risk` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-500/80" /> Net rent (after fee)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-400/70" /> At risk (lease ending)</span>
        </div>
      </div>

      {/* Scorecard */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Property scorecard</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ranked by 12-month net income.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Property</th>
                <th className="text-right px-3 py-2.5">Gross</th>
                <th className="text-right px-3 py-2.5">Repairs</th>
                <th className="text-right px-3 py-2.5">Fee</th>
                <th className="text-right px-3 py-2.5">Net</th>
                <th className="text-right px-3 py-2.5">Margin</th>
                <th className="text-right px-3 py-2.5">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scorecard.map(s => (
                <tr key={s.property_id}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${verdictStyle(s.verdict)}`}>{verdictLabel(s.verdict)}</span>
                      <span className="font-medium text-gray-900">{s.property_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{s.address}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtGBP(s.gross_rent_12mo)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{fmtGBP(s.maintenance_12mo)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmtGBP(s.agency_fee_12mo)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${s.net_income_12mo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtGBP(s.net_income_12mo)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${s.margin_pct >= 50 ? 'text-emerald-600' : s.margin_pct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{s.margin_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-700">{s.score}</td>
                </tr>
              ))}
              {scorecard.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No properties yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
