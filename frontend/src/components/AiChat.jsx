import { useState, useRef, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import api from '../lib/api'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const SUGGESTIONS = [
  "What's my occupancy rate?",
  "Which leases expire in the next 60 days?",
  "Show me open maintenance issues as a chart",
  "Show me my vacancy trend over the last 30 days",
  "What's my monthly rent roll?",
  "Chart my overdue rent count this month",
]

function getAssistantConfig() {
  const gender = localStorage.getItem('assistant_gender') || 'male'
  if (gender === 'male') {
    return {
      name: 'Mendy',
      greeting: "Hi! I'm Mendy, your PropAIrty assistant. I can answer questions about your portfolio, show trend charts, draft letters, log maintenance requests, and more. What would you like to know?",
      headerBg: 'bg-indigo-600',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
      avatarBg: 'bg-indigo-600',
      bubbleBg: 'bg-indigo-600',
      ringColor: 'focus:ring-indigo-500',
      suggestionStyle: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
      chartStroke: '#6366f1',
    }
  }
  return {
    name: 'Wendy',
    greeting: "Hi! I'm Wendy, your PropAIrty assistant. I can answer questions about your portfolio, show trend charts, draft letters, log maintenance requests, and more. What would you like to know?",
    headerBg: 'bg-violet-600',
    buttonBg: 'bg-violet-600 hover:bg-violet-700',
    avatarBg: 'bg-violet-600',
    bubbleBg: 'bg-violet-600',
    ringColor: 'focus:ring-violet-500',
    suggestionStyle: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100',
    chartStroke: '#8b5cf6',
  }
}

function InlineChart({ chart }) {
  if (!chart || !chart.labels || !chart.datasets?.length) return null

  if (chart.type === 'pie') {
    const pieData = chart.labels.map((label, i) => ({
      name: label,
      value: chart.datasets[0]?.data[i] ?? 0,
    }))
    return (
      <div className="mt-2 bg-white rounded-xl p-3 border border-gray-100">
        <p className="text-xs font-semibold text-gray-600 mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const chartData = chart.labels.map((label, i) => {
    const point = { name: label }
    chart.datasets.forEach(ds => { point[ds.label] = ds.data[i] ?? 0 })
    return point
  })

  const ChartComponent = chart.type === 'line' ? LineChart : BarChart

  return (
    <div className="mt-2 bg-white rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-600 mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <ChartComponent data={chartData}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={30} />
          <Tooltip />
          {chart.datasets.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {chart.datasets.map((ds, i) =>
            chart.type === 'line'
              ? <Line key={i} type="monotone" dataKey={ds.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
              : <Bar key={i} dataKey={ds.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

function Message({ msg, cfg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-full ${cfg.avatarBg} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5`}>
          {cfg.name[0]}
        </div>
      )}
      <div className="max-w-[85%]">
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? `${cfg.bubbleBg} text-white rounded-tr-sm`
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}>
          {msg.content}
        </div>
        {!isUser && msg.chart && <InlineChart chart={msg.chart} />}
      </div>
    </div>
  )
}

function TypingIndicator({ cfg }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex justify-start mb-3">
      <div className={`w-7 h-7 rounded-full ${cfg.avatarBg} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0`}>
        {cfg.name[0]}
      </div>
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        {secs >= 3 && <span className="text-xs text-gray-400 ml-1">Thinking… {secs}s</span>}
      </div>
    </div>
  )
}

export default function AiChat() {
  const [cfg, setCfg] = useState(getAssistantConfig)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => {
    const c = getAssistantConfig()
    return [{ role: 'assistant', content: c.greeting }]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const handler = () => {
      const newCfg = getAssistantConfig()
      setCfg(newCfg)
      setMessages([{ role: 'assistant', content: newCfg.greeting }])
    }
    window.addEventListener('assistant_gender_changed', handler)
    return () => window.removeEventListener('assistant_gender_changed', handler)
  }, [])

  useEffect(() => {
    const handler = e => {
      setOpen(true)
      if (e.detail?.query) setInput(e.detail.query)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
    window.addEventListener('mendy-open', handler)
    return () => window.removeEventListener('mendy-open', handler)
  }, [])

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
      const apiMessages = newMessages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
      }))
      const res = await api.post('/ai/chat', { messages: apiMessages }, { timeout: 180000 })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        chart: res.data.chart || null,
      }])
    } catch (e) {
      const detail = e.response?.data?.detail
      const msg = detail || 'Sorry, I had trouble processing that. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognition.start()
    setListening(true)
  }, [listening])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 w-14 h-14 ${cfg.buttonBg} text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-105`}
        title={`${cfg.name} — PropAIrty Assistant`}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-xl">✨</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-96 h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-40">
          <div className={`px-5 py-4 border-b border-gray-200 flex items-center gap-3 rounded-t-2xl ${cfg.headerBg}`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {cfg.name[0]}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{cfg.name} — PropAIrty Assistant</p>
              <p className="text-white/70 text-xs">AI-powered · Live portfolio data · Trend charts</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((m, i) => <Message key={i} msg={m} cfg={cfg} />)}
            {loading && <TypingIndicator cfg={cfg} />}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)}
                  className={`text-xs border px-2.5 py-1.5 rounded-full transition-colors text-left ${cfg.suggestionStyle}`}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Ask ${cfg.name} anything about your portfolio…`}
                rows={1}
                className={`flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${cfg.ringColor} max-h-24 overflow-y-auto`}
                disabled={loading}
              />
              {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                <button
                  onClick={toggleVoice}
                  disabled={loading}
                  title={listening ? 'Stop listening' : 'Speak your question'}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border ${
                    listening
                      ? 'bg-red-500 border-red-500 text-white animate-pulse'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className={`w-9 h-9 ${cfg.buttonBg} disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}
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
