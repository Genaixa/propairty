import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'

const SUGGESTIONS = [
  "What's my occupancy rate?",
  "Which leases expire in the next 60 days?",
  "Show me all open maintenance issues",
  "Draft a rent reminder for Priya Sharma",
  "What's my monthly rent roll?",
  "List all vacant units",
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
          AI
        </div>
      )}
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
        AI
      </div>
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your PropAIrty assistant. I can answer questions about your portfolio, draft letters, log maintenance requests, and more. What would you like to know?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Only send non-system messages to API
      const apiMessages = newMessages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }))
      const res = await api.post('/ai/chat', { messages: apiMessages }, { timeout: 180000 })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-105"
        title="PropAIrty Assistant"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-xl">✨</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 w-96 h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-40">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3 rounded-t-2xl bg-indigo-600">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">AI</div>
            <div>
              <p className="font-semibold text-white text-sm">PropAIrty Assistant</p>
              <p className="text-indigo-200 text-xs">AI-powered · Live portfolio data</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no conversation yet) */}
          {messages.length === 1 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1.5 rounded-full hover:bg-indigo-100 transition-colors text-left">
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
                onKeyDown={handleKey}
                placeholder="Ask anything about your portfolio…"
                rows={1}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-24 overflow-y-auto"
                disabled={loading}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">Powered by PropAIrty AI · Live data</p>
          </div>
        </div>
      )}
    </>
  )
}
