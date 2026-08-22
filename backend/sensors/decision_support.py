import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import firebase_service as fs
try:
    import whatsapp_service as _wa
except Exception:
    _wa = None
from datetime import datetime, timezone, timedelta

CRITICAL_REMINDER_MINUTES = 30

# A sensor must improve this much past a threshold before its state steps down.
# Prevents floods from values oscillating near a boundary.
HYSTERESIS = {
    'temperature': 1.5,   # °C
    'humidity':    2.0,   # %
    'water_level': 2.0,   # %
    'feed_level':  2.0,   # %
}

_STATE_RANK = {'good': 0, 'warning': 1, 'critical': 2}

_LABELS = {
    'temperature': 'Temperature',
    'humidity':    'Humidity',
    'water_level': 'Water Level',
    'feed_level':  'Feed Level',
}

_UNITS = {
    'temperature': '°C',
    'humidity':    '%',
    'water_level': '%',
    'feed_level':  '%',
}


# ── State classification ───────────────────────────────────────────────────────

def _raw_state(sensor, value, thresholds) -> str:
    t = thresholds[sensor]
    if sensor == 'temperature':
        if value >= t['crit_high'] or value <= t['crit_low']: return 'critical'
        if value >= t['warn_high'] or value <= t['warn_low']: return 'warning'
    elif sensor == 'humidity':
        if value >= t['crit_high'] or value <= t['crit_low']: return 'critical'
        if value >= t['warn_high'] or value <= t['warn_low']: return 'warning'
    elif sensor in ('water_level', 'feed_level'):
        if value <= t['crit_low']: return 'critical'
        if value <= t['warn_low']: return 'warning'
    return 'good'


def _sensor_state(sensor, value, thresholds, prev_state='good') -> str:
    """
    Effective state with hysteresis on recovery.
    Worsening is immediate; improvement requires clearing the threshold by HYSTERESIS first.
    """
    raw = _raw_state(sensor, value, thresholds)
    if _STATE_RANK[raw] >= _STATE_RANK[prev_state]:
        return raw

    t  = thresholds[sensor]
    hy = HYSTERESIS[sensor]

    if sensor in ('temperature', 'humidity'):
        if prev_state == 'critical':
            if not (value > t['crit_low'] + hy and value < t['crit_high'] - hy):
                return 'critical'
            return 'good' if (value > t['warn_low'] + hy and value < t['warn_high'] - hy) else 'warning'
        else:
            return 'good' if (value > t['warn_low'] + hy and value < t['warn_high'] - hy) else 'warning'

    else:  # water_level, feed_level
        if prev_state == 'critical':
            if value <= t['crit_low'] + hy: return 'critical'
            return 'warning' if value <= t['warn_low'] + hy else 'good'
        else:
            return 'good' if value > t['warn_low'] + hy else 'warning'


def _should_alert(sensor, new_state, prev_info: dict) -> bool:
    prev_state = prev_info.get('state', 'good')

    if new_state == 'good':
        return prev_state in ('warning', 'critical')

    if new_state != prev_state:
        return True

    if new_state == 'critical':
        last_ts = prev_info.get('last_alert_ts')
        if not last_ts:
            return True
        try:
            last = datetime.fromisoformat(last_ts)
            return datetime.now(timezone.utc) - last > timedelta(minutes=CRITICAL_REMINDER_MINUTES)
        except ValueError:
            return True

    return False


# ── Alert bundling ────────────────────────────────────────────────────────────

def _detail(sensor, state, value, thr) -> str:
    """One-line summary of a sensor's condition for use inside a bundle."""
    unit = _UNITS[sensor]
    v    = f"{value:.1f}{unit}"

    if state == 'critical':
        if sensor == 'temperature':
            return f"{v} — {'dangerously hot, open windows now' if value >= thr['crit_high'] else 'dangerously cold, add heating'}"
        if sensor == 'humidity':
            return f"{v} — {'extremely humid, disease risk' if value >= thr['crit_high'] else 'dangerously dry, use misters'}"
        if sensor == 'water_level':
            return f"{v} — critically low, refill troughs now"
        if sensor == 'feed_level':
            return f"{v} — critically low, refill feeders now"

    if state == 'warning':
        if sensor == 'temperature':
            return f"{v} — {'too warm' if value >= thr['warn_high'] else 'too cool'}"
        if sensor == 'humidity':
            return f"{v} — {'too humid' if value >= thr['warn_high'] else 'too dry'}"
        if sensor == 'water_level':
            return f"{v} — getting low, plan to refill"
        if sensor == 'feed_level':
            return f"{v} — getting low, plan to refill"

    # good / recovery
    return f"{value:.1f}{unit} — back to normal"


