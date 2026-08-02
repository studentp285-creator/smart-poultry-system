import { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { getThresholds, updateThresholds, getAppSettings, updateAppSettings } from '../services/api'

const GROUPS = [
  {
    label: 'Temperature', sensor: 'temperature', unit: '°C', icon: '🌡️',
    fields: [
      { key: 'crit_low',  label: 'Critical Low',  desc: 'Dangerously cold — add heating' },
      { key: 'warn_low',  label: 'Warning Low',   desc: 'Getting cold — check heating' },
      { key: 'warn_high', label: 'Warning High',  desc: 'Getting warm — improve ventilation' },
      { key: 'crit_high', label: 'Critical High', desc: 'Dangerously hot — open windows immediately' },
    ],
  },
  {
    label: 'Humidity', sensor: 'humidity', unit: '%', icon: '💧',
    fields: [
      { key: 'crit_low',  label: 'Critical Low',  desc: 'Too dry — use misters' },
      { key: 'warn_low',  label: 'Warning Low',   desc: 'Below optimal humidity' },
      { key: 'warn_high', label: 'Warning High',  desc: 'Above optimal — open windows' },
      { key: 'crit_high', label: 'Critical High', desc: 'Very humid — disease risk' },
    ],
  },
  {
    label: 'Water Level', sensor: 'water_level', unit: '%', icon: '🚰',
    fields: [
      { key: 'crit_low', label: 'Critical Low', desc: 'Critically low — refill immediately' },
      { key: 'warn_low', label: 'Warning Low',  desc: 'Getting low — plan to refill soon' },
    ],
  },
  {
    label: 'Feed Level', sensor: 'feed_level', unit: '%', icon: '🌾',
    fields: [
      { key: 'crit_low', label: 'Critical Low', desc: 'Critically low — refill feeders immediately' },
      { key: 'warn_low', label: 'Warning Low',  desc: 'Getting low — plan to refill soon' },
    ],
  },
]

const BADGE = {
  crit_low:  'bg-red-500/[0.12] border-red-500/25 text-red-300',
  crit_high: 'bg-red-500/[0.12] border-red-500/25 text-red-300',
  crit:      'bg-red-500/[0.12] border-red-500/25 text-red-300',
  warn_low:  'bg-amber-500/[0.12] border-amber-500/25 text-amber-300',
  warn_high: 'bg-amber-500/[0.12] border-amber-500/25 text-amber-300',
  warn:      'bg-amber-500/[0.12] border-amber-500/25 text-amber-300',
}

export default function Settings() {
  const [thresholds, setThresholds] = useState(null)
  const [edited,     setEdited]     = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  const [waSettings, setWaSettings] = useState({ whatsapp_enabled: false, whatsapp_number: '' })
  const [twilioOk,   setTwilioOk]   = useState(false)
  const [waSaving,   setWaSaving]   = useState(false)
  const [waError,    setWaError]    = useState('')

  useEffect(() => {
    getThresholds()
      .then(({ data }) => { setThresholds(data); setEdited(JSON.parse(JSON.stringify(data))) })
      .catch(() => setError('Could not load thresholds from server.'))
    getAppSettings()
      .then(({ data }) => {
        setWaSettings({ whatsapp_enabled: data.whatsapp_enabled, whatsapp_number: data.whatsapp_number })
        setTwilioOk(data.twilio_configured)
      })
      .catch(() => {})
  }, [])

  const handleChange = (sensor, key, value) => {
    setEdited(prev => ({
      ...prev,
      [sensor]: { ...prev[sensor], [key]: value === '' ? '' : Number(value) },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await updateThresholds(edited)
      setThresholds(JSON.parse(JSON.stringify(edited)))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = JSON.stringify(edited) !== JSON.stringify(thresholds)

  const saveWASettings = async () => {
    setWaSaving(true)
    setWaError('')
    try {
      await updateAppSettings(waSettings)
    } catch {
      setWaError('Failed to save — please try again')
    }
    setWaSaving(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/65 text-sm mt-0.5">System configuration and alert thresholds</p>
      </div>

      {/* Threshold settings */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
          <div>
            <h2 className="font-semibold text-white/90 text-sm">Environmental Alert Thresholds</h2>
            <p className="text-white/60 text-xs mt-0.5">
              Edit any value then click Save to apply. Changes take effect on the next sensor reading.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving || !edited}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isDirty && !saving
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm shadow-cyan-900/40'
                : 'bg-white/[0.05] border border-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <><span className="animate-spin inline-block">⟳</span> Saving…</>
            ) : saved ? (
              <>✓ Saved</>
            ) : (
              <>Save Changes</>
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-300 text-xs bg-red-400/[0.08] border border-red-400/20 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        {!edited ? (
          <div className="text-center py-8 text-white/55 text-sm">Loading thresholds…</div>
        ) : (
          <div className="space-y-5 mt-4">
            {GROUPS.map((group) => (
              <div key={group.sensor}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{group.icon}</span>
                  <h3 className="font-semibold text-white/80 text-sm">{group.label}</h3>
                  <span className="text-white/55 text-xs">({group.unit})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.fields.map((field) => (
                    <div key={field.key}
                      className={`border rounded-xl p-3 ${BADGE[field.key] || 'bg-white/[0.03] border-white/10 text-white/60'}`}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <p className="text-sm font-medium flex-1">{field.label}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            value={edited[group.sensor]?.[field.key] ?? ''}
                            onChange={(e) => handleChange(group.sensor, field.key, e.target.value)}
                            className="w-16 bg-slate-900/80 border border-white/15 text-white text-sm rounded-lg px-2 py-1 text-center font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/60 transition-colors"
                          />
                          <span className="text-xs opacity-75">{group.unit}</span>
                        </div>
                      </div>
                      <p className="text-xs opacity-75">{field.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hardware Info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚙️</span>
          <h2 className="font-semibold text-white/90 text-sm">Connected Hardware</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: '🌡️', name: 'DHT22 Sensor',       desc: 'Temperature & Humidity' },
            { icon: '🚰', name: 'Water Level Sensor',  desc: 'Drinking Water Monitor' },
            { icon: '🌾', name: 'HC-SR04 Ultrasonic',  desc: 'Feed Level Monitor' },
            { icon: '🔧', name: 'Servo Motor',          desc: 'Automated Window Control' },
            { icon: '🔔', name: 'Buzzer',               desc: 'Audible Alarm System' },
          ].map(h => (
            <div key={h.name} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex items-start gap-2 hover:bg-white/[0.05] transition-colors">
              <span className="text-xl">{h.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white/80">{h.name}</p>
                <p className="text-white/60 text-xs">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Alerts */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📱</span>
          <h2 className="font-semibold text-white/90 text-sm">WhatsApp Alerts</h2>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
            twilioOk
              ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300'
              : 'bg-amber-400/10  border-amber-400/20  text-amber-300'
          }`}>
            {twilioOk ? '✓ Ready' : 'Not available'}
          </span>
        </div>
        <p className="text-white/55 text-xs mb-4">
          Get a WhatsApp message when critical conditions are detected — even when the dashboard is closed.
        </p>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-white/80 text-sm font-semibold">Enable WhatsApp alerts</p>
              <p className="text-white/45 text-xs mt-0.5">Only critical alerts are sent — not warnings or recoveries</p>
            </div>
            <button
              onClick={() => setWaSettings(s => ({ ...s, whatsapp_enabled: !s.whatsapp_enabled }))}
              className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${waSettings.whatsapp_enabled ? 'bg-cyan-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${waSettings.whatsapp_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div>
            <label className="text-white/70 text-xs font-semibold block mb-1.5">Your WhatsApp number</label>
            <input
              type="tel"
              value={waSettings.whatsapp_number}
              onChange={e => setWaSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
              placeholder="+260971234567"
              className="w-full sm:w-72 bg-slate-900/70 border border-white/15 text-white/85 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400/60 transition-colors placeholder-white/30"
            />
            <p className="text-white/40 text-[11px] mt-1">Include country code — Zambia: +260…</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={saveWASettings}
              disabled={waSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {waSaving && <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />}
              Save
            </button>
          </div>

          {waError && (
            <div className="text-xs px-3 py-2.5 rounded-xl border bg-red-400/[0.08] border-red-400/20 text-red-300">
              ✗ {waError}
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="card bg-gradient-to-br from-cyan-950/30 via-transparent to-transparent border-cyan-400/[0.12]">
        <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
          <Logo size={56} className="rounded-2xl flex-shrink-0 shadow-md shadow-cyan-900/40 ring-1 ring-cyan-400/20" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white/90 text-lg">Smart Poultry Monitor</h2>
            <p className="text-white/65 text-sm mt-1">
              An Intelligent IoT and AI-Based Smart Poultry Environmental Monitoring and Control System
            </p>
            <p className="text-white/55 text-xs mt-2">Version 1.0 · ESP32 + Django + React + Firebase + Gemini AI</p>
          </div>
        </div>
      </div>
    </div>
  )
}
