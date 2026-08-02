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

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/ventilation'), snap => setStatus(snap.val()))
    return () => unsub()
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

  const isOpen      = status?.is_open
  const isAuto      = status?.changed_by === 'auto'
  const reason      = status?.reason || ''
  const lastChanged = status?.last_changed

  return (
    <div className="card flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-sky-400/[0.10] border border-sky-400/20 rounded-xl flex items-center justify-center text-base">
          💨
        </div>
        <div>
          <h3 className="font-bold text-white/90 text-sm leading-tight">Ventilation Control</h3>
          <p className="text-white/55 text-[10px]">Window servo motor</p>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest mb-1.5">Window Status</p>
          <div className="flex items-center gap-2 mb-1">
            <div className="relative">
              <span className={`w-3 h-3 rounded-full block ${isOpen ? 'bg-emerald-400' : 'bg-white/30'}`} />
              {isOpen && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
            <span className={`text-2xl font-black tracking-tight ${isOpen ? 'text-emerald-400' : 'text-white/55'}`}>
              {isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          {lastChanged && (
            <p className="text-white/55 text-xs">Changed {timeAgo(lastChanged)}</p>
          )}
        </div>

        {/* SVG ring indicator */}
        <div className="relative w-[72px] h-[72px] flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10"/>
            <circle
              cx="50" cy="50" r="38"
              fill="none"
              stroke={isOpen ? '#34d399' : 'rgba(255,255,255,0.12)'}
              strokeWidth="10"
              strokeDasharray={`${isOpen ? 239 : 0} 239`}
              strokeLinecap="round"
              className="transition-colors duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl pointer-events-none">
            {isOpen ? '🪟' : '🚪'}
          </div>
        </div>
      </div>

      {/* Auto/Manual badge */}
      {status && (
        <div className={`rounded-xl px-3 py-2.5 border text-xs font-semibold flex items-start gap-2 ${
          isAuto
            ? isOpen
              ? 'bg-amber-400/[0.10] border-amber-400/25 text-amber-300'
              : 'bg-emerald-400/[0.10] border-emerald-400/25 text-emerald-300'
            : 'bg-white/[0.06] border-white/[0.12] text-white/70'
        }`}>
          <span className="mt-0.5 flex-shrink-0">{isAuto ? '🤖' : '👤'}</span>
          <div>
            <p className="font-bold">{isAuto ? 'Automatic Control' : 'Manual Control'}</p>
            {reason && <p className="font-normal mt-0.5 opacity-90 leading-relaxed">{reason}</p>}
          </div>
        </div>
      )}

      {/* Auto warning */}
      {isAuto && isOpen && (
        <div className="bg-amber-400/[0.10] border border-amber-400/25 rounded-xl px-3 py-2 text-xs text-amber-300 flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span>Auto-control active — windows close automatically when conditions recover.</span>
        </div>
      )}

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => handle('open')}
          disabled={loading || isOpen}
          className={`py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.97] ${
            loading
              ? 'bg-white/[0.05] text-white/40 cursor-not-allowed'
              : isOpen
              ? 'bg-emerald-400/[0.12] text-emerald-300 cursor-not-allowed border border-emerald-400/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
          }`}
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            : '🪟'}
          Open
        </button>

        <button
          onClick={() => handle('close')}
          disabled={loading || !isOpen}
          className={`py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.97] ${
            loading
              ? 'bg-white/[0.05] text-white/40 cursor-not-allowed'
              : !isOpen
              ? 'bg-white/[0.05] text-white/40 cursor-not-allowed border border-white/[0.10]'
              : 'bg-white/[0.12] hover:bg-white/[0.18] border border-white/[0.20] text-white/90 shadow-md shadow-black/30'
          }`}
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            : '🚪'}
          Close
        </button>
      </div>

      <p className="text-white/50 text-[10px] text-center -mt-1">
        Auto-opens: temp &gt; 28°C · humidity &gt; 65%
      </p>
    </div>
  )
}
