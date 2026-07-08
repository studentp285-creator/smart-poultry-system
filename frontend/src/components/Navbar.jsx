import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const navItems = [
  { to: '/',        label: 'Dashboard' },
  { to: '/history', label: 'History' },
  { to: '/settings',label: 'Settings' },
]

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const [unread, setUnread] = useState(0)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const alertsRef = ref(database, 'poultry/alerts')
    const unsub = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) { setUnread(0); return }
      const count = Object.values(data).filter((a) => !a.is_read).length
      setUnread(count)
    })
    return () => unsub()
  }, [])

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <Logo size={36} className="rounded-xl shadow-md shadow-green-900/30" />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Smart Poultry Monitor</p>
              <p className="text-gray-500 text-xs">IoT Environmental Control System</p>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 relative ${
                    isActive
                      ? 'bg-green-600/20 text-green-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {item.label}
                {item.to === '/history' && unread > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {unread}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          {/* User menu */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((s) => !s)}
                className="flex items-center gap-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                  {initials(user.displayName || user.email)}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-white text-xs font-medium leading-tight max-w-[120px] truncate">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-gray-500 text-xs max-w-[120px] truncate">{user.email}</p>
                </div>
                <span className="text-gray-500 text-xs ml-1">▾</span>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-white text-sm font-semibold truncate">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <NavLink
                        to="/settings"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors"
                      >
                        ⚙️ Settings
                      </NavLink>
                      <button
                        onClick={() => { logout(); setShowMenu(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-white hover:bg-red-500/20 text-sm transition-colors text-left"
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </nav>
  )
}
