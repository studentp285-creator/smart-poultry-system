import { useState, useEffect } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { database } from '../firebase'
import { markAllRead, deleteAllAlerts } from '../services/api'

const SEV = {
  critical: { icon: '🚨', badge: 'bg-red-400/10 text-red-400 border-red-400/25', dot: 'bg-red-400', left: 'border-l-red-400' },
  warning:  { icon: '⚠️', badge: 'bg-amber-400/10 text-amber-400 border-amber-400/25', dot: 'bg-amber-400', left: 'border-l-amber-400' },
  info:     { icon: 'ℹ️', badge: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/25', dot: 'bg-cyan-400', left: 'border-l-cyan-400' },
}

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function AlertPanel({ compact = false }) {
  const [alerts,        setAlerts]        = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), snap => {
      const data = snap.val()
      if (!data) { setAlerts([]); return }
      setAlerts(Object.entries(data).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
    })
    return () => unsub()
  }, [])

  const dismiss    = id => update(ref(database, `poultry/alerts/${id}`), { is_read: true })
  const dismissAll = () => markAllRead()
  const confirmAndDelete = () => { deleteAllAlerts(); setConfirmDelete(false) }

  const unread    = alerts.filter(a => !a.is_read).length
  const displayed = compact ? alerts.slice(0, 5) : alerts

  return (
    <div className="card h-full flex flex-col relative">
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-400/25 rounded-2xl p-5 mx-4 w-full max-w-xs shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🗑️</span>
              <h4 className="font-bold text-white/90 text-sm">Delete all alerts?</h4>
            </div>
            <p className="text-white/60 text-xs mb-4">This cannot be undone. All alert history will be permanently removed.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.10] text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndDelete}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-400/25 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-400/[0.10] border border-red-400/20 rounded-xl flex items-center justify-center text-base">🔔</div>
          <h3 className="font-bold text-white/90 text-sm">Alerts</h3>
          {unread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={dismissAll} className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              Mark all read
            </button>
          )}
          {alerts.length > 0 && (
            <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-red-400/70 hover:text-red-400 font-semibold transition-colors">
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-emerald-400/[0.10] border border-emerald-400/20 rounded-2xl flex items-center justify-center text-2xl mb-3">✅</div>
            <p className="text-white/80 text-sm font-semibold">All clear</p>
            <p className="text-white/55 text-xs mt-0.5">No active alerts</p>
          </div>
        ) : (
          displayed.map(alert => {
            const cfg = SEV[alert.severity] || SEV.info
            return (
              <div key={alert.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border-l-[3px] border border-white/[0.08]
                  transition-colors duration-100 ${cfg.left}
                  ${alert.is_read ? 'bg-white/[0.02] opacity-50' : 'bg-white/[0.05] hover:bg-white/[0.08]'}`}>
                <div className="mt-[5px] flex-shrink-0">
                  <span className={`w-2 h-2 rounded-full block ${alert.is_read ? 'bg-white/30' : cfg.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${cfg.badge}`}>
                      {cfg.icon} {alert.severity}
                    </span>
                    <span className="text-white/55 text-[10px] font-medium ml-auto">
                      {alert.timestamp ? timeAgo(alert.timestamp) : ''}
                    </span>
                  </div>
                  <p className={`text-xs leading-snug ${alert.is_read ? 'text-white/50' : 'text-white/85 font-medium'}`}>
                    {alert.message}
                  </p>
                </div>
                {!alert.is_read && (
                  <button onClick={() => dismiss(alert.id)}
                    className="flex-shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5 p-0.5 rounded"
                    title="Dismiss">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
