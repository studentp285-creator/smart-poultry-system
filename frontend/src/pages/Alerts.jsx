import { useEffect, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { database } from '../firebase'
import { markAllRead, deleteReadAlerts } from '../services/api'
import { useToast } from '../context/ToastContext'

const CFG = {
  critical: { icon: '🚨', badge: 'bg-red-400/10 text-red-300 border-red-400/25',    dot: 'bg-red-400',    label: 'Critical' },
  warning:  { icon: '⚠️', badge: 'bg-amber-400/10 text-amber-300 border-amber-400/25', dot: 'bg-amber-400', label: 'Warning' },
  info:     { icon: 'ℹ️', badge: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/25',  dot: 'bg-cyan-400',   label: 'Info'     },
}

function ConfirmModal({ count, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a1628] border border-cyan-400/[0.12] rounded-2xl shadow-2xl shadow-black/70 p-6 max-w-sm w-full">
        <div className="w-12 h-12 bg-amber-400/[0.10] border border-amber-400/20 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🔔</div>
        <h3 className="text-white/90 font-bold text-lg text-center mb-1">Mark all as read?</h3>
        <p className="text-white/65 text-sm text-center mb-6">
          This will mark <span className="font-semibold text-white/80">{count} alert{count !== 1 ? 's' : ''}</span> as read.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/65 font-semibold text-sm hover:bg-white/[0.05] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors active:scale-95">
            Yes, mark all
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Alerts() {
  const { showToast } = useToast()
  const [alerts,      setAlerts]      = useState([])
  const [clearing,    setClearing]    = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), snap => {
      const data = snap.val()
      if (!data) { setAlerts([]); return }
      setAlerts(Object.entries(data)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
    })
    return () => unsub()
  }, [])

  const dismiss = id => {
    update(ref(database, `poultry/alerts/${id}`), { is_read: true })
    showToast('Alert dismissed', 'info')
  }

  const dismissAll = async () => {
    setConfirmOpen(false)
    setClearing(true)
    try {
      await markAllRead()
      showToast('All alerts marked as read', 'success')
    } catch {
      showToast('Failed to clear alerts — is Django running?', 'error')
    }
    setClearing(false)
  }

  const deleteRead = async () => {
    setDeleting(true)
    try {
      await deleteReadAlerts()
      showToast('Read alerts deleted', 'success')
    } catch {
      showToast('Failed to delete — is Django running?', 'error')
    }
    setDeleting(false)
  }

  const unread  = alerts.filter(a => !a.is_read).length
  const visible = filter === 'all'    ? alerts
    : filter === 'unread'             ? alerts.filter(a => !a.is_read)
    : alerts.filter(a => a.severity === filter)

  return (
    <div>
      {confirmOpen && (
        <ConfirmModal count={unread} onConfirm={dismissAll} onCancel={() => setConfirmOpen(false)} />
      )}

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Alerts</h1>
          <p className="text-white/65 text-sm mt-0.5">
            {unread > 0 ? `${unread} unread alert${unread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          {alerts.some(a => a.is_read) && (
            <button onClick={deleteRead} disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-400/[0.08] border border-red-400/20 text-red-300 hover:bg-red-400/[0.15] text-sm font-semibold transition-colors disabled:opacity-50">
              {deleting
                ? <span className="w-4 h-4 border-2 border-red-400/40 border-t-red-300 rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>}
              Delete Read
            </button>
          )}
          {unread > 0 && (
            <button onClick={() => setConfirmOpen(true)} disabled={clearing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400/[0.08] border border-cyan-400/20 text-cyan-300 hover:bg-cyan-400/[0.15] text-sm font-semibold transition-colors disabled:opacity-50">
              {clearing
                ? <span className="w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-300 rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all',      label: `All (${alerts.length})` },
          { key: 'unread',   label: `Unread (${unread})` },
          { key: 'critical', label: 'Critical' },
          { key: 'warning',  label: 'Warning' },
          { key: 'info',     label: 'Info' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              filter === t.key
                ? 'bg-cyan-400/[0.12] border-cyan-400/30 text-cyan-300'
                : 'bg-white/[0.04] border-white/10 text-white/65 hover:bg-white/[0.08] hover:text-white/90'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-400/[0.10] border border-emerald-400/20 flex items-center justify-center text-3xl mb-4">✅</div>
          <p className="text-white/80 font-bold text-lg">No alerts here</p>
          <p className="text-white/60 text-sm mt-1">Your farm is running smoothly</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(a => {
            const cfg = CFG[a.severity] || CFG.info
            return (
              <div key={a.id}
                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-colors ${
                  a.is_read
                    ? 'bg-white/[0.02] border-white/[0.04] opacity-50'
                    : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]'
                }`}>

                <div className="mt-1.5 flex-shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full block ${a.is_read ? 'bg-white/20' : cfg.dot}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${cfg.badge}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-white/55 text-xs ml-auto">
                      {a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${a.is_read ? 'text-white/55' : 'text-white/85'}`}>{a.message}</p>
                  {a.sensor && <p className="text-white/55 text-xs mt-0.5">Sensor: {a.sensor}</p>}
                </div>

                {!a.is_read && (
                  <button onClick={() => dismiss(a.id)}
                    className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors p-1 mt-0.5 rounded-lg hover:bg-white/[0.06]"
                    title="Dismiss">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
