import { useState, useEffect } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { database } from '../firebase'
import { markAllRead, deleteAllAlerts } from '../services/api'

const severityConfig = {
  critical: { badge: 'badge-critical', icon: '🚨' },
  warning:  { badge: 'badge-warning',  icon: '⚠️' },
  info:     { badge: 'badge-info',     icon: 'ℹ️' },
}

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function AlertPanel({ compact = false }) {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), (snapshot) => {
      const data = snapshot.val()
      if (!data) { setAlerts([]); return }
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setAlerts(list)
    })
    return () => unsub()
  }, [])

  const dismiss      = (id) => update(ref(database, `poultry/alerts/${id}`), { is_read: true })
  const dismissAll   = () => markAllRead()
  const clearHistory = () => { if (window.confirm('Delete all alerts? This cannot be undone.')) deleteAllAlerts() }

  const unread    = alerts.filter((a) => !a.is_read).length
  const displayed = compact ? alerts.slice(0, 5) : alerts

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">🔔</div>
          <h3 className="font-semibold text-slate-900">Alerts</h3>
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={dismissAll} className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors">
              Mark all read
            </button>
          )}
          {alerts.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
              Clear history
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <span className="text-4xl mb-2">✅</span>
            <p className="text-sm font-medium text-slate-600">No alerts — all systems normal</p>
          </div>
        ) : (
          displayed.map((alert) => {
            const cfg = severityConfig[alert.severity] || severityConfig.info
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  alert.is_read
                    ? 'bg-slate-50 border-slate-100 opacity-60'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <span className="text-lg mt-0.5 flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cfg.badge}>{alert.severity}</span>
                    <span className="text-slate-500 text-xs capitalize">
                      {(alert.alert_type || '').replace('_', ' ')}
                    </span>
                    <span className="text-slate-400 text-xs ml-auto">
                      {alert.timestamp ? timeAgo(alert.timestamp) : ''}
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">{alert.message}</p>
                </div>
                {!alert.is_read && (
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="text-slate-400 hover:text-slate-700 flex-shrink-0 mt-0.5 transition-colors"
                    title="Dismiss"
                  >
                    ✕
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
