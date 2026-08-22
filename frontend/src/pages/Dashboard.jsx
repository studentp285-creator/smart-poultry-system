import { useState, useEffect, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import SensorCard from '../components/SensorCard'
import AlertPanel from '../components/AlertPanel'
import VentilationControl from '../components/VentilationControl'
import SensorChart from '../components/SensorChart'
import { getLatestReading } from '../services/api'
import useDeviceOnline from '../hooks/useDeviceOnline'
import useThresholds from '../hooks/useThresholds'

const REFRESH_OPTIONS = [
  { label: 'Live (real-time)', value: 0   },
  { label: 'Every 5 seconds',  value: 5   },
  { label: 'Every 10 seconds', value: 10  },
  { label: 'Every 30 seconds', value: 30  },
  { label: 'Every 1 minute',   value: 60  },
  { label: 'Every 5 minutes',  value: 300 },
]

export default function Dashboard() {
  const [latest,          setLatest]          = useState(null)
  const [previous,        setPrevious]        = useState(null)
  const [history,         setHistory]         = useState([])
  const [recs,            setRecs]            = useState([])
  const [lastUpdated,     setLastUpdated]     = useState(null)
  const [firebaseError,   setFirebaseError]   = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [secondsAgo,      setSecondsAgo]      = useState(0)
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [countdown,       setCountdown]       = useState(0)
  const [unreadAlerts,    setUnreadAlerts]    = useState(0)
  const deviceOnline  = useDeviceOnline()
  const thresholds    = useThresholds()
  const timerRef      = useRef(null)
  const refreshRef    = useRef(null)
  const countdownRef  = useRef(null)

  useEffect(() => {
    const latestRef = ref(database, 'poultry/readings/latest')
    const unsub = onValue(
      latestRef,
      (snapshot) => {
        const data = snapshot.val()
        if (data) {
          setLatest(prev => { setPrevious(prev); return data })
          setLastUpdated(new Date())
          setFirebaseError(false)
          setRecs(buildRecs(data, thresholds))
        }
        setLoading(false)
      },
      () => { setFirebaseError(true); setLoading(false) }
    )
    return () => unsub()
  }, [thresholds])

  useEffect(() => {
    const histRef = ref(database, 'poultry/readings/history')
    const unsub = onValue(histRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const list = Object.entries(data)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .slice(-48)
        setHistory(list)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/alerts'), snap => {
      const data = snap.val()
      setUnreadAlerts(data ? Object.values(data).filter(a => !a.is_read).length : 0)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!lastUpdated) return
    setSecondsAgo(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [lastUpdated])

  useEffect(() => {
    clearInterval(refreshRef.current)
    clearInterval(countdownRef.current)
    setCountdown(0)
    if (refreshInterval === 0) return

    const doFetch = () => {
      getLatestReading()
        .then(({ data }) => {
          const reading = data.reading
          if (reading) {
            setLatest(prev => { setPrevious(prev); return reading })
            setLastUpdated(new Date())
            setFirebaseError(false)
            setRecs(buildRecs(reading, thresholds))
          }
        })
        .catch(() => setFirebaseError(true))
      setCountdown(refreshInterval)
    }

    setCountdown(refreshInterval)
    refreshRef.current   = setInterval(doFetch, refreshInterval * 1000)
    countdownRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => { clearInterval(refreshRef.current); clearInterval(countdownRef.current) }
  }, [refreshInterval, thresholds])

  const isOffline = !firebaseError && deviceOnline !== true

  const formatAge = (s) => {
    if (s < 60)   return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  const recStyle = {
    good: 'text-emerald-300 bg-emerald-400/[0.08] border border-emerald-400/20',
    warn: 'text-amber-300  bg-amber-400/[0.08]  border border-amber-400/20',
    bad:  'text-red-300    bg-red-400/[0.08]    border border-red-400/20',
  }

  return (
    <div className="space-y-5">

      {/* ── Hero Banner ── */}
      <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 relative h-52 sm:h-64 overflow-hidden rounded-b-3xl">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700 pointer-events-none"
          style={{ backgroundImage: 'url(/farm-bg.jpg), linear-gradient(135deg,#060f1c,#0a1628)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060f1c]/90 via-[#081628]/70 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/30 via-transparent to-transparent pointer-events-none" />

        <div className="relative h-full flex flex-col justify-between px-5 sm:px-10 pt-5 pb-6">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 bg-cyan-400/[0.08] backdrop-blur-sm border border-cyan-400/[0.18] rounded-full px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${firebaseError || isOffline ? 'bg-red-400' : 'bg-cyan-400 animate-pulse'}`} />
              <span className="text-cyan-300 text-xs font-bold tracking-wide">
                {firebaseError ? 'Connection Lost' : isOffline ? 'Microcontroller Offline' : 'Sensors Live'}
              </span>
            </div>
            {lastUpdated && !firebaseError && (
              <span className="text-white/60 text-xs bg-black/25 backdrop-blur-sm rounded-full px-3 py-1">
                Updated {formatAge(secondsAgo)}
              </span>
            )}
          </div>

          <div>
            <p className="text-cyan-400/70 text-xs font-semibold tracking-widest uppercase mb-1">
              Smart Poultry Management System
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Live Dashboard
            </h1>
            <p className="text-white/65 text-sm mt-1.5">
              {loading ? 'Connecting to cloud database…' : 'Real-time poultry environment monitoring'}
            </p>
          </div>
        </div>
      </div>

      {/* Connection error */}
      {firebaseError && (
        <div className="bg-red-400/[0.08] border border-red-400/20 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
          <span className="flex-shrink-0">⚠️</span>
          Unable to connect to the cloud database. Please check your internet connection.
        </div>
      )}

      {/* Refresh control */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-white/65 text-xs font-medium uppercase tracking-wide">Refresh</span>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-slate-900/70 backdrop-blur-sm border border-white/15 text-white/80 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400/60 cursor-pointer transition-colors"
          >
            {REFRESH_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
            ))}
          </select>
        </div>

        {refreshInterval > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-colors duration-1000 ease-linear"
                style={{ width: `${(countdown / refreshInterval) * 100}%` }}
              />
            </div>
            <span className="text-white/65 text-xs tabular-nums">{countdown}s</span>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      {!loading && latest && <DashboardKPIs
        unreadAlerts={unreadAlerts}
        history={history}
        lastUpdated={lastUpdated}
        secondsAgo={secondsAgo}
        formatAge={formatAge}
      />}

      {/* Sensor cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SensorCard key={i} loading={true} />)
        ) : (
          <>
            <SensorCard icon="🌡️" label="Temperature" value={isOffline ? 0 : latest?.temperature} unit="°C"  type="temperature" maxValue={50}  previousValue={isOffline ? null : previous?.temperature} thresholds={thresholds} />
            <SensorCard icon="💧" label="Humidity"    value={isOffline ? 0 : latest?.humidity}    unit="%"   type="humidity"    maxValue={100} previousValue={isOffline ? null : previous?.humidity} thresholds={thresholds} />
            <SensorCard icon="🚰" label="Water Level" value={isOffline ? 0 : latest?.water_level} unit="%"   type="water_level" maxValue={100} previousValue={isOffline ? null : previous?.water_level} thresholds={thresholds} />
            <SensorCard icon="🌾" label="Feed Level"  value={isOffline ? 0 : latest?.feed_level}  unit="%"   type="feed_level"  maxValue={100} previousValue={isOffline ? null : previous?.feed_level} thresholds={thresholds} />
          </>
        )}
      </div>

      {/* Offline notice */}
      {isOffline && (
        <div className="bg-red-400/[0.08] border border-red-400/20 rounded-xl p-3 text-red-300 text-sm flex items-center gap-2">
          <span className="flex-shrink-0">📡</span>
          <span>
            {latest
              ? <>No new reading for <strong>{formatAge(secondsAgo)}</strong> — the ESP32 may have disconnected or lost power. Showing zero until it reconnects.</>
              : 'Waiting for the ESP32 to connect — showing zero until a reading is received.'}
          </span>
        </div>
      )}

      {/* Recent Trends */}
      {history.length > 1 && (
        <div>
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Recent Trends</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SensorChart metric="temperature" data={history} compact />
            <SensorChart metric="humidity"    data={history} compact />
            <SensorChart metric="water_level" data={history} compact />
            <SensorChart metric="feed_level"  data={history} compact />
          </div>
        </div>
      )}

      {/* Recommendations + Ventilation */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-400/[0.10] border border-purple-400/20 rounded-xl flex items-center justify-center text-base">🧠</div>
              <h3 className="font-semibold text-white/90 text-sm">AI Recommendations</h3>
            </div>
            {isOffline ? (
              <p className="text-white/60 text-sm">Microcontroller is offline — recommendations paused until new readings arrive.</p>
            ) : (
              <div className="space-y-2">
                {recs.length === 0 ? (
                  <p className="text-white/60 text-sm">All conditions normal.</p>
                ) : (
                  recs.map((rec, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${recStyle[rec.status]}`}>
                      <span className="text-base flex-shrink-0">
                        {rec.status === 'good' ? '✅' : rec.status === 'warn' ? '⚡' : '❌'}
                      </span>
                      <p className="text-sm leading-relaxed">{rec.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <VentilationControl />
        </div>
      )}

      {/* Alerts Panel */}
      {!loading && <AlertPanel compact />}
    </div>
  )
}

function DashboardKPIs({ unreadAlerts, history, lastUpdated, secondsAgo, formatAge }) {
  const today = new Date().toDateString()
  const readingsToday = history.filter(r => r.timestamp && new Date(r.timestamp).toDateString() === today).length
  const avgTemp = history.length
    ? (history.reduce((s, r) => s + (r.temperature || 0), 0) / history.length).toFixed(1)
    : null

  const kpis = [
    {
      label: 'Unread Alerts',
      value: unreadAlerts || '0',
      unit: unreadAlerts === 1 ? 'alert' : 'alerts',
      icon: '🔔',
      color: unreadAlerts > 0 ? 'text-red-400' : 'text-emerald-400',
      ring: unreadAlerts > 0 ? 'border-red-400/20 bg-red-400/[0.04]' : 'border-emerald-400/20 bg-emerald-400/[0.04]',
    },
    {
      label: 'Readings Today',
      value: readingsToday,
      unit: 'logged',
      icon: '📊',
      color: 'text-cyan-400',
      ring: 'border-cyan-400/20 bg-cyan-400/[0.04]',
    },
    {
      label: 'Avg Temperature',
      value: avgTemp ?? '—',
      unit: avgTemp ? '°C (last 48)' : '',
      icon: '🌡️',
      color: 'text-orange-400',
      ring: 'border-orange-400/20 bg-orange-400/[0.04]',
    },
    {
      label: 'Last Reading',
      value: lastUpdated ? formatAge(secondsAgo) : '—',
      unit: '',
      icon: '⏱️',
      color: secondsAgo > 120 ? 'text-amber-400' : 'text-emerald-400',
      ring: secondsAgo > 120 ? 'border-amber-400/20 bg-amber-400/[0.04]' : 'border-emerald-400/20 bg-emerald-400/[0.04]',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`card border ${kpi.ring} py-3 px-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/55 text-[10px] font-bold uppercase tracking-wider leading-tight">{kpi.label}</span>
            <span className="text-base">{kpi.icon}</span>
          </div>
          <p className={`text-2xl font-black tabular-nums ${kpi.color}`}>{kpi.value}</p>
          {kpi.unit && <p className="text-white/45 text-[11px] mt-0.5">{kpi.unit}</p>}
        </div>
      ))}
    </div>
  )
}

function buildRecs(r, thresholds) {
  const recs = []
  const { temperature: t, humidity: h, water_level: w, feed_level: f } = r
  const tt = thresholds.temperature, th = thresholds.humidity
  const tw = thresholds.water_level, tf = thresholds.feed_level

  if (t > tt.warn_low && t < tt.warn_high)      recs.push({ status: 'good', text: `Temperature ${t.toFixed(1)}°C is optimal (${tt.warn_low}–${tt.warn_high}°C).` })
  else if (t >= tt.warn_high && t < tt.crit_high) recs.push({ status: 'warn', text: `Temperature ${t.toFixed(1)}°C is elevated — monitor closely and improve ventilation.` })
  else if (t >= tt.crit_high)                    recs.push({ status: 'bad',  text: `Temperature ${t.toFixed(1)}°C is critically high — open windows immediately to prevent heat stress.` })
  else if (t <= tt.crit_low)                     recs.push({ status: 'bad',  text: `Temperature ${t.toFixed(1)}°C is critically low — provide additional heating immediately.` })
  else                                            recs.push({ status: 'warn', text: `Temperature ${t.toFixed(1)}°C is low — provide additional heating.` })

  if (h > th.warn_low && h < th.warn_high)      recs.push({ status: 'good', text: `Humidity ${h.toFixed(1)}% is optimal (${th.warn_low}–${th.warn_high}%).` })
  else if (h >= th.warn_high && h < th.crit_high) recs.push({ status: 'warn', text: `Humidity ${h.toFixed(1)}% is outside optimal range (${th.warn_low}–${th.warn_high}%) — adjust ventilation.` })
  else if (h >= th.crit_high)                    recs.push({ status: 'bad',  text: `Humidity ${h.toFixed(1)}% is critically high — risk of disease, ventilate urgently.` })
  else if (h <= th.crit_low)                     recs.push({ status: 'bad',  text: `Humidity ${h.toFixed(1)}% is too low — use misters or humidifiers immediately.` })
  else                                            recs.push({ status: 'warn', text: `Humidity ${h.toFixed(1)}% is too low — use misters or humidifiers.` })

  if (w > tw.warn_low)      recs.push({ status: 'good', text: `Water level ${w.toFixed(1)}% is adequate.` })
  else if (w > tw.crit_low) recs.push({ status: 'warn', text: `Water level ${w.toFixed(1)}% is getting low — refill soon.` })
  else                      recs.push({ status: 'bad',  text: `Water level ${w.toFixed(1)}% is critically low — refill immediately, birds can dehydrate within hours!` })

  if (f > tf.warn_low)      recs.push({ status: 'good', text: `Feed level ${f.toFixed(1)}% is adequate.` })
  else if (f > tf.crit_low) recs.push({ status: 'warn', text: `Feed level ${f.toFixed(1)}% is getting low — refill soon.` })
  else                      recs.push({ status: 'bad',  text: `Feed level ${f.toFixed(1)}% is critically low — refill feeders immediately!` })

  return recs
}
