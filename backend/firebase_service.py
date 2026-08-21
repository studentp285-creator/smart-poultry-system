"""
All Firebase Realtime Database read/write operations.

Firebase structure:
  poultry/
    readings/
      latest/       <- single object, most recent reading
      history/      <- push-keyed list of all readings
    alerts/         <- push-keyed list of alert objects
    ventilation/    <- single object { is_open, changed_by, last_changed }
"""

from datetime import datetime, timezone
from firebase_config import get_firebase


# ── Auth ──────────────────────────────────────────────────────────────────────

def email_is_registered(email: str) -> bool:
    """True if a Firebase Auth account exists for this email. Admin SDK lookups
    are not subject to the client SDK's email-enumeration protection."""
    get_firebase()  # ensure the Firebase app is initialized
    from firebase_admin import auth as fb_auth
    try:
        fb_auth.get_user_by_email(email)
        return True
    except fb_auth.UserNotFoundError:
        return False


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── Readings ──────────────────────────────────────────────────────────────────

def save_reading(data: dict) -> str:
    """Save a reading to both latest/ and history/. Returns the history push key."""
    db = get_firebase()
    payload = {**data, 'timestamp': _now()}

    db.reference('poultry/readings/latest').set(payload)
    ref = db.reference('poultry/readings/history').push(payload)
    return ref.key


def get_latest_reading() -> dict | None:
    db = get_firebase()
    return db.reference('poultry/readings/latest').get()


def get_history(limit: int = 50) -> list[dict]:
    db = get_firebase()
    data = db.reference('poultry/readings/history').order_by_child('timestamp').limit_to_last(limit).get()
    if not data:
        return []
    readings = [{'id': k, **v} for k, v in data.items()]
    readings.sort(key=lambda r: r.get('timestamp', ''), reverse=True)
    return readings


# ── Thresholds ────────────────────────────────────────────────────────────────

DEFAULT_THRESHOLDS = {
    'temperature': {'warn_high': 28.0, 'crit_high': 32.0, 'warn_low': 18.0, 'crit_low': 10.0},
    'humidity':    {'warn_high': 65.0, 'crit_high': 75.0, 'warn_low': 50.0, 'crit_low': 40.0},
    'water_level': {'warn_low': 30.0, 'crit_low': 15.0},
    'feed_level':  {'warn_low': 30.0, 'crit_low': 15.0},
}

def get_thresholds() -> dict:
    db = get_firebase()
    return db.reference('poultry/thresholds').get() or DEFAULT_THRESHOLDS

def set_thresholds(thresholds: dict):
    db = get_firebase()
    db.reference('poultry/thresholds').set(thresholds)


# ── Sensor states ─────────────────────────────────────────────────────────────

def get_sensor_states() -> dict:
    db = get_firebase()
    return db.reference('poultry/sensor_states').get() or {}

def set_sensor_states(states: dict):
    db = get_firebase()
    db.reference('poultry/sensor_states').set(states)


# ── Alerts ────────────────────────────────────────────────────────────────────

def create_alert(sensor: str, severity: str, message: str) -> str:
    db = get_firebase()
    ref = db.reference('poultry/alerts').push({
        'sensor':    sensor,
        'severity':  severity,
        'message':   message,
        'is_read':   False,
        'timestamp': _now(),
    })
    return ref.key


def get_alerts(limit: int = 50) -> list[dict]:
    db = get_firebase()
    data = db.reference('poultry/alerts').order_by_child('timestamp').limit_to_last(limit).get()
    if not data:
        return []
    alerts = [{'id': k, **v} for k, v in data.items()]
    alerts.sort(key=lambda a: a.get('timestamp', ''), reverse=True)
    return alerts


def mark_alert_read(alert_id: str):
    db = get_firebase()
    db.reference(f'poultry/alerts/{alert_id}').update({'is_read': True})


def mark_all_alerts_read():
    db = get_firebase()
    data = db.reference('poultry/alerts').get()
    if not data:
        return
    updates = {f'{k}/is_read': True for k in data}
    db.reference('poultry/alerts').update(updates)


def delete_read_alerts() -> int:
    """Delete only alerts that have been marked as read. Returns count deleted."""
    db   = get_firebase()
    data = db.reference('poultry/alerts').get()
    if not data:
        return 0
    deleted = 0
    for key, alert in data.items():
        if alert.get('is_read', False):
            db.reference(f'poultry/alerts/{key}').delete()
            deleted += 1
    return deleted


def delete_all_alerts():
    db = get_firebase()
    db.reference('poultry/alerts').delete()


def get_unread_count() -> int:
    alerts = get_alerts(200)
    return sum(1 for a in alerts if not a.get('is_read', False))


# ── App settings (WhatsApp number, etc.) ──────────────────────────────────────

def get_app_settings() -> dict:
    db = get_firebase()
    return db.reference('poultry/app_settings').get() or {}

def set_app_settings(settings: dict):
    db = get_firebase()
    db.reference('poultry/app_settings').set(settings)


# ── Device connectivity ────────────────────────────────────────────────────────
# Deliberately separate from readings/ — a heartbeat only proves the ESP32 is
# powered on and can reach the backend. It must never depend on whether any
# particular sensor read succeeded, or one broken sensor makes the whole
# device look "offline" even though it's fully up and communicating.

def record_heartbeat():
    db = get_firebase()
    db.reference('poultry/device_status/last_heartbeat').set(_now())


def get_last_heartbeat() -> str | None:
    db = get_firebase()
    return db.reference('poultry/device_status/last_heartbeat').get()


def get_device_status() -> dict:
    db = get_firebase()
    return db.reference('poultry/device_status').get() or {'is_offline': False}


def set_device_status(is_offline: bool):
    db = get_firebase()
    db.reference('poultry/device_status').update({'is_offline': is_offline, 'changed_at': _now()})


# ── Ventilation ───────────────────────────────────────────────────────────────

def get_ventilation() -> dict:
    db = get_firebase()
    data = db.reference('poultry/ventilation').get()
    return data or {'is_open': False, 'changed_by': 'manual', 'last_changed': _now()}


def set_ventilation(is_open: bool, changed_by: str = 'manual', reason: str = ''):
    db = get_firebase()
    db.reference('poultry/ventilation').set({
        'is_open':      is_open,
        'changed_by':   changed_by,
        'reason':       reason,
        'last_changed': _now(),
    })
