import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

// ── In-app Alert Popup (critical / warning from sensors) ─────────────────────

const ALERT_CFG = {
  critical: {
    border:  'border-red-500/50',
    glow:    '0 0 0 1px rgba(239,68,68,0.3), 0 20px 40px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.12)',
    header:  'text-red-300',
    dot:     'bg-red-400',
    badge:   'bg-red-500/[0.12] border-red-400/30 text-red-300',
    icon:    '🚨',
    label:   'CRITICAL',
    autoDismiss: 15000,   // longer than warning/info, but still auto-clears if left unattended
  },
  warning: {
    border:  'border-amber-500/40',
    glow:    '0 0 0 1px rgba(245,158,11,0.25), 0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(245,158,11,0.08)',
    header:  'text-amber-300',
    dot:     'bg-amber-400',
    badge:   'bg-amber-500/[0.10] border-amber-400/25 text-amber-300',
    icon:    '⚠️',
    label:   'WARNING',
    autoDismiss: 8000,
  },
  info: {
    border:  'border-cyan-500/30',
    glow:    '0 0 0 1px rgba(34,211,238,0.15), 0 16px 32px rgba(0,0,0,0.6)',
    header:  'text-cyan-300',
    dot:     'bg-cyan-400',
    badge:   'bg-cyan-500/[0.08] border-cyan-400/20 text-cyan-300',
    icon:    'ℹ️',
    label:   'INFO',
    autoDismiss: 5000,
  },
}

function AlertPopup({ item, dismiss }) {
  const cfg = ALERT_CFG[item.severity] || ALERT_CFG.info
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border ${cfg.border} overflow-hidden`}
      style={{
        background: 'linear-gradient(135deg, rgba(8,18,40,0.97) 0%, rgba(10,22,48,0.97) 100%)',
        backdropFilter: 'blur(24px)',
        boxShadow: cfg.glow,
        animation: 'alertSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Severity stripe */}
      <div className={`h-[3px] ${cfg.dot} opacity-70`} />

      <div className="px-4 py-3.5 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${item.severity === 'critical' ? 'animate-ping' : 'animate-pulse'}`} />
          <span className={`text-xs font-black tracking-widest uppercase ${cfg.header}`}>{cfg.label}</span>
          <button
            onClick={() => dismiss(item.id)}
            className="ml-auto text-white/25 hover:text-white/60 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Message */}
        <p className="text-white/85 text-sm font-medium leading-snug">{item.message}</p>

        {/* Footer: sensor badge + dismiss button */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {item.sensor && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.badge} uppercase tracking-wide`}>
              {cfg.icon} {item.sensor}
            </span>
          )}
          {item.severity === 'critical' && (
            <button
              onClick={() => dismiss(item.id)}
              className="ml-auto text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small Action Toast (success / error / info from UI actions) ───────────────

const TOAST_CFG = {
  success: {
    border: 'border-l-4 border-emerald-500',
    bg:     'bg-[#0a1e14]',
    icon:   <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
    text:   'text-emerald-300',
  },
  error: {
    border: 'border-l-4 border-red-500',
    bg:     'bg-[#1e0a0a]',
    icon:   <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    text:   'text-red-300',
  },
  info: {
    border: 'border-l-4 border-cyan-500',
    bg:     'bg-[#061418]',
    icon:   <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    text:   'text-cyan-300',
  },
  warning: {
    border: 'border-l-4 border-amber-500',
    bg:     'bg-[#18110a]',
    icon:   <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
    text:   'text-amber-300',
  },
}

function ToastItem({ toast, dismiss }) {
  const cfg = TOAST_CFG[toast.type] || TOAST_CFG.info
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] shadow-lg min-w-[260px] max-w-xs ${cfg.bg}`}
      style={{
        backdropFilter: 'blur(16px)',
        animation: 'alertSlideIn 0.25s ease-out both',
      }}
    >
      <div className={`flex-shrink-0 ${cfg.border.replace('border-l-4 ', '')} `}>
        {cfg.icon}
      </div>
      <p className={`flex-1 text-sm font-semibold leading-snug ${cfg.text}`}>{toast.message}</p>
      <button onClick={() => dismiss(toast.id)} className="text-white/25 hover:text-white/50 transition-colors flex-shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [alerts, setAlerts] = useState([])   // sensor alert popups (top-right)
  const [toasts, setToasts] = useState([])   // action feedback (bottom-right)

  const dismissAlert = useCallback((id) => setAlerts(a => a.filter(x => x.id !== id)), [])
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  // For sensor alert popups (critical / warning / info severity from Firebase)
  const showAlert = useCallback((message, severity = 'info', sensor = '') => {
    const id  = Date.now() + Math.random()
    const cfg = ALERT_CFG[severity] || ALERT_CFG.info
    setAlerts(a => [{ id, message, severity, sensor }, ...a].slice(0, 5))
    if (cfg.autoDismiss) {
      setTimeout(() => dismissAlert(id), cfg.autoDismiss)
    }
  }, [dismissAlert])

  // For UI action feedback (success / error / info / warning from user actions)
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => dismissToast(id), 3500)
  }, [dismissToast])

  return (
    <ToastContext.Provider value={{ showToast, showAlert }}>
      {children}

      <style>{`
        @keyframes alertSlideIn {
          from { opacity: 0; transform: translateX(24px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>

      {/* Alert popups — top-right, stacked downward, max 5 */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2.5 items-end pointer-events-none" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {alerts.map(item => (
          <div key={item.id} className="pointer-events-auto w-full max-w-sm">
            <AlertPopup item={item} dismiss={dismissAlert} />
          </div>
        ))}
      </div>

      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} dismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast  = () => useContext(ToastContext)
export const useAlert  = () => {
  const ctx = useContext(ToastContext)
  return ctx?.showAlert
}