def _build_bundle(items: list, level: str) -> tuple[str, str]:
    """
    Bundle multiple sensor events into one alert.
    items: list of (sensor_key, detail_string, label_string)
    Returns (sensor_field_for_db, message).
    """
    sensor_field = items[0][0] if len(items) == 1 else 'multiple'

    if len(items) == 1:
        sensor, detail, label = items[0]
        if level == 'critical':
            return sensor_field, f"CRITICAL — {label}: {detail}. Immediate action required."
        if level == 'warning':
            return sensor_field, f"WARNING — {label}: {detail}."
        return sensor_field, f"Recovered — {label}: {detail}."

    # Multiple sensors — bulleted list
    bullets = '\n'.join(f"• {label}: {detail}" for _, detail, label in items)

    if level == 'critical':
        msg = (
            f"CRITICAL — {len(items)} sensors need immediate attention:\n"
            f"{bullets}\n"
            f"Act now to protect your flock."
        )
    elif level == 'warning':
        msg = (
            f"WARNING — {len(items)} sensors outside safe range:\n"
            f"{bullets}"
        )
    else:
        msg = (
            f"Recovered — {len(items)} sensors returned to safe levels:\n"
            f"{bullets}"
        )

    return sensor_field, msg


# ── Main analysis entry point ─────────────────────────────────────────────────

def analyze_reading(reading: dict) -> dict:
    open_windows   = False
    trigger_buzzer = False
    temp_critical  = False
    alerts_created = 0
    reasons        = []

    t = reading.get('temperature', 0)
    h = reading.get('humidity', 0)
    w = reading.get('water_level', 100)
    f = reading.get('feed_level', 100)

    THRESHOLDS  = fs.get_thresholds()
    prev_states = fs.get_sensor_states()
    new_states  = {}
    now_ts      = datetime.now(timezone.utc).isoformat()

    sensors = [
        ('temperature', t),
        ('humidity',    h),
        ('water_level', w),
        ('feed_level',  f),
    ]

    # Buckets for bundling — each entry: (sensor_key, detail_str, label_str)
    critical_bucket  = []
    warning_bucket   = []
    recovered_bucket = []

    for sensor, value in sensors:
        prev_info  = prev_states.get(sensor, {'state': 'good'})
        prev_state = prev_info.get('state', 'good')
        new_state  = _sensor_state(sensor, value, THRESHOLDS, prev_state)
        thr        = THRESHOLDS[sensor]

        # ── Ventilation / buzzer decisions ────────────────────────────────────
        if sensor == 'temperature':
            if new_state == 'critical':
                open_windows = True; trigger_buzzer = True; temp_critical = True
                reasons.append(f"Temp critical ({value:.1f}°C)")
            elif new_state == 'warning':
                open_windows = True
                reasons.append(f"Temp elevated ({value:.1f}°C)")
        elif sensor == 'humidity':
            # Ventilation (servo) follows temperature only — humidity still
            # raises alerts/buzzer but no longer opens or closes the vent.
            if new_state == 'critical':
                trigger_buzzer = True
                reasons.append(f"Humidity critical ({value:.1f}%)")
            elif new_state == 'warning':
                reasons.append(f"Humidity elevated ({value:.1f}%)")
        elif sensor in ('water_level', 'feed_level'):
            if new_state == 'critical':
                trigger_buzzer = True

        # ── Collect alert candidates ──────────────────────────────────────────
        if _should_alert(sensor, new_state, prev_info):
            entry = (sensor, _detail(sensor, new_state, value, thr), _LABELS[sensor])
            if new_state == 'critical':
                critical_bucket.append(entry)
            elif new_state == 'warning':
                warning_bucket.append(entry)
            else:
                recovered_bucket.append(entry)

            new_states[sensor] = {'state': new_state, 'last_alert_ts': now_ts}
        else:
            new_states[sensor] = {'state': new_state, 'last_alert_ts': prev_info.get('last_alert_ts')}

    # ── Emit at most 3 bundled alerts per reading cycle ───────────────────────
    if critical_bucket:
        sensor_field, msg = _build_bundle(critical_bucket, 'critical')
        fs.create_alert(sensor_field, 'critical', msg)
        alerts_created += 1
        # WhatsApp notification for critical alerts
        if _wa and _wa.is_configured():
            try:
                app_cfg = fs.get_app_settings()
                if app_cfg.get('whatsapp_enabled') and app_cfg.get('whatsapp_number'):
                    wa_body = f"🚨 *Smart Poultry Alert*\n\n{msg}\n\n_Sent from your Smart Poultry Monitor_"
                    _wa.send(wa_body, app_cfg['whatsapp_number'])
            except Exception as exc:
                print(f'[WhatsApp] Notification failed: {exc}')

    if warning_bucket:
        sensor_field, msg = _build_bundle(warning_bucket, 'warning')
        fs.create_alert(sensor_field, 'warning', msg)
        alerts_created += 1

    if recovered_bucket:
        sensor_field, msg = _build_bundle(recovered_bucket, 'good')
        fs.create_alert(sensor_field, 'info', msg)
        alerts_created += 1

    fs.set_sensor_states(new_states)

    return {
        'open_windows':   open_windows,
        'trigger_buzzer': trigger_buzzer,
        'temp_critical':  temp_critical,
        'alerts_created': alerts_created,
        'reason':         ' · '.join(reasons) if reasons else '',
    }


