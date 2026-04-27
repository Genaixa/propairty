import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import StatCard from '../components/StatCard'
import HealthScore from '../components/HealthScore'

const RISK_CFG = {
  1: { text: 'text-green-700', bg: 'bg-green-100', label: 'Low' },
  2: { text: 'text-blue-700', bg: 'bg-blue-100', label: 'Low-Med' },
  3: { text: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Medium' },
  4: { text: 'text-orange-700', bg: 'bg-orange-100', label: 'High' },
  5: { text: 'text-red-700', bg: 'bg-red-100', label: 'Critical' },
}

// ─── SVG icon set ─────────────────────────────────────────────────────────────
const Icon = {
  pound: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 1 0-8.466 2.13M9 9.75v7.5M9 17.25h6M9 9.75H6M9 9.75l1.5-1.5" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  wrench: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.5-1.021 1.2-1.2a6 6 0 0 0-8.485-8.485l1.2 1.2m5.5 1.021a5.97 5.97 0 0 0-1.2-1.2m0 0-1.786 1.786" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  key: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  shield: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  shieldExcl: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285Zm0 13.036h.008v.008H12v-.008Z" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  chat: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  ),
  sparkle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  ),
  send: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  ),
}

// ─── Action Required strip ───────────────────────────────────────────────────
function ActionRequired({ data, riskData }) {
  const alerts = []

  if (data.arrears_count > 0)
    alerts.push({ label: `£${data.arrears_total.toLocaleString()} arrears (${data.arrears_count})`, to: '/payments', color: 'red' })
  if (data.compliance_expired > 0)
    alerts.push({ label: `${data.compliance_expired} compliance cert${data.compliance_expired > 1 ? 's' : ''} expired`, to: '/compliance', color: 'red' })
  if (data.deposits_unprotected > 0)
    alerts.push({ label: `${data.deposits_unprotected} unprotected deposit${data.deposits_unprotected > 1 ? 's' : ''}`, to: '/deposits', color: 'red' })
  if (data.inspections_overdue > 0)
    alerts.push({ label: `${data.inspections_overdue} inspection${data.inspections_overdue > 1 ? 's' : ''} overdue`, to: '/inspections', color: 'amber' })
  if (data.ppm_overdue > 0)
    alerts.push({ label: `${data.ppm_overdue} PPM task${data.ppm_overdue > 1 ? 's' : ''} overdue`, to: '/ppm', color: 'amber' })
  if (data.compliance_expiring_soon > 0)
    alerts.push({ label: `${data.compliance_expiring_soon} cert${data.compliance_expiring_soon > 1 ? 's' : ''} expiring soon`, to: '/compliance', color: 'amber' })

  if (!alerts.length) return null

  const hasRed = alerts.some(a => a.color === 'red')

  return (
    <div className={`rounded-xl border px-4 py-3 mb-6 flex flex-wrap items-center gap-2 ${hasRed ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide shrink-0 ${hasRed ? 'text-red-600' : 'text-amber-600'}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        Action required
      </span>
      {alerts.map((a, i) => (
        <Link key={i} to={a.to}
          className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors cursor-pointer ${
            a.color === 'red'
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          }`}>
          {a.label} →
        </Link>
      ))}
    </div>
  )
}

// ─── Quick actions ────────────────────────────────────────────────────────────
function QuickActions() {
  const actions = [
    { label: 'New maintenance job', to: '/maintenance', icon: Icon.wrench },
    { label: 'Add applicant', to: '/applicants', icon: Icon.plus },
    { label: 'Log payment', to: '/payments', icon: Icon.pound },
    { label: 'Book inspection', to: '/inspections', icon: Icon.search },
    { label: 'View renewals', to: '/renewals', icon: Icon.refresh },
    { label: 'Check compliance', to: '/compliance', icon: Icon.clipboard },
  ]
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map(a => (
        <Link key={a.label} to={a.to}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all cursor-pointer">
          <span className="text-gray-400">{a.icon}</span>
          {a.label}
        </Link>
      ))}
    </div>
  )
}

