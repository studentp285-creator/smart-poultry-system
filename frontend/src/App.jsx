import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import Logo from './components/Logo'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Alerts from './pages/Alerts'
import Chat from './pages/Chat'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import useNotifications from './hooks/useNotifications'
import ParticleBackground from './components/ParticleBackground'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#060f1c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={48} className="rounded-2xl animate-pulse shadow-lg shadow-cyan-900/40 ring-1 ring-cyan-400/20" />
          <div className="w-6 h-6 border-2 border-cyan-400/40 border-t-cyan-300 rounded-full animate-spin" />
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AppLayout() {
  useNotifications()
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 pt-14 min-h-screen relative">
        {/* Layer 1 — farm photo, darkened but chickens visible */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url(/farm-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            filter: 'brightness(0.38) saturate(0.7)',
            transform: 'scale(1.04)',
          }}
        />

        {/* Layer 2 — deep navy gradient so the edges are pure dark */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(160deg, rgba(6,15,28,0.68) 0%, rgba(8,18,38,0.52) 45%, rgba(6,15,28,0.72) 100%)',
            zIndex: 1,
          }}
        />

        {/* Layer 3 — animated cyan particle network (Pondus look) */}
        <ParticleBackground />

        {/* Layer 4 — subtle vignette so content edges stay dark */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(4,10,20,0.70) 100%)',
            zIndex: 3,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6" style={{ zIndex: 10 }}>
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/history"  element={<History />} />
            <Route path="/alerts"   element={<Alerts />} />
            <Route path="/chat"     element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </div>

      </main>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}
