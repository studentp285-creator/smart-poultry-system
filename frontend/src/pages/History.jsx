import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import SensorChart from '../components/SensorChart'
import AlertPanel from '../components/AlertPanel'

const METRICS = ['temperature', 'humidity', 'gas_level', 'water_level', 'feed_level']
const METRIC_LABELS = {
  temperature: 'Temperature (°C)',
  humidity:    'Humidity (%)',
  gas_level:   'Gas Level (ppm)',
  water_level: 'Water Level (%)',
  feed_level:  'Feed Level (%)',
}

export default function History() {
  const [readings,     setReadings]     = useState([])
  const [selected,     setSelected]     = useState(['temperature', 'humidity', 'gas_level'])
  const [displayLimit, setDisplayLimit] = useState(48)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/readings/history'), (snapshot) => {
      const data = snapshot.val()
      if (!data) { setReadings([]); return }
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setReadings(list)
    })
    return () => unsub()
  }, [])

  const toggle = (m) =>
    setSelected((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])

  const displayed = readings.slice(0, displayLimit)

  const avg = (key) => {
    if (!displayed.length) return '—'
    return (displayed.reduce((s, r) => s + (r[key] || 0), 0) / displayed.length).toFixed(1)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Historical Data</h1>
          <p className="text-white/60 text-sm mt-0.5">
            {readings.length} total readings · showing {Math.min(displayLimit, readings.length)}
          </p>
        </div>
        <select
          value={displayLimit}
          onChange={(e) => setDisplayLimit(Number(e.target.value))}
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:border-green-400"
        >
          <option value={24}>Show 24</option>
          <option value={48}>Show 48</option>
          <option value={100}>Show 100</option>
        </select>
      </div>

      {/* Metric Selector */}
      <div className="card">
        <p className="text-sm text-slate-600 font-medium mb-3">Select metrics to display on chart:</p>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => toggle(m)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                selected.includes(m)
                  ? 'bg-green-600 border-green-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-700'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {displayed.length > 1 ? (
        <SensorChart data={[...displayed].reverse()} metrics={selected} />
      ) : (
        <div className="card flex flex-col items-center justify-center py-16">
          <span className="text-5xl mb-4">📈</span>
          <p className="text-lg font-semibold text-white mb-1">No historical data yet</p>
          <p className="text-sm text-white/60">Connect your ESP32 to start recording data</p>
        </div>
      )}

      {/* Summary Stats */}
      {displayed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {METRICS.map((m) => (
            <div key={m} className="card text-center">
              <p className="text-slate-500 text-xs font-medium mb-1">
                {METRIC_LABELS[m].replace(' (%)', '').replace(' (°C)', '').replace(' (ppm)', '')}
              </p>
              <p className="text-2xl font-bold text-slate-900">{avg(m)}</p>
              <p className="text-slate-400 text-xs mt-0.5">average</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts Panel */}
      <AlertPanel />

      {/* Raw Data Table */}
      {displayed.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="font-semibold text-slate-900 mb-4">Raw Readings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Timestamp', 'Temp (°C)', 'Humidity (%)', 'Gas (ppm)', 'Water (%)', 'Feed (%)'].map((h) => (
                    <th key={h} className="text-left py-3 px-3 text-slate-600 font-semibold text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 text-xs">
                      {r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-orange-600 font-semibold">{r.temperature?.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-blue-600 font-semibold">{r.humidity?.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-purple-600 font-semibold">{r.gas_level?.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-semibold">{r.water_level?.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-amber-600 font-semibold">{r.feed_level?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayed.length > 20 && (
              <p className="text-slate-400 text-xs text-center py-3">
                Showing 20 of {displayed.length} readings
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
