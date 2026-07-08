import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const LINES = {
  temperature: { color: '#ea580c', label: 'Temperature (°C)' },
  humidity:    { color: '#0284c7', label: 'Humidity (%)' },
  gas_level:   { color: '#7c3aed', label: 'Gas Level (ppm)' },
  water_level: { color: '#059669', label: 'Water Level (%)' },
  feed_level:  { color: '#d97706', label: 'Feed Level (%)' },
}

function fmt(ts) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg">
      <p className="text-slate-500 text-xs mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-sm font-semibold" style={{ color: p.color }}>
          {LINES[p.dataKey]?.label || p.dataKey}: {Number(p.value).toFixed(1)}
        </p>
      ))}
    </div>
  )
}

export default function SensorChart({ data, metrics }) {
  const chartData = [...data]
    .reverse()
    .slice(-24)
    .map((r) => ({ ...r, time: fmt(r.timestamp) }))

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-4">Environmental Trends</h3>
      <div className="h-[200px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: '#475569', paddingTop: '12px' }}
              formatter={(v) => LINES[v]?.label || v}
            />
            {(metrics || Object.keys(LINES)).map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={LINES[key]?.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
