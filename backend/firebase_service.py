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


def save_seed_readings(readings: list[dict]):
    db = get_firebase()
    history_ref = db.reference('poultry/readings/history')
    for r in readings:
        history_ref.push(r)
    if readings:
        db.reference('poultry/readings/latest').set(readings[-1])


# ── Alerts ────────────────────────────────────────────────────────────────────

ALERT_COOLDOWN_MINUTES = 30

def create_alert(alert_type: str, severity: str, message: str) -> str:
    db = get_firebase()
    # Check cooldown — don't create duplicate alert within cooldown period
    existing = db.reference('poultry/alerts').order_by_child('timestamp').limit_to_last(50).get()
    if existing:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=ALERT_COOLDOWN_MINUTES)
        for v in existing.values():
            if (v.get('alert_type') == alert_type and
                v.get('severity') == severity and
                datetime.fromisoformat(v.get('timestamp', '1970-01-01T00:00:00+00:00')) > cutoff):
                return ''  # skip — same alert already exists within cooldown
    ref = db.reference('poultry/alerts').push({
        'alert_type': alert_type,
        'severity':   severity,
        'message':    message,
        'is_read':    False,
        'timestamp':  _now(),
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


def delete_all_alerts():
    db = get_firebase()
    db.reference('poultry/alerts').delete()


def get_unread_count() -> int:
    alerts = get_alerts(200)
    return sum(1 for a in alerts if not a.get('is_read', False))


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
