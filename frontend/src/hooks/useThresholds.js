import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../firebase'

// Mirrors backend/firebase_service.py DEFAULT_THRESHOLDS — used only until the
// real value loads from Firebase (or if it's never been saved yet).
export const DEFAULT_THRESHOLDS = {
  temperature: { warn_high: 28, crit_high: 32, warn_low: 18, crit_low: 10 },
  humidity:    { warn_high: 65, crit_high: 75, warn_low: 50, crit_low: 40 },
  water_level: { warn_low: 30, crit_low: 15 },
  feed_level:  { warn_low: 30, crit_low: 15 },
}

// Live thresholds from Settings — subscribed via Firebase so every screen
// reflects a change the moment it's saved, without needing a refresh.
export default function useThresholds() {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)

  useEffect(() => {
    const unsub = onValue(ref(database, 'poultry/thresholds'), snap => {
      const data = snap.val()
      if (data) setThresholds(data)
    })
    return () => unsub()
  }, [])

  return thresholds
}
