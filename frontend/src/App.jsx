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
import useNotifications from './hooks/useNotifications'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={48} className="rounded-2xl animate-pulse shadow-lg shadow-green-900/30" />
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
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
        {/* Background image — full colour, slight blur so cards stay sharp */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/farm-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(2px) brightness(0.75)',
            transform: 'scale(1.05)',
          }}
        />
        {/* Dark green overlay matching the hero */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/70 via-black/50 to-green-900/60 pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
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
