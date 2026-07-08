import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import firebase_service as fs

THRESHOLDS = {
    'temperature': {'warn_high': 28.0, 'crit_high': 32.0, 'warn_low': 18.0, 'crit_low': 10.0},
    'humidity':    {'warn_high': 65.0, 'crit_high': 75.0, 'warn_low': 50.0, 'crit_low': 40.0},
    'gas_level':   {'warn': 25.0,  'crit': 50.0},
    'water_level': {'warn_low': 30.0, 'crit_low': 15.0},
    'feed_level':  {'warn_low': 30.0, 'crit_low': 15.0},
}


def analyze_reading(reading: dict) -> dict:
    """
    Analyze a sensor reading dict, write alerts to Firebase.
    Returns { open_windows, trigger_buzzer, alerts_created, reason }.
    'reason' is a human-readable string of which sensors triggered ventilation.
    """
    open_windows = False
    trigger_buzzer = False
    alerts_created = 0
    reasons = []  # tracks which sensors triggered auto-ventilation

    t = reading.get('temperature', 0)
    h = reading.get('humidity', 0)
    g = reading.get('gas_level', 0)
    w = reading.get('water_level', 100)
    f = reading.get('feed_level', 100)

    # Temperature
    if t >= THRESHOLDS['temperature']['crit_high']:
        fs.create_alert('temperature', 'critical',
            f"CRITICAL: Temperature is {t:.1f}°C — far above safe range. Open windows immediately.")
        open_windows = True; trigger_buzzer = True; alerts_created += 1
        reasons.append(f"Temperature critical ({t:.1f}°C)")
    elif t >= THRESHOLDS['temperature']['warn_high']:
        fs.create_alert('temperature', 'warning',
            f"WARNING: Temperature is {t:.1f}°C — above normal (18–28°C). Improve ventilation.")
        open_windows = True; alerts_created += 1
        reasons.append(f"Temperature high ({t:.1f}°C)")
    elif t <= THRESHOLDS['temperature']['crit_low']:
        fs.create_alert('temperature', 'critical',
            f"CRITICAL: Temperature is {t:.1f}°C — dangerously cold. Add heating immediately.")
        trigger_buzzer = True; alerts_created += 1
    elif t <= THRESHOLDS['temperature']['warn_low']:
        fs.create_alert('temperature', 'warning',
            f"WARNING: Temperature is {t:.1f}°C — below normal (18–28°C). Check heating.")
        alerts_created += 1

    # Humidity
    if h >= THRESHOLDS['humidity']['crit_high']:
        fs.create_alert('humidity', 'critical',
            f"CRITICAL: Humidity is {h:.1f}% — extremely high. Risk of disease. Ventilate urgently.")
        open_windows = True; trigger_buzzer = True; alerts_created += 1
        reasons.append(f"Humidity critical ({h:.1f}%)")
    elif h >= THRESHOLDS['humidity']['warn_high']:
        fs.create_alert('humidity', 'warning',
            f"WARNING: Humidity is {h:.1f}% — above normal (40–70%). Open windows to reduce moisture.")
        open_windows = True; alerts_created += 1
        reasons.append(f"Humidity high ({h:.1f}%)")
    elif h <= THRESHOLDS['humidity']['crit_low']:
        fs.create_alert('humidity', 'critical',
            f"CRITICAL: Humidity is {h:.1f}% — dangerously dry. Add water misters or humidifiers.")
        trigger_buzzer = True; alerts_created += 1
    elif h <= THRESHOLDS['humidity']['warn_low']:
        fs.create_alert('humidity', 'warning',
            f"WARNING: Humidity is {h:.1f}% — below normal (40–70%). Consider adding moisture.")
        alerts_created += 1

    # Gas Level
    if g >= THRESHOLDS['gas_level']['crit']:
        fs.create_alert('gas', 'critical',
            f"CRITICAL: Gas (ammonia) is {g:.1f} ppm — dangerous. Open all windows immediately.")
        open_windows = True; trigger_buzzer = True; alerts_created += 1
        reasons.append(f"Gas critical ({g:.1f} ppm)")
    elif g >= THRESHOLDS['gas_level']['warn']:
        fs.create_alert('gas', 'warning',
            f"WARNING: Gas level is {g:.1f} ppm — elevated. Increase ventilation.")
        open_windows = True; alerts_created += 1
        reasons.append(f"Gas elevated ({g:.1f} ppm)")

    # Water Level
    if w <= THRESHOLDS['water_level']['crit_low']:
        fs.create_alert('water', 'critical',
            f"CRITICAL: Water level is {w:.1f}% — critically low. Refill troughs immediately.")
        trigger_buzzer = True; alerts_created += 1
    elif w <= THRESHOLDS['water_level']['warn_low']:
        fs.create_alert('water', 'warning',
            f"WARNING: Water level is {w:.1f}% — getting low. Refill troughs soon.")
        alerts_created += 1

    # Feed Level
    if f <= THRESHOLDS['feed_level']['crit_low']:
        fs.create_alert('feed', 'critical',
            f"CRITICAL: Feed level is {f:.1f}% — critically low. Refill feeders immediately.")
        trigger_buzzer = True; alerts_created += 1
    elif f <= THRESHOLDS['feed_level']['warn_low']:
        fs.create_alert('feed', 'warning',
            f"WARNING: Feed level is {f:.1f}% — getting low. Refill feeders soon.")
        alerts_created += 1

    return {
        'open_windows':   open_windows,
        'trigger_buzzer': trigger_buzzer,
        'alerts_created': alerts_created,
        'reason':         ' · '.join(reasons) if reasons else '',
    }


