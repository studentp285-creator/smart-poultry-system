import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const CONFIG = {
  temperature: {
    color: '#f97316',
    gradient: 'gradTemp',
    label: 'Temperature',
    unit: '°C',
    icon: '🌡️',
    refs: [
      { value: 10, label: 'Crit Low',  stroke: '#ef4444' },
      { value: 18, label: 'Warn Low',  stroke: '#f59e0b' },
      { value: 28, label: 'Warn High', stroke: '#f59e0b' },
      { value: 32, label: 'Crit High', stroke: '#ef4444' },
    ],
  },
  humidity: {
    color: '#0ea5e9',
    gradient: 'gradHumid',
    label: 'Humidity',
    unit: '%',
    icon: '💧',
    refs: [
      { value: 40, label: 'Crit Low',  stroke: '#ef4444' },
      { value: 50, label: 'Warn Low',  stroke: '#f59e0b' },
      { value: 65, label: 'Warn High', stroke: '#f59e0b' },
      { value: 75, label: 'Crit High', stroke: '#ef4444' },
    ],
  },
  water_level: {
    color: '#10b981',
    gradient: 'gradWater',
    label: 'Water Level',
    unit: '%',
    icon: '🚰',
    refs: [
      { value: 15, label: 'Crit Low', stroke: '#ef4444' },
      { value: 30, label: 'Warn Low', stroke: '#f59e0b' },
    ],
  },
  feed_level: {
    color: '#f59e0b',
    gradient: 'gradFeed',
    label: 'Feed Level',
    unit: '%',
    icon: '🌾',
    refs: [
      { value: 15, label: 'Crit Low', stroke: '#ef4444' },
      { value: 30, label: 'Warn Low', stroke: '#f59e0b' },
    ],
  },
}

function fmtTick(ts, multiDay) {
  const d = new Date(ts)
  const hhmm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  if (!multiDay) return hhmm
  return `${d.getDate()}/${d.getMonth() + 1} ${hhmm}`
}

function fmtTooltipTime(ts) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const raw = payload[0]
  return (
    <div className="bg-[#0a1628] border border-cyan-400/20 rounded-xl px-3 py-2 shadow-2xl shadow-black/60 text-sm backdrop-blur-md">
      <p className="text-white/65 text-xs mb-1">{fmtTooltipTime(label)}</p>
      <p className="font-bold" style={{ color: raw.stroke }}>
        {Number(raw.value).toFixed(1)} {unit}
      </p>
    </div>
  )
}

export default function SensorChart({ metric, data, compact = false }) {
  const cfg = CONFIG[metric]
  if (!cfg) return null

  const points = data.slice(compact ? -20 : -48)

  const multiDay = points.length > 1 &&
    new Date(points[0].timestamp).toDateString() !==
    new Date(points[points.length - 1].timestamp).toDateString()

  const chartData = points.map((r) => ({
    ts: r.timestamp,
    value: r[metric],
  }))

  const dataVals = chartData.map(d => d.value).filter(v => v != null)
  const refVals  = cfg.refs.map(r => r.value)
  const allVals  = [...dataVals, ...refVals]
  const rawMin   = Math.min(...allVals)
  const rawMax   = Math.max(...allVals)
  const pad      = (rawMax - rawMin) * 0.12 || 5
  const yMin     = Math.floor(rawMin - pad)
  const yMax     = Math.ceil(rawMax + pad)

  const tickInterval = Math.max(1, Math.floor(chartData.length / 6))

  const latest = dataVals.length ? dataVals[dataVals.length - 1].toFixed(1) : '—'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.icon}</span>
          <div>
            <h3 className="font-semibold text-white/90 text-sm leading-tight">{cfg.label}</h3>
            <p className="text-white/60 text-xs">{points.length} readings</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold" style={{ color: cfg.color }}>{latest}</span>
          <span className="text-white/55 text-sm ml-1">{cfg.unit}</span>
        </div>
      </div>

      <div className={compact ? 'h-[130px]' : 'h-[180px]'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={cfg.gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />

            <XAxis
              dataKey="ts"
              tickFormatter={(ts) => fmtTick(ts, multiDay)}
              interval={tickInterval}
              tick={{ fill: 'rgba(255,255,255,0.50)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: 'rgba(255,255,255,0.50)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v) => `${v}${cfg.unit === '%' || cfg.unit === '°C' ? cfg.unit : ''}`}
            />

            <Tooltip
              content={<CustomTooltip unit={cfg.unit} />}
              cursor={{ stroke: cfg.color, strokeWidth: 1, strokeDasharray: '4 2' }}
            />

            {cfg.refs.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.value}
                stroke={r.stroke}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={compact ? undefined : {
                  value: `${r.label} (${r.value}${cfg.unit})`,
                  position: 'insideTopRight',
                  fill: r.stroke,
                  fontSize: 9,
                  dy: -2,
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="value"
              stroke={cfg.color}
              strokeWidth={2.5}
              fill={`url(#${cfg.gradient})`}
              dot={false}
              activeDot={{ r: 4, fill: cfg.color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
