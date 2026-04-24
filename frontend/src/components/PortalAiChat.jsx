import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Floating AI chat widget for tenant / landlord / contractor portals.
 *
 * Props:
 *   apiUrl      — POST endpoint, e.g. "/api/tenant/portal/ai-chat"
 *   tokenKey    — localStorage key for the auth token (omit or null for public/unauthenticated use)
 *   name        — assistant name: "Mendy" or "Wendy"
 *   color       — tailwind color name: "violet" | "emerald" | "orange" | "indigo"
 *   suggestions — string[]
 *   greeting    — opening message
 *   isPublic    — skip auth header entirely (for marketing site use)
 *   footerNote  — override the footer note text
 */
export default function PortalAiChat({
  apiUrl,
  tokenKey = 'token',
  name = 'Mendy',
  color = 'violet',
  suggestions = [],
  greeting,
  isPublic = false,
  footerNote,
}) {
  const initial = greeting || `Hi! I'm ${name}, your AI assistant. I can answer questions about your account, payments, and more. What would you like to know?`

  const colors = {
    violet:  { header: 'bg-violet-600',  btn: 'bg-violet-600 hover:bg-violet-700',  bubble: 'bg-violet-600',  ring: 'focus:ring-violet-500', chip: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100' },
    emerald: { header: 'bg-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', bubble: 'bg-emerald-600', ring: 'focus:ring-emerald-500', chip: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
    orange:  { header: 'bg-orange-500',  btn: 'bg-orange-500 hover:bg-orange-600',  bubble: 'bg-orange-500',  ring: 'focus:ring-orange-400', chip: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' },
    indigo:  { header: 'bg-indigo-600',  btn: 'bg-indigo-600 hover:bg-indigo-700',  bubble: 'bg-indigo-600',  ring: 'focus:ring-indigo-500', chip: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' },
  }
  const c = colors[color] || colors.violet

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: initial }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  async function send(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    const newMsgs = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (!isPublic) {
        const token = localStorage.getItem(tokenKey) || ''
        headers['Authorization'] = `Bearer ${token}`
      }
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: newMsgs.filter(m => m.role !== 'system') }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.detail || 'Sorry, I had trouble with that.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const r = new SR()
    r.lang = 'en-GB'; r.continuous = false; r.interimResults = false
    recognitionRef.current = r
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror = r.onend = () => setListening(false)
    r.start(); setListening(true)
  }, [listening])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 w-14 h-14 ${c.btn} text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-105`}
        title={`${name} — AI Assistant`}
      >
        {open
          ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          : <span className="text-xl">✨</span>
        }
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 w-96 h-[540px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-40">
          {/* Header */}
          <div className={`px-5 py-4 border-b border-gray-200 flex items-center gap-3 rounded-t-2xl ${c.header}`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {name[0]}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{name} — AI Assistant</p>
              <p className="text-white/70 text-xs">Powered by PropAIrty AI · Your data only</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
                  {!isUser && (
                    <div className={`w-7 h-7 rounded-full ${c.bubble} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5`}>
                      {name[0]}
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser ? `${c.bubble} text-white rounded-tr-sm` : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className={`w-7 h-7 rounded-full ${c.bubble} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0`}>{name[0]}</div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && !loading && suggestions.length > 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {suggestions.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)}
                  className={`text-xs border px-2.5 py-1.5 rounded-full transition-colors text-left ${c.chip}`}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={isPublic ? `Ask ${name} anything…` : `Ask ${name} about your account…`}
                rows={1}
                className={`flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${c.ring} max-h-24 overflow-y-auto`}
                disabled={loading}
              />
              {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                <button onClick={toggleVoice} disabled={loading}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border ${listening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                  </svg>
                </button>
              )}
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className={`w-9 h-9 ${c.btn} disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">{footerNote || 'Only answers questions about your account'}</p>
          </div>
        </div>
      )}
    </>
  )
}
