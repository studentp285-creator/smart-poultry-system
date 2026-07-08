import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import { controlVentilation } from '../services/api'
import { useToast } from '../context/ToastContext'

function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleTimeString()
}

export default function VentilationControl() {
  const { showToast } = useToast()
  const [status,  setStatus]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [tick,    setTick]    = useState(0)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/ventilation'), (snap) => {
      setStatus(snap.val())
    })
    return () => unsub()
  }, [])

  // Live "X ago" counter
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const handle = async (action) => {
    setLoading(true)
    try {
      await controlVentilation(action)
      showToast(
        action === 'open' ? '🪟 Windows opened manually' : '🚪 Windows closed manually',
        'success'
      )
    } catch {
      showToast('Failed to control ventilation — is Django running?', 'error')
    }
    setLoading(false)
  }

  const isOpen  = status?.is_open
  const isAuto  = status?.changed_by === 'auto'
  const reason  = status?.reason || ''
  const lastChanged = status?.last_changed

  return (
    <div className="card flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">💨</div>
        <h3 className="font-semibold text-slate-900">Ventilation Control</h3>
      </div>

      {/* Status display */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Window Status</p>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className={`text-xl font-black tracking-tight ${isOpen ? 'text-green-600' : 'text-slate-500'}`}>
              {isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          {lastChanged && (
            <p className="text-xs text-slate-400 mt-1">
              Changed {timeAgo(lastChanged)}
            </p>
          )}
        </div>

        {/* SVG ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="38"
              fill="none"
              stroke={isOpen ? '#22c55e' : '#cbd5e1'}
              strokeWidth="10"
              strokeDasharray={`${isOpen ? 239 : 0} 239`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            {isOpen ? '🪟' : '🚪'}
          </div>
        </div>
      </div>

      {/* Auto / Manual badge */}
      {status && (
        <div className={`rounded-xl px-3 py-2.5 border text-xs font-semibold flex items-start gap-2 ${
          isAuto
            ? isOpen
              ? 'bg-orange-50 border-orange-200 text-orange-700'
              : 'bg-green-50 border-green-200 text-green-700'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <span className="mt-0.5 flex-shrink-0 text-sm">{isAuto ? '🤖' : '👤'}</span>
          <div>
            <p className="font-bold">
              {isAuto ? 'Automatic Control' : 'Manual Control'}
            </p>
            {reason && (
              <p className="font-normal mt-0.5 leading-relaxed opacity-90">{reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Auto override warning */}
      {isAuto && isOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
          <span className="flex-shrink-0">⚠️</span>
          <span>Auto-control is active. Windows will auto-close once conditions return to safe levels.</span>
        </div>
      )}

      {/* Control buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handle('open')}
          disabled={loading || isOpen}
          className={`py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            loading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : isOpen
              ? 'bg-green-100 text-green-600 cursor-not-allowed border border-green-200'
              : 'bg-green-600 hover:bg-green-700 active:scale-95 text-white shadow-sm'
          }`}
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : '🪟'}
          Open
        </button>

        <button
          onClick={() => handle('close')}
          disabled={loading || !isOpen}
          className={`py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            loading
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : !isOpen
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-slate-700 hover:bg-slate-800 active:scale-95 text-white shadow-sm'
          }`}
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : '🚪'}
          Close
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center -mt-1">
        Auto-opens: temp &gt; 35°C · humidity &gt; 70% · gas &gt; 50 ppm
      </p>
    </div>
  )
}
