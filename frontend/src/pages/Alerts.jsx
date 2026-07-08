import { useEffect, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { database } from '../firebase'
import { markAllRead } from '../services/api'
import { useToast } from '../context/ToastContext'

const CFG = {
  critical: { icon: '🚨', badge: 'bg-red-100 text-red-700 border-red-200',      dot: 'bg-red-500',    label: 'Critical' },
  warning:  { icon: '⚠️', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500',  label: 'Warning'  },
  info:     { icon: 'ℹ️', badge: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500',   label: 'Info'     },
}

function ConfirmModal({ count, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🔔</div>
        <h3 className="text-slate-900 font-bold text-lg text-center mb-1">Mark all as read?</h3>
        <p className="text-slate-500 text-sm text-center mb-6">
          This will mark <span className="font-semibold text-slate-700">{count} alert{count !== 1 ? 's' : ''}</span> as read. You can still see them in the list.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all active:scale-95">
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
  const [filter,      setFilter]      = useState('all')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), snap => {
      const data = snap.val()
      if (!data) { setAlerts([]); return }
      const list = Object.entries(data)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setAlerts(list)
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

  const unread  = alerts.filter(a => !a.is_read).length
  const visible = filter === 'all'    ? alerts
    : filter === 'unread'             ? alerts.filter(a => !a.is_read)
    : alerts.filter(a => a.severity === filter)

  return (
    <div>
      {confirmOpen && (
        <ConfirmModal
          count={unread}
          onConfirm={dismissAll}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Alerts</h1>
          <p className="text-white/60 text-sm mt-0.5">
            {unread > 0 ? `${unread} unread alert${unread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={() => setConfirmOpen(true)} disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 border border-green-200 text-green-700 hover:bg-green-200 text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-50">
            {clearing
              ? <span className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            Mark all read
          </button>
        )}
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filter === t.key
                ? 'bg-green-100 border-green-200 text-green-700'
                : 'bg-white/15 border-white/20 text-white hover:bg-white/25'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center text-3xl mb-4">✅</div>
          <p className="text-white font-bold text-lg">No alerts here</p>
          <p className="text-white/60 text-sm mt-1">Your farm is running smoothly</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(a => {
            const cfg = CFG[a.severity] || CFG.info
            return (
              <div key={a.id}
                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all ${
                  a.is_read
                    ? 'bg-slate-50 border-slate-100 opacity-70'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}>

                <div className="mt-1.5 flex-shrink-0">
                  {!a.is_read
                    ? <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} block`} />
                    : <span className="w-2.5 h-2.5 rounded-full bg-slate-300 block" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${cfg.badge}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-slate-400 text-xs">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</span>
                  </div>
                  <p className={`text-sm font-semibold ${a.is_read ? 'text-slate-500' : 'text-slate-800'}`}>{a.message}</p>
                  {a.sensor && <p className="text-slate-400 text-xs mt-0.5">Sensor: {a.sensor}</p>}
                </div>

                {!a.is_read && (
                  <button onClick={() => dismiss(a.id)}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors p-1 mt-0.5 rounded-lg hover:bg-slate-100"
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