def get_recommendations(reading: dict) -> list[dict]:
    t = reading.get('temperature', 0)
    h = reading.get('humidity', 0)
    g = reading.get('gas_level', 0)
    w = reading.get('water_level', 100)
    f = reading.get('feed_level', 100)

    recs = []

    if 18 <= t <= 28:
        recs.append({'type': 'temperature', 'status': 'good', 'text': f"Temperature {t:.1f}°C is within the optimal range (18–28°C)."})
    elif 28 < t <= 32:
        recs.append({'type': 'temperature', 'status': 'warn', 'text': f"Temperature {t:.1f}°C is elevated. Monitor closely and improve ventilation."})
    elif t > 32:
        recs.append({'type': 'temperature', 'status': 'bad',  'text': f"Temperature {t:.1f}°C is critically high. Open windows immediately to prevent heat stress."})
    elif t < 18:
        recs.append({'type': 'temperature', 'status': 'bad',  'text': f"Temperature {t:.1f}°C is low. Provide additional heating."})

    if 50 <= h <= 65:
        recs.append({'type': 'humidity', 'status': 'good', 'text': f"Humidity {h:.1f}% is within the optimal range (50–65%)."})
    elif 40 <= h < 50 or 65 < h <= 75:
        recs.append({'type': 'humidity', 'status': 'warn', 'text': f"Humidity {h:.1f}% is outside optimal range (50–65%). Adjust ventilation."})
    elif h > 75:
        recs.append({'type': 'humidity', 'status': 'bad',  'text': f"Humidity {h:.1f}% is critically high. Risk of disease. Ventilate urgently."})
    else:
        recs.append({'type': 'humidity', 'status': 'bad',  'text': f"Humidity {h:.1f}% is too low. Use misters or humidifiers."})

    if g < 10:
        recs.append({'type': 'gas', 'status': 'good', 'text': f"Gas level {g:.1f} ppm is optimal. Air quality is excellent."})
    elif g < 25:
        recs.append({'type': 'gas', 'status': 'warn', 'text': f"Gas level {g:.1f} ppm is elevated. Increase ventilation soon."})
    else:
        recs.append({'type': 'gas', 'status': 'bad',  'text': f"Gas level {g:.1f} ppm is dangerous. Open all windows immediately to protect birds."})

    if w > 60:
        recs.append({'type': 'water', 'status': 'good', 'text': f"Water level {w:.1f}% is adequate."})
    elif w > 30:
        recs.append({'type': 'water', 'status': 'warn', 'text': f"Water level {w:.1f}% is getting low. Plan to refill soon."})
    else:
        recs.append({'type': 'water', 'status': 'bad',  'text': f"Water level {w:.1f}% is critically low. Refill immediately — birds can dehydrate within hours."})

    if f > 60:
        recs.append({'type': 'feed', 'status': 'good', 'text': f"Feed level {f:.1f}% is adequate."})
    elif f > 30:
        recs.append({'type': 'feed', 'status': 'warn', 'text': f"Feed level {f:.1f}% is getting low. Plan to refill soon."})
    else:
        recs.append({'type': 'feed', 'status': 'bad',  'text': f"Feed level {f:.1f}% is critically low. Refill feeders immediately."})

    return recs
