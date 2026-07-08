import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

const BADGES = [
  { icon: '🌡️', text: 'Real-time Temperature' },
  { icon: '💨', text: 'Auto Ventilation' },
  { icon: '🧠', text: 'AI Recommendations' },
  { icon: '📡', text: 'ESP32 IoT Sensors' },
]

const FRIENDLY = {
  'auth/user-not-found':        'No account found with this email.',
  'auth/wrong-password':        'Incorrect password. Please try again.',
  'auth/invalid-email':         'Enter a valid email address.',
  'auth/invalid-credential':    'Wrong email or password.',
  'auth/too-many-requests':     'Too many attempts. Wait a moment.',
  'auth/network-request-failed':'Network error. Check your connection.',
}

function Eye({ show }) {
  return show
    ? <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

export default function Login() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [resetMode, setResetMode]     = useState(false)
  const [resetEmail, setResetEmail]   = useState('')
  const [resetStatus, setResetStatus] = useState(null)
  const [resetLoading, setResetLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(FRIENDLY[err.code] || 'Wrong email or password.')
    }
    setLoading(false)
  }

  const handleReset = async e => {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetStatus(null)
    try {
      await resetPassword(resetEmail.trim())
      setResetStatus('sent')
    } catch {
      setResetStatus('error')
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">

      {/* ── BACKGROUND ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: 'url(/farm-bg.jpg), linear-gradient(135deg,#071a0d,#0d2b16,#0a1f0e)' }}
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 bg-gradient-to-br from-green-950/20 via-transparent to-black/35" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)' }} />

      {/* ── GLASS CARD ── */}
      <div className="relative z-10 w-full max-w-5xl flex rounded-[2rem] overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.08)' }}>

        {/* ═══ LEFT — BRANDING ═══ */}
        <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12"
          style={{ background: 'linear-gradient(135deg, rgba(10,30,15,0.95) 0%, rgba(5,20,10,0.90) 100%)', backdropFilter: 'blur(20px)' }}>

          <div className="absolute top-0 left-0 w-72 h-72 bg-green-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-emerald-600/10 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3">
            <Logo size={44} className="rounded-2xl shadow-lg shadow-green-900/50" />
            <div>
              <p className="text-white font-extrabold text-lg tracking-tight">
                Smart <span className="text-green-400">Poultry</span>
              </p>
              <p className="text-white/40 text-[11px] font-medium tracking-widest uppercase">Management System</p>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3.5 py-1.5 w-fit mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 text-xs font-semibold tracking-wide">Sensors Live · All Systems Online</span>
            </div>

            <h1 className="text-[2.6rem] font-black text-white leading-[1.1] mb-5 tracking-tight">
              Smarter Farming<br />
              Starts <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">Right Here</span>
            </h1>

            <p className="text-white/50 text-[15px] leading-relaxed max-w-sm mb-10">
              Take full control of your poultry environment — monitor temperature,
              air quality, feed and water levels 24/7 from any device, powered by
              AI and real-time IoT sensors.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {BADGES.map(b => (
                <div key={b.text}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 border border-white/5"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-white/70 text-xs font-medium">{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-6 pt-6 border-t border-white/5">
            {[['99.9%','Uptime'],['&lt;1s','Response'],['24/7','Monitoring']].map(([val, lbl]) => (
              <div key={lbl}>
                <p className="text-green-400 font-bold text-lg" dangerouslySetInnerHTML={{ __html: val }} />
                <p className="text-white/30 text-xs">{lbl}</p>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-green-300 text-xs font-semibold">Secure</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — FORM ═══ */}
        <div className="w-full lg:w-[48%] flex flex-col justify-center px-8 sm:px-12 py-12"
          style={{ background: 'rgba(8,18,10,0.92)', backdropFilter: 'blur(32px)' }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <Logo size={36} className="rounded-xl" />
            <p className="text-white font-bold">Smart <span className="text-green-400">Poultry</span></p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white mb-1 tracking-tight">Sign In to Your Farm</h2>
            <p className="text-white/50 text-sm">Monitor your poultry environment in real time</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 mb-6">
              <span className="text-red-400 text-lg">⚠️</span>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </span>
                <input
                  type="email" required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-green-400/60 focus:bg-white/8 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
                <input
                  type={showPw ? 'text' : 'password'} required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-2xl pl-11 pr-12 py-3.5 text-sm focus:outline-none focus:border-green-400/60 focus:bg-white/8 focus:ring-1 focus:ring-green-400/20 transition-all duration-200"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  <Eye show={showPw} />
                </button>
              </div>
            </div>

            {/* Forgot password */}
            {!resetMode && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-white/40 text-xs">Forgot your password?</span>
                <button type="button" onClick={() => { setResetMode(true); setResetStatus(null) }}
                  className="text-green-400 text-xs font-semibold hover:text-green-300 transition-colors">
                  Reset it here →
                </button>
              </div>
            )}

            {resetMode && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-white/80 text-xs font-semibold">Enter your email to receive a reset link:</p>
                {resetStatus === 'sent' ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                    <span>✅</span>
                    <span>Reset link sent! Check your inbox.</span>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="flex gap-2">
                    <input
                      type="email" required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 bg-white/5 border border-white/15 text-white placeholder-white/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-400/60"
                    />
                    <button type="submit" disabled={resetLoading}
                      className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50">
                      {resetLoading ? '…' : 'Send'}
                    </button>
                  </form>
                )}
                {resetStatus === 'error' && (
                  <p className="text-red-400 text-xs">Could not send reset email. Check the address.</p>
                )}
                <button type="button" onClick={() => { setResetMode(false); setResetStatus(null) }}
                  className="text-white/40 hover:text-white/70 text-xs transition-colors">
                  ← Back to sign in
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-3 transition-all duration-200 mt-2 ${
                loading
                  ? 'bg-green-900/50 text-green-400/60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-xl shadow-green-900/40 active:scale-[0.98]'
              }`}
            >
              {loading
                ? <><span className="w-5 h-5 border-2 border-green-400/40 border-t-green-300 rounded-full animate-spin" />Signing in…</>
                : <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>Access My Dashboard</>
              }
            </button>
          </form>

          <p className="text-center text-white/25 text-xs mt-10">
            Smart Poultry Management System · Secure · Real-time · AI-Powered
          </p>
        </div>
      </div>

      <p className="relative z-10 text-white/60 text-xs mt-6 text-center tracking-wide">
        © 2025 Smart Poultry Management System · All rights reserved
      </p>
    </div>
  )
}
