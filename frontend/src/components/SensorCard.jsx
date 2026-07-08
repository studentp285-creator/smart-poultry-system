function getStatus(value, type) {
  const rules = {
    temperature: [
      { min: 18, max: 28, status: 'good' },
      { min: 10, max: 18, status: 'warning' },
      { min: 28, max: 35, status: 'warning' },
      { min: -Infinity, max: 10, status: 'critical' },
      { min: 35, max: Infinity, status: 'critical' },
    ],
    humidity: [
      { min: 40, max: 70, status: 'good' },
      { min: 30, max: 40, status: 'warning' },
      { min: 70, max: 80, status: 'warning' },
      { min: -Infinity, max: 30, status: 'critical' },
      { min: 80, max: Infinity, status: 'critical' },
    ],
    gas_level: [
      { min: 0,   max: 50,       status: 'good' },
      { min: 50,  max: 100,      status: 'warning' },
      { min: 100, max: Infinity, status: 'critical' },
    ],
    water_level: [
      { min: 50, max: 100,       status: 'good' },
      { min: 20, max: 50,        status: 'warning' },
      { min: -Infinity, max: 20, status: 'critical' },
    ],
    feed_level: [
      { min: 50, max: 100,       status: 'good' },
      { min: 20, max: 50,        status: 'warning' },
      { min: -Infinity, max: 20, status: 'critical' },
    ],
  }
  for (const r of (rules[type] || [])) {
    if (value >= r.min && value < r.max) return r.status
  }
  return 'good'
}

const statusStyles = {
  good: {
    border: 'border-green-200',
    icon:   'bg-green-100 text-green-600',
    bar:    'bg-green-500',
    value:  'text-green-700',
    badge:  'bg-green-100 text-green-700 border-green-200',
    track:  'bg-green-100',
  },
  warning: {
    border: 'border-amber-200',
    icon:   'bg-amber-100 text-amber-600',
    bar:    'bg-amber-400',
    value:  'text-amber-700',
    badge:  'bg-amber-100 text-amber-700 border-amber-200',
    track:  'bg-amber-100',
  },
  critical: {
    border: 'border-red-200',
    icon:   'bg-red-100 text-red-600',
    bar:    'bg-red-500',
    value:  'text-red-700',
    badge:  'bg-red-100 text-red-700 border-red-200',
    track:  'bg-red-100',
  },
}

function Trend({ current, previous }) {
  if (previous === undefined || previous === null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.3) {
    return <span className="text-slate-400 text-xs font-bold" title="Stable">→</span>
  }
  if (diff > 0) {
    return (
      <span className="text-red-500 text-xs font-bold flex items-center gap-0.5" title={`+${diff.toFixed(1)}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
        </svg>
        {Math.abs(diff).toFixed(1)}
      </span>
    )
  }
  return (
    <span className="text-blue-500 text-xs font-bold flex items-center gap-0.5" title={`${diff.toFixed(1)}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
      {Math.abs(diff).toFixed(1)}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-200 rounded-xl" />
        <div className="h-5 w-14 bg-slate-200 rounded-full" />
      </div>
      <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-28 bg-slate-200 rounded" />
      <div className="mt-4 h-1.5 bg-slate-200 rounded-full" />
      <div className="mt-1.5 h-2.5 w-24 bg-slate-100 rounded" />
    </div>
  )
}

export default function SensorCard({ icon, label, value, unit, type, maxValue = 100, previousValue, loading = false }) {
  if (loading) return <SkeletonCard />

  const status = value !== null && value !== undefined ? getStatus(value, type) : 'good'
  const style  = statusStyles[status]
  const pct    = value !== null && value !== undefined
    ? Math.min(100, Math.max(0, (value / maxValue) * 100))
    : 0

  return (
    <div className={`bg-white border ${style.border} rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-xl ${style.icon}`}>
          {icon}
        </div>
        <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border capitalize ${style.badge}`}>
          {status}
        </span>
      </div>

      <p className="text-slate-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{label}</p>

      <div className="flex items-end gap-2">
        <p className={`text-2xl sm:text-3xl font-bold ${style.value}`}>
          {value !== null && value !== undefined ? value.toFixed(1) : '--'}
          <span className="text-sm sm:text-lg font-normal text-slate-400 ml-1">{unit}</span>
        </p>
        {value !== null && value !== undefined && (
          <div className="mb-1">
            <Trend current={value} previous={previousValue} />
          </div>
        )}
      </div>

      <div className="mt-3 sm:mt-4">
        <div className={`h-1.5 ${style.track} rounded-full overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-400 text-xs mt-1">{pct.toFixed(0)}% of max ({maxValue}{unit})</p>
      </div>
    </div>
  )
}
