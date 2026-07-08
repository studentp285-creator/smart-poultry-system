import { useEffect, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'

const ICONS = {
  critical: '🚨',
  warning:  '⚠️',
}

export default function useNotifications() {
  const seenIds = useRef(null) // null = not yet initialised

  useEffect(() => {
    if (!('Notification' in window)) return

    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const unsub = onValue(ref(database, 'poultry/alerts'), (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      const alerts = Object.entries(data).map(([id, v]) => ({ id, ...v }))

      // First load — record existing IDs so we don't notify for old alerts
      if (seenIds.current === null) {
        seenIds.current = new Set(alerts.map((a) => a.id))
        return
      }

      if (Notification.permission !== 'granted') return

      alerts.forEach((alert) => {
        if (seenIds.current.has(alert.id)) return
        seenIds.current.add(alert.id)

        const icon = ICONS[alert.severity] || 'ℹ️'
        const title = `${icon} Smart Poultry Monitor — ${alert.severity?.toUpperCase()}`
        const body  = alert.message || 'New alert detected'

        try {
          const n = new Notification(title, { body, icon: '/favicon.ico' })
          // Auto-close after 8 seconds
          setTimeout(() => n.close(), 8000)
        } catch {}
      })
    })

    return () => unsub()
  }, [])
}
