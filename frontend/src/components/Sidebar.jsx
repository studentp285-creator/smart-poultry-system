import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    to: '/alerts',
    label: 'Alerts',
    badge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'Assistant',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

const PAGE_TITLES = { '/': 'Dashboard', '/history': 'History', '/alerts': 'Alerts', '/chat': 'Assistant', '/settings': 'Settings' }

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const drawerRef = useRef(null)

  const [open,   setOpen]   = useState(false)
  const [unread, setUnread] = useState(0)

  // Close on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), snap => {
      const data = snap.val()
      setUnread(data ? Object.values(data).filter(a => !a.is_read).length : 0)
    })
    return () => unsub()
  }, [])

  const handleLogout = () => { setOpen(false); logout(); navigate('/login') }
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

  return (
    <>
      {/* ── TOP BAR (always visible) ── */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">

        {/* Left: hamburger + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <Logo size={28} className="rounded-lg shadow-md shadow-green-900/30" />
            <span className="text-slate-900 font-extrabold text-sm tracking-tight">
              Smart <span className="text-green-600">Poultry</span>
            </span>
          </div>
        </div>

        {/* Center: current page title */}
        <span className="text-slate-500 text-sm font-semibold hidden sm:block">{pageTitle}</span>

        {/* Right: alerts badge + user avatar */}
        <div className="flex items-center gap-2">
          <NavLink to="/alerts"
            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all">
            <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>

          {user && (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-xs font-black text-white shadow-md shadow-green-900/40 cursor-default" title={user.displayName || user.email}>
              {initials(user.displayName || user.email)}
            </div>
          )}
        </div>
      </header>

      {/* ── BACKDROP ── */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />

      {/* ── DRAWER ── */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 h-full z-50 w-[268px] flex flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Logo size={36} className="rounded-xl shadow-sm shadow-green-200" />
            <div>
              <p className="text-slate-900 font-extrabold text-sm tracking-tight">
                Smart <span className="text-green-600">Poultry</span>
              </p>
              <p className="text-slate-400 text-[10px] font-semibold tracking-widest uppercase">Management System</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Live badge */}
        <div className="mx-4 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-green-700 text-[11px] font-bold tracking-wide">All Sensors Online</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-3 pb-3">Main Menu</p>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-4 py-2.5 font-semibold text-sm transition-all duration-150 relative ${
                  isActive
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 rounded-r-full" />}
                  <span className={`flex-shrink-0 ${isActive ? 'text-green-600' : 'text-slate-400'}`}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                      {unread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        {user && (
          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0 shadow-sm">
                  {initials(user.displayName || user.email)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-slate-800 text-sm font-bold truncate">{user.displayName || 'User'}</p>
                  <p className="text-slate-400 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs font-bold transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