# ── Recommendations ────────────────────────────────────────────────────────────

def get_recommendations(reading: dict, thresholds: dict = None) -> list[dict]:
    """Uses the same configurable thresholds (Settings page) as analyze_reading,
    so recommendations always match the current alert/ventilation levels."""
    thresholds = thresholds or fs.get_thresholds()
    t = reading.get('temperature', 0)
    h = reading.get('humidity', 0)
    w = reading.get('water_level', 100)
    f = reading.get('feed_level', 100)

    tt, th = thresholds['temperature'], thresholds['humidity']
    tw, tf = thresholds['water_level'], thresholds['feed_level']

    recs = []

    temp_state = _raw_state('temperature', t, thresholds)
    if temp_state == 'good':
        recs.append({'type': 'temperature', 'status': 'good', 'text': f"Temperature {t:.1f}°C is within the optimal range ({tt['warn_low']:.0f}–{tt['warn_high']:.0f}°C)."})
    elif temp_state == 'warning':
        if t >= tt['warn_high']:
            recs.append({'type': 'temperature', 'status': 'warn', 'text': f"Temperature {t:.1f}°C is elevated. Monitor closely and improve ventilation."})
        else:
            recs.append({'type': 'temperature', 'status': 'warn', 'text': f"Temperature {t:.1f}°C is low. Monitor closely and consider extra heating."})
    else:
        if t >= tt['crit_high']:
            recs.append({'type': 'temperature', 'status': 'bad', 'text': f"Temperature {t:.1f}°C is critically high. Open windows immediately to prevent heat stress."})
        else:
            recs.append({'type': 'temperature', 'status': 'bad', 'text': f"Temperature {t:.1f}°C is critically low. Provide additional heating immediately."})

    hum_state = _raw_state('humidity', h, thresholds)
    if hum_state == 'good':
        recs.append({'type': 'humidity', 'status': 'good', 'text': f"Humidity {h:.1f}% is within the optimal range ({th['warn_low']:.0f}–{th['warn_high']:.0f}%)."})
    elif hum_state == 'warning':
        recs.append({'type': 'humidity', 'status': 'warn', 'text': f"Humidity {h:.1f}% is outside optimal range ({th['warn_low']:.0f}–{th['warn_high']:.0f}%). Adjust ventilation."})
    else:
        if h >= th['crit_high']:
            recs.append({'type': 'humidity', 'status': 'bad', 'text': f"Humidity {h:.1f}% is critically high. Risk of disease. Ventilate urgently."})
        else:
            recs.append({'type': 'humidity', 'status': 'bad', 'text': f"Humidity {h:.1f}% is too low. Use misters or humidifiers."})

    water_state = _raw_state('water_level', w, thresholds)
    if water_state == 'good':
        recs.append({'type': 'water', 'status': 'good', 'text': f"Water level {w:.1f}% is adequate."})
    elif water_state == 'warning':
        recs.append({'type': 'water', 'status': 'warn', 'text': f"Water level {w:.1f}% is getting low. Plan to refill soon."})
    else:
        recs.append({'type': 'water', 'status': 'bad', 'text': f"Water level {w:.1f}% is critically low. Refill immediately — birds can dehydrate within hours."})

    feed_state = _raw_state('feed_level', f, thresholds)
    if feed_state == 'good':
        recs.append({'type': 'feed', 'status': 'good', 'text': f"Feed level {f:.1f}% is adequate."})
    elif feed_state == 'warning':
        recs.append({'type': 'feed', 'status': 'warn', 'text': f"Feed level {f:.1f}% is getting low. Plan to refill soon."})
    else:
        recs.append({'type': 'feed', 'status': 'bad', 'text': f"Feed level {f:.1f}% is critically low. Refill feeders immediately."})

    return recs
