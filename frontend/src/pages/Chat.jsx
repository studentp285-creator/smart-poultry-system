import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendChatMessage } from '../services/api'
import Logo from '../components/Logo'

const MAX_CHARS = 500

const SUGGESTIONS = [
  { icon: '📊', label: 'Current farm status',     q: 'What is the current farm status?' },
  { icon: '🌡️', label: 'Temperature guide',        q: 'Explain the temperature guide' },
  { icon: '💨', label: 'How ventilation works',    q: 'How does the ventilation system work?' },
  { icon: '🔔', label: 'Understanding alerts',     q: 'What do the alerts mean?' },
  { icon: '☁️', label: 'Gas level safety',         q: 'Gas level safety information' },
  { icon: '📟', label: 'ESP32 hardware setup',     q: 'ESP32 hardware setup' },
]

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function BotMessage({ text, time }) {
  return (
    <div className="flex items-end gap-2.5 group animate-fade-up">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-base flex-shrink-0 shadow-md shadow-green-200 mb-0.5 ring-2 ring-white">
        <Logo size={32} plain />
      </div>

      <div className="flex flex-col gap-1 max-w-[80%] sm:max-w-[75%]">
        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
          <pre className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans break-words">
            {text}
          </pre>
        </div>
        <span className="text-slate-400 text-[10px] pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Smart Poultry · {fmtTime(time)}
        </span>
      </div>
    </div>
  )
}

function UserMessage({ text, avatar, time }) {
  return (
    <div className="flex items-end gap-2.5 flex-row-reverse group animate-fade-up">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-md shadow-green-200 mb-0.5 ring-2 ring-white">
        {avatar}
      </div>

      <div className="flex flex-col gap-1 items-end max-w-[80%] sm:max-w-[75%]">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl rounded-br-sm px-4 py-3 shadow-md shadow-green-200">
          <p className="text-white text-sm leading-relaxed">{text}</p>
        </div>
        <span className="text-slate-400 text-[10px] pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          You · {fmtTime(time)}
        </span>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 animate-fade-up">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-base flex-shrink-0 shadow-md shadow-green-200 mb-0.5 ring-2 ring-white">
        <Logo size={32} plain />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 bg-green-400 rounded-full"
              style={{
                animation: 'typing-dot 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SuggestionCard({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 bg-white hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-2xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] group shadow-sm hover:shadow-md"
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <span className="text-slate-700 group-hover:text-green-700 text-sm font-semibold leading-tight">{label}</span>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-green-500 ml-auto flex-shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  )
}

const WELCOME = `Hello! 👋 I'm your Smart Poultry Assistant.

I can help you understand your sensor readings, ventilation system, alerts, thresholds, and hardware setup.

Select a topic below or type your own question to get started.`

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME, time: new Date() }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }
  }

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    resetHeight()
    setMessages(m => [...m, { role: 'user', text: msg, time: new Date() }])
    setLoading(true)

    try {
      // Send last 20 messages as history (skip the initial welcome message)
      const history = messages
        .slice(1)
        .slice(-20)
        .map(m => ({ role: m.role, text: m.text }))
      const { data } = await sendChatMessage(msg, history)
      await new Promise(r => setTimeout(r, 700))
      setMessages(m => [...m, { role: 'bot', text: data.reply || 'Sorry, I could not process that.', time: new Date() }])
    } catch {
      setMessages(m => [...m, {
        role: 'bot',
        text: '⚠️ Connection error — make sure the Django backend is running on port 8000.',
        time: new Date(),
      }])
    }

    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [input, loading])

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([{ role: 'bot', text: WELCOME, time: new Date() }])
    setInput('')
    resetHeight()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const avatar = initials(user?.displayName || user?.email)
  const showSuggestions = messages.length === 1

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
          30%            { transform: translateY(-6px); opacity: 1;   }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .animate-fade-up { animation: fade-up 0.25s ease-out forwards; }
      `}</style>

      <div className="flex flex-col h-[calc(100vh-7rem)] max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-3 overflow-hidden">
          {/* Top colour strip */}
          <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400" />

          <div className="flex items-center gap-4 px-5 py-4">
            {/* Bot avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-2xl shadow-lg shadow-green-200 ring-2 ring-white">
                <Logo size={32} plain />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
            </div>

            {/* Name + subtitle */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight">Smart Poultry Assistant</h1>
              <p className="text-slate-500 text-xs mt-0.5">Poultry monitoring expert · Always available</p>
            </div>

            {/* Status + clear */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-700 text-[11px] font-bold">Online</span>
              </div>
              <button
                onClick={clearChat}
                title="Clear chat"
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Messages area ── */}
        <div
          className="flex-1 overflow-y-auto space-y-4 px-1 pb-3 scroll-smooth"
          style={{
            backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '12px',
          }}
        >
          {messages.map((m, i) => (
            m.role === 'bot'
              ? <BotMessage key={i} text={m.text} time={m.time} />
              : <UserMessage key={i} text={m.text} avatar={avatar} time={m.time} />
          ))}

          {loading && <TypingIndicator />}

          {/* Suggestion cards — first screen only */}
          {showSuggestions && !loading && (
            <div className="pt-2 animate-fade-up">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-slate-400 text-xs font-semibold px-2">Quick topics</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map(s => (
                  <SuggestionCard
                    key={s.q}
                    icon={s.icon}
                    label={s.label}
                    onClick={() => send(s.q)}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
          <div className="flex items-end gap-3">
            {/* User avatar */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm mb-0.5">
              {avatar}
            </div>

            {/* Textarea */}
            <textarea
              ref={el => { inputRef.current = el; textareaRef.current = el }}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value.slice(0, MAX_CHARS))
                e.target.style.height = '44px'
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
              }}
              onKeyDown={onKey}
              placeholder="Ask me anything about your poultry farm…"
              disabled={loading}
              className="flex-1 resize-none bg-slate-50 border border-slate-200 focus:border-green-400 focus:ring-2 focus:ring-green-100 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm leading-relaxed transition-all outline-none disabled:opacity-50 min-h-[44px]"
              style={{ height: '44px' }}
            />

            {/* Send button */}
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-sm mb-0.5
                disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none
                bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-green-200"
              title="Send (Enter)"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : (
                  <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                )
              }
            </button>
          </div>

          {/* Hint row */}
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-slate-400 text-[11px]">
              <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono text-[10px] text-slate-500">Enter</kbd>
              {' '}to send ·{' '}
              <kbd className="bg-slate-100 border border-slate-200 rounded px-1 font-mono text-[10px] text-slate-500">Shift+Enter</kbd>
              {' '}new line
            </span>
            <span className={`text-[11px] transition-colors ${input.length > 400 ? 'text-red-400 font-semibold' : input.length > 300 ? 'text-amber-500' : 'text-slate-300'}`}>
              {input.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