// ─── Ask Mendy bar ────────────────────────────────────────────────────────────
function AskMendy() {
  const [q, setQ] = useState('')
  function open(query) {
    window.dispatchEvent(new CustomEvent('mendy-open', { detail: { query } }))
  }
  const suggestions = [
    'Which tenants are in arrears?',
    'Any compliance expiring this month?',
    'Summarise open maintenance jobs',
  ]
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-indigo-500">{Icon.sparkle}</span>
        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Ask Mendy</span>
        <span className="text-xs text-indigo-400">· your AI portfolio assistant</span>
      </div>
      <form onSubmit={e => { e.preventDefault(); if (q.trim()) open(q.trim()) }} className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ask anything about your portfolio…"
          className="flex-1 text-sm border border-indigo-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button type="submit"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">
          {Icon.send}
          Ask
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {suggestions.map(s => (
          <button key={s} type="button" onClick={() => open(s)}
            className="text-[11px] text-indigo-600 bg-white border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 transition-colors cursor-pointer">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mini chat thread ────────────────────────────────────────────────────────
function ChatThread({ msgs, sending, input, setInput, onSend }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-6">No messages yet</p>
        )}
        {msgs.map(m => {
          const isMe = m.sender_type === 'agent'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && <p className="text-[10px] font-semibold mb-0.5 opacity-60">{m.sender_name}</p>}
                <p>{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={onSend} className="flex gap-2 p-3 border-t border-gray-100">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  )
}

// ─── Messages panel ──────────────────────────────────────────────────────────
function MessagesPanel() {
  const [msgTab, setMsgTab] = useState('tenants')
  const [allTenants, setAllTenants] = useState([])
  const [allLandlords, setAllLandlords] = useState([])
  const [allContractors, setAllContractors] = useState([])
  const [tenantInbox, setTenantInbox] = useState([])
  const [landlordInbox, setLandlordInbox] = useState([])
  const [contractorInbox, setContractorInbox] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/tenants').then(r => setAllTenants(r.data)).catch(() => {})
    api.get('/landlord/landlords').then(r => setAllLandlords(r.data)).catch(() => {})
    api.get('/contractors').then(r => setAllContractors(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    function loadInboxes() {
      api.get('/tenants/messages/inbox').then(r => setTenantInbox(r.data)).catch(() => {})
      api.get('/landlord/messages/inbox').then(r => setLandlordInbox(r.data)).catch(() => {})
      api.get('/contractors/messages/inbox').then(r => setContractorInbox(r.data)).catch(() => {})
    }
    loadInboxes()
    const iv = setInterval(loadInboxes, 8000)
    return () => clearInterval(iv)
  }, [])

  function buildList() {
    if (msgTab === 'tenants') {
      const inboxMap = Object.fromEntries(tenantInbox.map(c => [c.tenant_id, c]))
      return [...allTenants]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(t => ({ id: t.id, name: t.full_name, ...(inboxMap[t.id] || {}) }))
    }
    if (msgTab === 'landlords') {
      const inboxMap = Object.fromEntries(landlordInbox.map(c => [c.landlord_id, c]))
      return [...allLandlords]
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(l => ({ id: l.id, name: l.full_name, ...(inboxMap[l.id] || {}) }))
    }
    const inboxMap = Object.fromEntries(contractorInbox.map(c => [c.contractor_id, c]))
    return [...allContractors]
      .sort((a, b) => (a.company_name || a.full_name).localeCompare(b.company_name || b.full_name))
      .map(c => ({ id: c.id, name: c.company_name || c.full_name, ...(inboxMap[c.id] || {}) }))
  }

  const allContacts = buildList()
  const contacts = search
    ? allContacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : allContacts

  useEffect(() => {
    if (!selectedId) { setThread([]); return }
    function loadThread() {
      const url =
        msgTab === 'tenants' ? `/tenants/${selectedId}/messages` :
        msgTab === 'landlords' ? `/landlord/messages/${selectedId}` :
        `/contractors/${selectedId}/messages`
      api.get(url).then(r => setThread(r.data)).catch(() => {})
    }
    loadThread()
    const iv = setInterval(loadThread, 4000)
    return () => clearInterval(iv)
  }, [selectedId, msgTab])

  useEffect(() => { setSelectedId(null); setThread([]); setSearch('') }, [msgTab])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !selectedId) return
    setSending(true)
    try {
      const url =
        msgTab === 'tenants' ? `/tenants/${selectedId}/messages` :
        msgTab === 'landlords' ? `/landlord/messages/${selectedId}` :
        `/contractors/${selectedId}/messages`
      const r = await api.post(url, { body: input.trim() })
      setThread(prev => [...prev, r.data])
      setInput('')
    } catch (_) {}
    setSending(false)
  }

  const tenantUnread = tenantInbox.reduce((s, c) => s + (c.unread || 0), 0)
  const landlordUnread = landlordInbox.reduce((s, c) => s + (c.unread || 0), 0)
  const contractorUnread = contractorInbox.reduce((s, c) => s + (c.unread || 0), 0)

  const tabs = [
    { key: 'tenants',     label: 'Tenants',     unread: tenantUnread },
    { key: 'landlords',   label: 'Landlords',   unread: landlordUnread },
    { key: 'contractors', label: 'Contractors', unread: contractorUnread },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 pt-4 pb-0">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Messages</h3>
        <div className="flex gap-1 mb-3">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMsgTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                msgTab === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.unread > 0 && (
                <span className={`text-[10px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center ${
                  msgTab === tab.key ? 'bg-white text-indigo-600' : 'bg-violet-600 text-white'
                }`}>
                  {tab.unread > 9 ? '9+' : tab.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex" style={{ height: 360 }}>
        <div className="w-56 border-r border-gray-100 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-gray-50">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 && (
              <p className="text-xs text-gray-400 p-4 text-center">No contacts found</p>
            )}
            {contacts.map(c => {
              const isSelected = selectedId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {c.name}
                    </p>
                    {c.unread > 0 && (
                      <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  {c.last_message
                    ? <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.last_message}</p>
                    : <p className="text-[11px] text-gray-300 mt-0.5 italic">No messages yet</p>
                  }
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!selectedId ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              Select a conversation
            </div>
          ) : (
            <ChatThread
              msgs={thread}
              sending={sending}
              input={input}
              setInput={setInput}
              onSend={handleSend}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [activeTab, setActiveTab] = useState('maintenance')
  const { t } = useTranslation()

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data))
    api.get('/risk').then(r => setRiskData(r.data)).catch(() => {})
  }, [])

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading dashboard…</p>
      </div>
    </div>
  )

  const occupancyData = [
    { name: t('properties.occupied'), value: data.occupied_units },
    { name: t('properties.vacant'), value: data.vacant_units },
  ]
  const COLORS = ['#4f46e5', '#e5e7eb']

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const occupancyPct = data.occupied_units + data.vacant_units > 0
    ? Math.round((data.occupied_units / (data.occupied_units + data.vacant_units)) * 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-gray-400 font-medium">{greeting} · {today}</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-0.5">Portfolio Overview</h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Occupancy</p>
            <p className="text-lg font-extrabold text-indigo-600">{occupancyPct}%</p>
          </div>
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Rent roll</p>
            <p className="text-lg font-extrabold text-emerald-600">£{data.monthly_rent_roll.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-gray-200 mx-1" />
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Properties</p>
            <p className="text-lg font-extrabold text-gray-800">{data.properties}</p>
          </div>
        </div>
      </div>

      {/* Action Required strip */}
      <ActionRequired data={data} riskData={riskData} />

      {/* Ask Mendy */}
      <AskMendy />

      {/* Quick actions */}
      <QuickActions />

      {/* Key stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Monthly Rent Roll"
          value={`£${data.monthly_rent_roll.toLocaleString()}`}
          sub={`${data.occupancy_rate}% occupancy`}
          color="green" icon={Icon.pound} to="/payments"
        />
        <StatCard
          label="Arrears"
          value={data.arrears_count > 0 ? `£${data.arrears_total.toLocaleString()}` : 'Clear'}
          sub={data.arrears_count > 0 ? `${data.arrears_count} overdue tenants` : 'All rents up to date'}
          color={data.arrears_count > 0 ? 'red' : 'green'} icon={Icon.warning} to="/payments"
        />
        <StatCard
          label="Open Maintenance"
          value={data.open_maintenance}
          sub={data.open_maintenance > 0 ? 'Requires attention' : 'All clear'}
          color={data.open_maintenance > 0 ? 'amber' : 'green'} icon={Icon.wrench} to="/maintenance"
        />
        <StatCard
          label="Compliance"
          value={data.compliance_expired > 0 ? `${data.compliance_expired} expired` : 'All valid'}
          sub={data.compliance_expiring_soon > 0 ? `${data.compliance_expiring_soon} expiring soon` : 'No upcoming expirations'}
          color={data.compliance_expired > 0 ? 'red' : data.compliance_expiring_soon > 0 ? 'amber' : 'green'} icon={Icon.clipboard} to="/compliance"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Properties" value={data.properties} sub={`${data.units} total units`} color="indigo" icon={Icon.building} to="/properties" />
        <StatCard label="Active Tenants" value={data.tenants} sub={`${data.active_leases} lease${data.active_leases !== 1 ? 's' : ''} · incl. HMO rooms`} color="indigo" icon={Icon.users} to="/tenants" />
        <StatCard label="Vacant Units" value={data.vacant_units} sub={data.vacant_units > 0 ? 'Loss of income' : 'Fully let'} color={data.vacant_units > 0 ? 'amber' : 'green'} icon={Icon.key} to="/properties" />
        <StatCard label="Renewals Due" value={data.leases_expiring_soon} sub="Within 60 days" color={data.leases_expiring_soon > 0 ? 'amber' : 'green'} icon={Icon.refresh} to="/renewals" />
      </div>

      {/* Tertiary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Applicants"
          value={data.applicants_active}
          sub={data.applicants_referencing > 0 ? `${data.applicants_referencing} awaiting referencing` : 'Pipeline clear'}
          color={data.applicants_active > 0 ? 'indigo' : 'green'} icon={Icon.document} to="/applicants"
        />
        <StatCard
          label="Deposits"
          value={data.deposits_unprotected > 0 ? `${data.deposits_unprotected} unprotected` : 'All protected'}
          sub={data.deposits_pi_outstanding > 0 ? `${data.deposits_pi_outstanding} PI outstanding` : 'Prescribed info served'}
          color={data.deposits_unprotected > 0 ? 'red' : data.deposits_pi_outstanding > 0 ? 'amber' : 'green'} icon={Icon.shield} to="/deposits"
        />
        <StatCard
          label="Inspections"
          value={data.inspections_upcoming > 0 ? `${data.inspections_upcoming} upcoming` : data.inspections_overdue > 0 ? `${data.inspections_overdue} overdue` : 'None due'}
          sub={data.inspections_overdue > 0 ? `${data.inspections_overdue} overdue` : 'Within next 14 days'}
          color={data.inspections_overdue > 0 ? 'red' : data.inspections_upcoming > 0 ? 'amber' : 'green'} icon={Icon.search} to="/inspections"
        />
        <StatCard
          label="PPM Schedule"
          value={data.ppm_overdue > 0 ? `${data.ppm_overdue} overdue` : data.ppm_due_soon > 0 ? `${data.ppm_due_soon} due soon` : 'On track'}
          sub={data.ppm_due_soon > 0 ? 'Within next 30 days' : 'No upcoming tasks'}
          color={data.ppm_overdue > 0 ? 'red' : data.ppm_due_soon > 0 ? 'amber' : 'green'} icon={Icon.calendar} to="/ppm"
        />
      </div>

      {/* Messages section */}
      <MessagesPanel />

      {/* Maintenance + Risk tabs */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'maintenance' ? 'border-b-2 border-indigo-600 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4">{Icon.wrench}</span>
            Open Maintenance
            {data.open_maintenance > 0 && (
              <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{data.open_maintenance}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'risk' ? 'border-b-2 border-indigo-600 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4">{Icon.shieldExcl}</span>
            Rent Risk Alerts
            {riskData && (riskData.counts.critical + riskData.counts.high) > 0 && (
              <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{riskData.counts.critical + riskData.counts.high}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('occupancy')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'occupancy' ? 'border-b-2 border-indigo-600 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4">{Icon.building}</span>
            Unit Occupancy
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'summary' ? 'border-b-2 border-indigo-600 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-4 h-4">{Icon.chart}</span>
            Quick Summary
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'maintenance' && (
            <>
              {data.recent_maintenance && data.recent_maintenance.length > 0 ? (
                <div className="space-y-2">
                  {data.recent_maintenance.map(m => {
                    const priorityColors = {
                      emergency: 'bg-red-100 text-red-700',
                      urgent:    'bg-red-100 text-red-700',
                      high: 'bg-orange-100 text-orange-700',
                      medium: 'bg-yellow-100 text-yellow-700',
                      low: 'bg-gray-100 text-gray-600',
                    }
                    const statusColors = {
                      open: 'bg-blue-100 text-blue-700',
                      in_progress: 'bg-indigo-100 text-indigo-700',
                    }
                    const daysAgo = m.created_at
                      ? Math.floor((Date.now() - new Date(m.created_at)) / 86400000)
                      : null
                    return (
                      <Link
                        key={m.id}
                        to="/maintenance"
                        className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate block">{m.title}</span>
                          <span className="text-xs text-gray-500">{m.property} · {m.unit}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          {daysAgo !== null && (
                            <span className="text-xs text-gray-400">{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
                          )}
                          {m.priority && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[m.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {m.priority.charAt(0).toUpperCase() + m.priority.slice(1)}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[m.status] || 'bg-gray-100 text-gray-600'}`}>
                            {m.status === 'in_progress' ? 'In Progress' : 'Open'}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No open maintenance requests.</p>
              )}
              <div className="mt-3 text-right">
                <Link to="/maintenance" className="text-xs text-indigo-600 font-medium hover:underline">View all →</Link>
              </div>
            </>
          )}

          {activeTab === 'risk' && (
            <>
              {riskData && riskData.tenants.filter(t => t.risk_score >= 3).length > 0 ? (
                <div className="space-y-2">
                  {riskData.tenants.filter(t => t.risk_score >= 3).slice(0, 6).map(t => {
                    const cfg = RISK_CFG[t.risk_score]
                    return (
                      <div key={t.tenant_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{t.tenant_name}</span>
                          <span className="text-xs text-gray-500 ml-2">{t.property} · {t.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {t.stats.current_arrears > 0 && (
                            <span className="text-xs font-semibold text-red-600">£{t.stats.current_arrears.toLocaleString()} arrears</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No rent risk alerts.</p>
              )}
              <div className="mt-3 text-right">
                <Link to="/risk" className="text-xs text-indigo-600 font-medium hover:underline">View all →</Link>
              </div>
            </>
          )}

          {activeTab === 'occupancy' && (
            <>
              {/* Occupancy progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-gray-700">{data.occupied_units} occupied / {data.occupied_units + data.vacant_units} total units</span>
                  <span className="text-lg font-extrabold text-indigo-600">{occupancyPct}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>
                {data.vacant_units > 0 && (
                  <p className="text-xs text-amber-600 font-medium mt-2">{data.vacant_units} vacant unit{data.vacant_units > 1 ? 's' : ''} — potential income loss</p>
                )}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">
                    {occupancyData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {occupancyData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-gray-600">{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
              {[
                { label: 'Annual rent roll', value: `£${(data.monthly_rent_roll * 12).toLocaleString()}` },
                { label: 'Avg rent per occupied unit', value: data.occupied_units ? `£${Math.round(data.monthly_rent_roll / data.occupied_units)}/mo` : '—' },
                { label: 'Arrears outstanding', value: data.arrears_count > 0 ? `£${data.arrears_total.toLocaleString()} (${data.arrears_count})` : '£0 — all clear' },
                { label: 'Leases expiring (60 days)', value: data.leases_expiring_soon || 'None' },
                { label: 'Maintenance issues open', value: data.open_maintenance || 'None' },
                { label: 'Compliance alerts', value: data.compliance_expired > 0 ? `${data.compliance_expired} expired` : data.compliance_expiring_soon > 0 ? `${data.compliance_expiring_soon} expiring soon` : 'All clear' },
                { label: 'Applicants in pipeline', value: data.applicants_active || 'None' },
                { label: 'Deposits unprotected', value: data.deposits_unprotected || 'All protected' },
                { label: 'Inspections (next 14 days)', value: data.inspections_upcoming || 'None scheduled' },
                { label: 'Inspections overdue', value: data.inspections_overdue || 'None' },
                { label: 'PPM tasks overdue', value: data.ppm_overdue || 'None' },
                { label: 'PPM due (30 days)', value: data.ppm_due_soon || 'None' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-gray-50">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <HealthScore />
      </div>
    </div>
  )
}
