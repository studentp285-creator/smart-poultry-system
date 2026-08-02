import { useEffect, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'
import { useToast } from '../context/ToastContext'

// ── Sound engine ──────────────────────────────────────────────────────────────
// Decoupled from browser Notification permission — always plays when a new
// alert arrives, as long as the user has interacted with the page at least once.

function playAlertSound(severity) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()

    const beep = (t, freq, dur, vol = 0.45) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(vol,    t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur - 0.02)
      osc.start(t)
      osc.stop(t + dur)
    }

    const now = ctx.currentTime
    if (severity === 'critical') {
      // Urgent triple-double burst — hard to miss
      beep(now,        880, 0.14, 0.5)
      beep(now + 0.20, 660, 0.14, 0.5)
      beep(now + 0.40, 440, 0.22, 0.5)
      beep(now + 0.75, 880, 0.14, 0.5)
      beep(now + 0.95, 660, 0.14, 0.5)
      beep(now + 1.15, 440, 0.28, 0.5)
    } else if (severity === 'warning') {
      // Two soft attention tones
      beep(now,       660, 0.12, 0.3)
      beep(now + 0.2, 660, 0.12, 0.3)
    }
    // info → silent
  } catch { /* AudioContext not available */ }
}

// ── Browser OS notification (optional enhancement) ────────────────────────────

function fireBrowserNotification(alert) {
  if (Notification.permission !== 'granted') return
  const icons   = { critical: '🚨', warning: '⚠️', info: 'ℹ️' }
  const emoji   = icons[alert.severity] || 'ℹ️'
  const title   = `${emoji} Smart Poultry — ${(alert.severity || 'alert').toUpperCase()}`
  try {
    const n = new Notification(title, {
      body:              alert.message || 'A sensor reading needs attention.',
      icon:              '/chicken-logo.jpg',
      requireInteraction: alert.severity === 'critical',
    })
    if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000)
  } catch { /* Notification API blocked */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useNotifications() {
  const { showAlert } = useToast()
  const seenIds = useRef(null)

  useEffect(() => {
    // Ask for browser notification permission (non-blocking — works without it)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const unsub = onValue(ref(database, 'poultry/alerts'), (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      const alerts = Object.entries(data).map(([id, v]) => ({ id, ...v }))

      // First load — seed seen set, don't fire anything
      if (seenIds.current === null) {
        seenIds.current = new Set(alerts.map(a => a.id))
        return
      }

      alerts.forEach(alert => {
        if (seenIds.current.has(alert.id)) return
        seenIds.current.add(alert.id)

        // 1. Sound — always, no permission needed
        playAlertSound(alert.severity)

        // 2. In-app popup — always visible inside the UI
        showAlert(alert.message, alert.severity, alert.sensor || alert.alert_type || '')

        // 3. OS notification — only if browser permission granted (bonus)
        fireBrowserNotification(alert)
      })
    })

    return () => unsub()
  }, [showAlert])
}
