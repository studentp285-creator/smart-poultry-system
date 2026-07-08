import Logo from '../components/Logo'

const THRESHOLDS = [
  { label: 'Temperature Warning', key: 'tempWarn', default: 28, unit: '°C',  desc: 'Send warning when temperature exceeds this' },
  { label: 'Temperature Critical',key: 'tempCrit', default: 32, unit: '°C',  desc: 'Open windows & alert above this temperature' },
  { label: 'Humidity Warning',    key: 'humWarn',  default: 65, unit: '%',   desc: 'Alert when humidity rises above this level' },
  { label: 'Humidity Critical',   key: 'humCrit',  default: 75, unit: '%',   desc: 'Urgent ventilation above this humidity level' },
  { label: 'Gas Level Warning',   key: 'gasWarn',  default: 25, unit: 'ppm', desc: 'Alert when ammonia concentration exceeds this' },
  { label: 'Gas Level Critical',  key: 'gasCrit',  default: 50, unit: 'ppm', desc: 'Open windows & alarm when gas exceeds this' },
  { label: 'Water Level Low',     key: 'waterLow', default: 30, unit: '%',   desc: 'Alert when water level falls below this' },
  { label: 'Water Level Critical',key: 'waterCrit',default: 15, unit: '%',   desc: 'Alarm when water level falls below this' },
  { label: 'Feed Level Low',      key: 'feedLow',  default: 30, unit: '%',   desc: 'Alert when feed level falls below this' },
  { label: 'Feed Level Critical', key: 'feedCrit', default: 15, unit: '%',   desc: 'Alarm when feed level falls below this' },
]

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/60 text-sm mt-0.5">System configuration and alert thresholds</p>
      </div>

      {/* Threshold Settings */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-1">Environmental Alert Thresholds</h2>
        <p className="text-slate-500 text-xs mb-4">
          Alert levels used to monitor poultry house conditions. Based on international poultry farming standards.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THRESHOLDS.map((t) => (
            <div key={t.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <p className="text-sm font-semibold text-slate-700 flex-1">{t.label}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-16 bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-2 py-1 text-center font-semibold">
                    {t.default}
                  </span>
                  <span className="text-slate-500 text-xs">{t.unit}</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware Info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚙️</span>
          <h2 className="font-semibold text-slate-900">Connected Hardware</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: '🌡️', name: 'DHT11 Sensor',       desc: 'Temperature & Humidity' },
            { icon: '☁️', name: 'MQ2 Gas Sensor',      desc: 'Ammonia & Gas Detection' },
            { icon: '🚰', name: 'Water Level Sensor',  desc: 'Drinking Water Monitor' },
            { icon: '🌾', name: 'HC-SR04 Ultrasonic',  desc: 'Feed Level Monitor' },
            { icon: '🔧', name: 'Servo Motor',          desc: 'Automated Window Control' },
            { icon: '🔔', name: 'Buzzer',               desc: 'Audible Alarm System' },
          ].map(h => (
            <div key={h.name} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">{h.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">{h.name}</p>
                <p className="text-slate-400 text-xs">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="card bg-gradient-to-br from-green-50 to-white border-green-200">
        <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
          <Logo size={56} className="rounded-2xl flex-shrink-0 shadow-md shadow-green-200" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 text-lg">Smart Poultry Monitor</h2>
            <p className="text-slate-600 text-sm mt-1">
              An Intelligent IoT and AI-Based Smart Poultry Environmental Monitoring and Control System
            </p>
            <p className="text-slate-400 text-xs mt-2">Version 1.0 · ESP32 + Django + React + Firebase + Gemini AI</p>
          </div>
        </div>
      </div>
    </div>
  )
}
