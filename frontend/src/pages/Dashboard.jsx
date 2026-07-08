import { useState, useEffect, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import SensorCard from '../components/SensorCard'
import AlertPanel from '../components/AlertPanel'
import VentilationControl from '../components/VentilationControl'
import SensorChart from '../components/SensorChart'
import Logo from '../components/Logo'

export default function Dashboard() {
  const [latest,       setLatest]       = useState(null)
  const [previous,     setPrevious]     = useState(null)
  const [history,      setHistory]      = useState([])
  const [recs,         setRecs]         = useState([])
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [firebaseError,setFirebaseError]= useState(false)
  const [loading,      setLoading]      = useState(true)
  const [secondsAgo,   setSecondsAgo]   = useState(0)
  const timerRef = useRef(null)

  // Real-time listener on latest reading
  useEffect(() => {
    const latestRef = ref(database, 'poultry/readings/latest')
    const unsub = onValue(
      latestRef,
      (snapshot) => {
        const data = snapshot.val()
        if (data) {
          setLatest(prev => {
            setPrevious(prev)
            return data
          })
          setLastUpdated(new Date())
          setFirebaseError(false)
          setRecs(buildRecs(data))
        }
        setLoading(false)
      },
      () => { setFirebaseError(true); setLoading(false) }
    )
    return () => unsub()
  }, [])

  // Real-time listener on history
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

  // Live "Updated X seconds ago" counter
  useEffect(() => {
    if (!lastUpdated) return
    setSecondsAgo(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [lastUpdated])

  const formatAge = (s) => {
    if (s < 60)   return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  const recStyle = {
    good: 'text-green-700 bg-green-50 border border-green-200',
    warn: 'text-amber-700 bg-amber-50 border border-amber-200',
    bad:  'text-red-700 bg-red-50 border border-red-200',
  }

  return (
    <div className="space-y-5">

      {/* ── Hero Banner ── */}
      <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 relative h-52 sm:h-64 overflow-hidden rounded-b-3xl">
        {/* Farm background image */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700"
          style={{ backgroundImage: 'url(/farm-bg.jpg), linear-gradient(135deg,#071a0d,#0d2b16)' }}
        />
        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-950/85 via-green-900/60 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between px-5 sm:px-10 pt-5 pb-6">
          {/* Top row — live pill */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${firebaseError ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-white text-xs font-bold tracking-wide">
                {firebaseError ? 'Connection Lost' : 'Sensors Live'}
              </span>
            </div>
            {lastUpdated && !firebaseError && (
              <span className="text-white/40 text-xs bg-black/20 backdrop-blur-sm rounded-full px-3 py-1">
                Updated {formatAge(secondsAgo)}
              </span>
            )}
          </div>

          {/* Bottom — title */}
          <div>
            <p className="text-green-300 text-xs font-semibold tracking-widest uppercase mb-1">
              Smart Poultry Management System
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Live Dashboard
            </h1>
            <p className="text-white/50 text-sm mt-1.5">
              {loading ? 'Connecting to cloud database…' : 'Real-time poultry environment monitoring'}
            </p>
          </div>
        </div>
      </div>

      {/* Connection error banner */}
      {firebaseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          ⚠️ Unable to connect to the cloud database. Please check your internet connection and try again.
        </div>
      )}

      {/* Sensor Cards — skeleton while loading */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {loading ? (
          // Skeleton placeholders
          Array.from({ length: 5 }).map((_, i) => (
            <SensorCard key={i} loading={true} />
          ))
        ) : !latest && !firebaseError ? (
          // No data empty state (spans all 5 columns)
          <div className="col-span-2 sm:col-span-3 lg:col-span-5 card flex flex-col items-center py-14 text-center">
            <Logo size={72} className="mb-4 rounded-2xl shadow-lg shadow-green-200" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">No Sensor Data Yet</h2>
            <p className="text-slate-500 text-sm">Waiting for ESP32 to send data…</p>
          </div>
        ) : (
          <>
            <SensorCard icon="🌡️" label="Temperature" value={latest?.temperature} unit="°C"  type="temperature" maxValue={50}  previousValue={previous?.temperature} />
            <SensorCard icon="💧" label="Humidity"    value={latest?.humidity}    unit="%"   type="humidity"    maxValue={100} previousValue={previous?.humidity} />
            <SensorCard icon="☁️" label="Gas Level"   value={latest?.gas_level}   unit="ppm" type="gas_level"   maxValue={150} previousValue={previous?.gas_level} />
            <SensorCard icon="🚰" label="Water Level" value={latest?.water_level} unit="%"   type="water_level" maxValue={100} previousValue={previous?.water_level} />
            <SensorCard icon="🌾" label="Feed Level"  value={latest?.feed_level}  unit="%"   type="feed_level"  maxValue={100} previousValue={previous?.feed_level} />
          </>
        )}
      </div>

      {/* Chart */}
      {history.length > 1 && (
        <SensorChart data={history} metrics={['temperature', 'humidity', 'gas_level']} />
      )}

      {/* Recommendations + Ventilation */}
      {!loading && latest && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">🧠</div>
              <h3 className="font-semibold text-slate-900">AI Recommendations</h3>
            </div>
            <div className="space-y-2">
              {recs.length === 0 ? (
                <p className="text-slate-400 text-sm">All conditions normal.</p>
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
          </div>
          <VentilationControl />
        </div>
      )}

      {/* Alerts Panel */}
      {!loading && <AlertPanel compact />}
    </div>
  )
}

function buildRecs(r) {
  const recs = []
  const { temperature: t, humidity: h, gas_level: g, water_level: w, feed_level: f } = r

  if (18 <= t && t <= 28)       recs.push({ status: 'good', text: `Temperature ${t.toFixed(1)}°C is optimal (18–28°C).` })
  else if (t > 28 && t <= 32)  recs.push({ status: 'warn', text: `Temperature ${t.toFixed(1)}°C is elevated — monitor closely and improve ventilation.` })
  else if (t > 32)              recs.push({ status: 'bad',  text: `Temperature ${t.toFixed(1)}°C is critically high — open windows immediately to prevent heat stress.` })
  else                          recs.push({ status: 'bad',  text: `Temperature ${t.toFixed(1)}°C is low — provide additional heating.` })

  if (50 <= h && h <= 65)           recs.push({ status: 'good', text: `Humidity ${h.toFixed(1)}% is optimal (50–65%).` })
  else if ((40 <= h && h < 50) || (65 < h && h <= 75)) recs.push({ status: 'warn', text: `Humidity ${h.toFixed(1)}% is outside optimal range (50–65%) — adjust ventilation.` })
  else if (h > 75)                  recs.push({ status: 'bad',  text: `Humidity ${h.toFixed(1)}% is critically high — risk of disease, ventilate urgently.` })
  else                              recs.push({ status: 'bad',  text: `Humidity ${h.toFixed(1)}% is too low — use misters or humidifiers.` })

  if (g < 10)       recs.push({ status: 'good', text: `Gas level ${g.toFixed(1)} ppm is optimal — air quality is excellent.` })
  else if (g < 25)  recs.push({ status: 'warn', text: `Gas level ${g.toFixed(1)} ppm is elevated — increase ventilation soon.` })
  else              recs.push({ status: 'bad',  text: `Gas level ${g.toFixed(1)} ppm is dangerous — open all windows immediately to protect birds!` })

  if (w > 60)      recs.push({ status: 'good', text: `Water level ${w.toFixed(1)}% is adequate.` })
  else if (w > 30) recs.push({ status: 'warn', text: `Water level ${w.toFixed(1)}% is getting low — refill soon.` })
  else             recs.push({ status: 'bad',  text: `Water level ${w.toFixed(1)}% is critically low — refill immediately, birds can dehydrate within hours!` })

  if (f > 60)      recs.push({ status: 'good', text: `Feed level ${f.toFixed(1)}% is adequate.` })
  else if (f > 30) recs.push({ status: 'warn', text: `Feed level ${f.toFixed(1)}% is getting low — refill soon.` })
  else             recs.push({ status: 'bad',  text: `Feed level ${f.toFixed(1)}% is critically low — refill feeders immediately!` })

  return recs
}
