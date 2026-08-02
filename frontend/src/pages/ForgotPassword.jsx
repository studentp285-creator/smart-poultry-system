import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkEmailRegistered } from '../services/api'
import Logo from '../components/Logo'
import ParticleBackground from '../components/ParticleBackground'

const FRIENDLY = {
  'auth/user-not-found':         'No account found with this email.',
  'auth/invalid-email':          'Enter a valid email address.',
  'auth/too-many-requests':      'Too many attempts. Wait a moment.',
  'auth/network-request-failed': 'Network error. Check your connection.',
}

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState(null) // 'sent' | 'error' | null
  const [error, setError]     = useState('')

  const submit = async e => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setLoading(true)
    setStatus(null)
    setError('')
    try {
      const { data } = await checkEmailRegistered(trimmed)
      if (!data.registered) {
        setStatus('error')
        setError('This email address is not registered. Check for typos or create an account first.')
        setLoading(false)
        return
      }
      await resetPassword(trimmed)
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(FRIENDLY[err.code] || 'Could not send reset email. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">

      {/* ── BACKGROUND — farm photo ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 pointer-events-none"
        style={{
          backgroundImage: 'url(/farm-bg.jpg)',
          filter: 'brightness(0.38) saturate(0.7)',
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(160deg, rgba(6,15,28,0.68) 0%, rgba(8,18,38,0.52) 50%, rgba(6,15,28,0.72) 100%)' }} />
      <ParticleBackground />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(4,10,20,0.72) 100%)', zIndex: 3 }} />

      {/* ── GLASS CARD ── */}
      <div className="relative w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl"
        style={{ zIndex: 10, boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(34,211,238,0.06)' }}>

        <div className="flex flex-col px-8 sm:px-12 py-12"
          style={{ background: 'rgba(6,15,28,0.95)', backdropFilter: 'blur(32px)' }}>

          <div className="flex items-center gap-3 mb-8">
            <Logo size={40} className="rounded-xl shadow-lg shadow-cyan-900/40 ring-1 ring-cyan-400/20" />
            <p className="text-white font-bold">Smart <span className="text-cyan-400">Poultry</span></p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-white mb-1 tracking-tight">Reset Your Password</h2>
            <p className="text-white/65 text-sm">We'll email you a secure link to choose a new password</p>
          </div>

          {status === 'sent' ? (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-4 mb-2">
              <span className="text-emerald-400 text-lg">✅</span>
              <div>
                <p className="text-emerald-300 text-sm font-semibold">Reset link sent!</p>
                <p className="text-emerald-300/70 text-xs mt-1">Check {email} for instructions.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {status === 'error' && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                  <span className="text-red-400 text-lg">⚠️</span>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Email Address</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </span>
                  <input
                    type="email" required autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-cyan-400/60 focus:bg-white/8 focus:ring-1 focus:ring-cyan-400/20 transition-colors duration-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-3 transition-colors duration-100 ${
                  loading
                    ? 'bg-cyan-900/30 text-cyan-400/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black shadow-xl shadow-cyan-900/40 active:scale-[0.98]'
                }`}
              >
                {loading
                  ? <><span className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />Sending…</>
                  : 'Send Reset Link'
                }
              </button>
            </form>
          )}

          <Link to="/login" className="text-white/55 hover:text-white/80 text-xs transition-colors mt-8 inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to sign in
          </Link>
        </div>
      </div>

      <p className="relative text-white/65 text-xs mt-6 text-center tracking-wide" style={{ zIndex: 10 }}>
        © 2025 Smart Poultry Management System · All rights reserved
      </p>
    </div>
  )
}
