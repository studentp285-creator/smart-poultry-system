function getStatus(value, type, thresholds) {
  const t = thresholds?.[type]
  if (!t) return 'good'
  if (type === 'temperature' || type === 'humidity') {
    if (value >= t.crit_high || value <= t.crit_low) return 'critical'
    if (value >= t.warn_high || value <= t.warn_low) return 'warning'
    return 'good'
  }
  if (type === 'water_level' || type === 'feed_level') {
    if (value <= t.crit_low) return 'critical'
    if (value <= t.warn_low) return 'warning'
    return 'good'
  }
  return 'good'
}

const S = {
  good: {
    border:  'border-emerald-400/[0.22]',
    stripe:  'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400',
    icon:    'bg-emerald-400/[0.10] text-emerald-400',
    value:   'text-emerald-400',
    badge:   'bg-emerald-400/[0.10] text-emerald-400 border-emerald-400/[0.25]',
    bar:     'bg-gradient-to-r from-emerald-400 to-teal-400',
    track:   'bg-emerald-400/[0.12]',
    glow:    '0 0 20px rgba(52,211,153,0.12)',
  },
  warning: {
    border:  'border-amber-400/[0.22]',
    stripe:  'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400',
    icon:    'bg-amber-400/[0.10] text-amber-400',
    value:   'text-amber-400',
    badge:   'bg-amber-400/[0.10] text-amber-400 border-amber-400/[0.25]',
    bar:     'bg-gradient-to-r from-amber-400 to-orange-400',
    track:   'bg-amber-400/[0.12]',
    glow:    '0 0 20px rgba(251,191,36,0.12)',
  },
  critical: {
    border:  'border-red-400/[0.25]',
    stripe:  'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500',
    icon:    'bg-red-400/[0.10] text-red-400',
    value:   'text-red-400',
    badge:   'bg-red-400/[0.10] text-red-400 border-red-400/[0.25]',
    bar:     'bg-gradient-to-r from-red-500 to-rose-500',
    track:   'bg-red-400/[0.12]',
    glow:    '0 0 20px rgba(248,113,113,0.15)',
  },
}

function Trend({ current, previous }) {
  if (previous == null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.3) return <span className="text-white/55 text-xs font-bold">&#8594;</span>
  if (diff > 0) return (
    <span className="text-red-400 text-xs font-bold flex items-center gap-0.5">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
      </svg>
      {Math.abs(diff).toFixed(1)}
    </span>
  )
  return (
    <span className="text-cyan-400 text-xs font-bold flex items-center gap-0.5">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
      {Math.abs(diff).toFixed(1)}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900/90 border border-cyan-400/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 animate-pulse">
      <div className="h-[3px] bg-white/10" />
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-white/[0.06] rounded-xl" />
          <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
        </div>
        <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
        <div className="h-8 w-28 bg-white/[0.06] rounded mb-4" />
        <div className="h-2 w-full bg-white/[0.06] rounded-full" />
      </div>
    </div>
  )
}

export default function SensorCard({ icon, label, value, unit, type, maxValue = 100, previousValue, thresholds, loading = false }) {
  if (loading) return <SkeletonCard />

  const status = value != null ? getStatus(value, type, thresholds) : 'good'
  const s = S[status]
  const pct = value != null ? Math.min(100, Math.max(0, (value / maxValue) * 100)) : 0

  return (
    <div
      className={`bg-slate-900/90 border ${s.border} rounded-2xl overflow-hidden
        shadow-2xl shadow-black/50 hover:-translate-y-0.5 hover:shadow-black/60
        transition-[transform,box-shadow,border-color,background-color] duration-150`}
      style={{ boxShadow: s.glow }}
    >
      <div className={`h-[3px] ${s.stripe}`} />

      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-2.5">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-2xl ${s.icon}`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${s.badge}`}>
            {status}
          </span>
        </div>

        <p className="text-white/60 text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1">
          {label}
        </p>

        <div className="flex items-end gap-2 mb-3 sm:mb-4">
          <p className={`text-2xl sm:text-[1.85rem] font-black leading-none ${s.value}`}>
            {value != null ? value.toFixed(1) : '--'}
            <span className="text-sm font-semibold text-white/55 ml-1">{unit}</span>
          </p>
          {value != null && (
            <div className="mb-0.5"><Trend current={value} previous={previousValue} /></div>
          )}
        </div>

        <div className={`h-1.5 ${s.track} rounded-full overflow-hidden`}>
          <div className={`h-full rounded-full transition-colors duration-700 ease-out ${s.bar}`}
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-white/50 text-[10px] mt-1.5">{pct.toFixed(0)}% of {maxValue}{unit}</p>
      </div>
    </div>
  )
}
