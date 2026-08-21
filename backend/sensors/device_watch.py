"""
Background thread that detects when the ESP32 stops heartbeating and raises
a real alert (+ WhatsApp, if configured) even if nobody has the dashboard
open. Deliberately based on the heartbeat, not sensor readings — a single
broken sensor must never make an otherwise-healthy device look offline.
"""
import os
import sys
import threading
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_service as fs
try:
    import whatsapp_service as _wa
except Exception:
    _wa = None

CHECK_INTERVAL_S = 10   # how often this thread checks in
OFFLINE_AFTER_S  = 20   # no heartbeat for this long => offline (4x the firmware's 5s heartbeat interval)


def _seconds_since_last_heartbeat():
    last = fs.get_last_heartbeat()
    if not last:
        return None
    last_dt = datetime.fromisoformat(last)
    return (datetime.now(timezone.utc) - last_dt).total_seconds()


def _check_once():
    age = _seconds_since_last_heartbeat()
    if age is None:
        return  # no heartbeat has ever arrived — nothing to compare against

    was_offline = fs.get_device_status().get('is_offline', False)

    if age > OFFLINE_AFTER_S and not was_offline:
        msg = f"ESP32 device appears offline — no heartbeat received in over {int(age)} seconds."
        fs.create_alert('device', 'critical', msg)
        fs.set_device_status(True)
        if _wa and _wa.is_configured():
            app_cfg = fs.get_app_settings()
            if app_cfg.get('whatsapp_enabled') and app_cfg.get('whatsapp_number'):
                try:
                    _wa.send(f"\U0001F50C *Smart Poultry Alert*\n\n{msg}", app_cfg['whatsapp_number'])
                except Exception as exc:
                    print(f'[device_watch] WhatsApp notification failed: {exc}')

    elif age <= OFFLINE_AFTER_S and was_offline:
        fs.create_alert('device', 'info', 'ESP32 device is back online.')
        fs.set_device_status(False)


def _watch_loop():
    while True:
        try:
            _check_once()
        except Exception as exc:
            print(f'[device_watch] check failed: {exc}')
        time.sleep(CHECK_INTERVAL_S)


def start():
    threading.Thread(target=_watch_loop, daemon=True).start()
