import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function TenantMessages() {
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)
  const token = localStorage.getItem('token')
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  function fetchInbox() {
    api.get('/tenants/messages/inbox', authHeader)
      .then(r => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchInbox()
    const interval = setInterval(fetchInbox, 8000)
    return () => clearInterval(interval)
  }, [])

  function fetchMessages(tenantId) {
    api.get(`/tenants/${tenantId}/messages`, authHeader)
      .then(r => {
        setMessages(r.data)
        // Mark as read locally
        setConversations(prev => prev.map(c =>
          c.tenant_id === tenantId ? { ...c, unread: 0 } : c
        ))
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (!selectedId) return
    fetchMessages(selectedId)
    const interval = setInterval(() => fetchMessages(selectedId), 4000)
    return () => clearInterval(interval)
  }, [selectedId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!body.trim() || sending || !selectedId) return
    setSending(true)
    try {
      const r = await api.post(`/tenants/${selectedId}/messages`, { body: body.trim() }, authHeader)
      setMessages(prev => [...prev, r.data])
      setBody('')
      fetchInbox()
    } finally { setSending(false) }
  }

  const selected = conversations.find(c => c.tenant_id === selectedId)
  const totalUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0)

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar — conversation list */}
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-base font-semibold text-gray-900">
            Tenant Messages
            {totalUnread > 0 && (
              <span className="ml-2 bg-violet-600 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalUnread}</span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">General enquiries from tenants</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Loading…</p>
          )}
          {!loading && conversations.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm text-gray-400">No messages yet</p>
            </div>
          )}
          {conversations.map(c => (
            <button key={c.tenant_id}
              onClick={() => setSelectedId(c.tenant_id)}
              className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${selectedId === c.tenant_id ? 'bg-violet-50 border-l-2 border-violet-600' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-sm shrink-0 mt-0.5">
                  {c.tenant_name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {c.tenant_name}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">{fmtTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className={`text-xs truncate ${c.unread > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                      {c.last_sender === 'agent' ? 'You: ' : ''}{c.last_message}
                    </p>
                    {c.unread > 0 && (
                      <span className="bg-violet-600 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <p className="text-4xl mb-3">💬</p>
            <p className="text-gray-500 font-medium">Select a conversation</p>
            <p className="text-sm text-gray-400 mt-1">Choose a tenant from the list to view their messages</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-sm">
              {selected?.tenant_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{selected?.tenant_name}</p>
              <p className="text-xs text-gray-400">{selected?.tenant_email}</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">No messages yet.</p>
            )}
            {messages.map(m => {
              const isAgent = m.sender_type === 'agent'
              return (
                <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                    isAgent ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    <p className="font-medium text-xs mb-0.5 opacity-70">
                      {isAgent ? 'You' : m.sender_name}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-xs mt-1 ${isAgent ? 'opacity-60' : 'text-gray-400'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reply box */}
          <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Reply to ${selected?.tenant_name}…`}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" disabled={sending || !body.trim()}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors">
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
