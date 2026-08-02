import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import SensorChart from '../components/SensorChart'
import AlertPanel from '../components/AlertPanel'

const METRICS = [
  { key: 'temperature', label: 'Temperature', unit: '°C',  color: 'text-orange-400' },
  { key: 'humidity',    label: 'Humidity',    unit: '%',   color: 'text-sky-400'    },
  { key: 'water_level', label: 'Water',       unit: '%',   color: 'text-emerald-400'},
  { key: 'feed_level',  label: 'Feed',        unit: '%',   color: 'text-amber-400'  },
]

export default function History() {
  const [readings,     setReadings]     = useState([])
  const [displayLimit, setDisplayLimit] = useState(48)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/readings/history'), (snapshot) => {
      const data = snapshot.val()
      if (!data) { setReadings([]); return }
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      setReadings(list)
    })
    return () => unsub()
  }, [])

  const displayed = readings.slice(-displayLimit)

  const avg = (key) => {
    if (!displayed.length) return null
    const vals = displayed.map(r => r[key]).filter(v => v != null)
    if (!vals.length) return null
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)
  }

  const latest = (key) => {
    if (!displayed.length) return null
    const r = displayed[displayed.length - 1]
    return r[key] != null ? r[key].toFixed(1) : null
  }

  const downloadCSV = () => {
    if (!displayed.length) return
    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Water (%)', 'Feed (%)']
    const rows = [...displayed].reverse().map(r => [
      r.timestamp ? new Date(r.timestamp).toLocaleString() : '',
      r.temperature?.toFixed(2) ?? '',
      r.humidity?.toFixed(2) ?? '',
      r.water_level?.toFixed(2) ?? '',
      r.feed_level?.toFixed(2) ?? '',
    ])
    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `poultry-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-header { display: block !important; margin-bottom: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #bbb; padding: 5px 8px; font-size: 11px; text-align: left; }
          th { background: #eee !important; font-weight: 700; }
          .card { border: 1px solid #ccc; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
        }
        .print-header { display: none; }
      `}</style>

      <div className="space-y-6">

        {/* Print-only header */}
        <div className="print-header">
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>
            Smart Poultry Monitor — Historical Data Report
          </h2>
          <p style={{ fontSize: '12px', color: '#555' }}>
            Generated: {new Date().toLocaleString()} · {displayed.length} readings shown
          </p>
          <hr style={{ margin: '8px 0', borderColor: '#bbb' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-white">Historical Data</h1>
            <p className="text-white/65 text-sm mt-0.5">
              {readings.length} total readings · showing last {Math.min(displayLimit, readings.length)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={displayLimit}
              onChange={(e) => setDisplayLimit(Number(e.target.value))}
              className="bg-slate-900/70 backdrop-blur-sm border border-white/15 text-white/80 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400/60 cursor-pointer transition-colors"
            >
              <option value={24}  className="bg-slate-900 text-white">Last 24 readings</option>
              <option value={48}  className="bg-slate-900 text-white">Last 48 readings</option>
              <option value={100} className="bg-slate-900 text-white">Last 100 readings</option>
            </select>
            <button
              onClick={downloadCSV}
              disabled={!displayed.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/[0.15] text-sm font-semibold transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-400/[0.08] border border-cyan-400/20 text-cyan-300 hover:bg-cyan-400/[0.15] text-sm font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              Print
            </button>
          </div>
        </div>

        {displayed.length < 2 ? (
          <div className="card flex flex-col items-center justify-center py-16">
            <span className="text-5xl mb-4">📈</span>
            <p className="text-lg font-semibold text-white/70 mb-1">No historical data yet</p>
            <p className="text-sm text-white/60">Connect your ESP32 to start recording data</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METRICS.map((m) => (
                <div key={m.key} className="card text-center py-3 px-2">
                  <p className="text-white/55 text-[10px] font-semibold uppercase tracking-wider mb-1.5 truncate">{m.label}</p>
                  <p className={`text-2xl font-black ${m.color}`}>{latest(m.key) ?? '—'}</p>
                  <p className="text-white/55 text-xs mt-0.5">{m.unit} now</p>
                  <div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
                    <p className="text-white/55 text-[10px]">avg <span className={`font-semibold ${m.color}`}>{avg(m.key) ?? '—'}</span></p>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts — hidden on print */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
              <SensorChart metric="temperature" data={displayed} />
              <SensorChart metric="humidity"    data={displayed} />
              <SensorChart metric="water_level" data={displayed} />
              <SensorChart metric="feed_level"  data={displayed} />
            </div>
          </>
        )}

        <div className="no-print">
          <AlertPanel />
        </div>

        {/* Raw data table */}
        {displayed.length > 0 && (
          <div className="card overflow-hidden">
            <h3 className="font-semibold text-white/90 text-sm mb-4">
              Raw Readings
              <span className="text-white/55 text-xs font-normal ml-2">newest first</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                    {['Timestamp', 'Temp (°C)', 'Humidity (%)', 'Water (%)', 'Feed (%)'].map((h) => (
                      <th key={h} className="text-left py-3 px-3 text-white/60 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...displayed].reverse().slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="py-2.5 px-3 text-white/65 text-xs whitespace-nowrap">
                        {r.timestamp
                          ? new Date(r.timestamp).toLocaleString([], {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-orange-400 font-semibold tabular-nums">{r.temperature?.toFixed(1) ?? '—'}</td>
                      <td className="py-2.5 px-3 text-sky-400    font-semibold tabular-nums">{r.humidity?.toFixed(1) ?? '—'}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold tabular-nums">{r.water_level?.toFixed(1) ?? '—'}</td>
                      <td className="py-2.5 px-3 text-amber-400  font-semibold tabular-nums">{r.feed_level?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayed.length > 20 && (
                <p className="text-white/55 text-xs text-center py-3">
                  Showing 20 of {displayed.length} readings in table · all {displayed.length} plotted on charts above
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
