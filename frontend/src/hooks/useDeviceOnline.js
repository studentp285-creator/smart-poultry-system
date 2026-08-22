import { useState, useEffect, useRef } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'

// The device's online/offline status is judged by its heartbeat, not by
// whether a sensor reading recently arrived — a single broken sensor (e.g.
// the HC-SR04 losing its echo) can block a whole reading cycle even while
// the ESP32 itself is fully powered on and connected. The heartbeat fires
// every 5s independent of sensor success, so 20s (4 missed beats) is plenty
// of margin before genuinely calling it offline.
const HEARTBEAT_OFFLINE_THRESHOLD_S = 20

// Returns true/false once a heartbeat has been seen, or null while still
// waiting for the first one.
export default function useDeviceOnline() {
  const [lastHeartbeat, setLastHeartbeat] = useState(null)
  const [heartbeatAgo,  setHeartbeatAgo]  = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/device_status/last_heartbeat'), snapshot => {
      const ts = snapshot.val()
      setLastHeartbeat(ts ? new Date(ts) : null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!lastHeartbeat) return
    setHeartbeatAgo(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setHeartbeatAgo(Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [lastHeartbeat])

  if (lastHeartbeat === null) return null
  return heartbeatAgo <= HEARTBEAT_OFFLINE_THRESHOLD_S
}
