import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from functools import wraps
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

import firebase_service as fs
from .decision_support import analyze_reading, get_recommendations
from .chatbot import get_response as chatbot_reply
try:
    import whatsapp_service as _wa
except Exception:
    _wa = None

# ── ESP32 device authentication ───────────────────────────────────────────────
# Set ESP32_API_KEY in backend/.env to enforce authentication.
# If left empty the check is skipped (safe for local development).

_DEVICE_KEY = os.environ.get('ESP32_API_KEY', '').strip()

def require_device_key(view_func):
    """Decorator: reject POST/PUT requests that don't carry the correct X-API-Key header."""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if _DEVICE_KEY and request.method in ('POST', 'PUT', 'PATCH'):
            incoming = request.headers.get('X-API-Key', '')
            if incoming != _DEVICE_KEY:
                return Response(
                    {'error': 'Invalid or missing device API key.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        return view_func(request, *args, **kwargs)
    return wrapper


@api_view(['GET', 'POST'])
@require_device_key
def sensor_readings(request):
    if request.method == 'GET':
        limit = int(request.query_params.get('limit', 50))
        readings = fs.get_history(limit)
        return Response(readings)

    # POST — called by ESP32 with real sensor data
    # Note: the ESP32 firmware still sends gas_level in its payload — it's simply
    # ignored here rather than requiring a firmware re-upload to drop the field.
    required = ['temperature', 'humidity', 'water_level', 'feed_level']
    data = request.data
    missing = [f for f in required if f not in data]
    if missing:
        return Response({'error': f'Missing fields: {missing}'}, status=status.HTTP_400_BAD_REQUEST)

    reading = {k: float(data[k]) for k in required}
    key = fs.save_reading(reading)
    result = analyze_reading(reading)

    _update_ventilation(result)

    # Return the FINAL ventilation state from Firebase (respects manual overrides)
    vent = fs.get_ventilation()

    return Response({
        'id':               key,
        'reading':          reading,
        'alerts_created':   result['alerts_created'],
        'ventilation_open': vent.get('is_open', False),
        'buzzer_triggered': result['trigger_buzzer'],
        'reason':           result['reason'],
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def latest_reading(request):
    reading = fs.get_latest_reading()
    if not reading:
        return Response({'detail': 'No readings yet.'}, status=status.HTTP_404_NOT_FOUND)
    recs = get_recommendations(reading)
    return Response({'reading': reading, 'recommendations': recs})


@api_view(['POST'])
def device_heartbeat(request):
    """Proves the ESP32 is powered on and can reach the backend — nothing
    more. Deliberately independent of sensor-reading success."""
    fs.record_heartbeat()
    return Response({'status': 'ok'})


def _update_ventilation(result: dict):
    """Auto-open on threshold breach; auto-close when conditions recover.
    A manual close is respected while temperature is only at warning level,
    but critical temperature always forces the vent back open — safety
    takes precedence over a manual override in a genuine emergency. A
    manual open is never auto-closed."""
    current = fs.get_ventilation()

    if result['open_windows']:
        manually_closed = current.get('changed_by') == 'manual' and not current.get('is_open')
        if manually_closed and not result.get('temp_critical'):
            return
        fs.set_ventilation(True, 'auto', result['reason'])
    elif current.get('changed_by') == 'auto' and current.get('is_open'):
        fs.set_ventilation(False, 'auto', 'Conditions returned to safe levels')


@api_view(['GET'])
def ventilation_status(request):
    return Response(fs.get_ventilation())


@api_view(['POST'])
def ventilation_control(request):
    """Manual open/close from the dashboard. Not device-authenticated —
    this is a user action, not an ESP32 write."""
    action = str(request.data.get('action', '')).strip().lower()
    if action not in ('open', 'close'):
        return Response({'error': "action must be 'open' or 'close'"}, status=status.HTTP_400_BAD_REQUEST)
    fs.set_ventilation(action == 'open', 'manual', f"Manually {'opened' if action == 'open' else 'closed'} by user")
    return Response(fs.get_ventilation())


@api_view(['GET'])
def alerts_list(request):
    alerts = fs.get_alerts(50)
    unread  = fs.get_unread_count()
    return Response({'alerts': alerts, 'unread_count': unread})


@api_view(['PATCH'])
def mark_alert_read(request, alert_id):
    fs.mark_alert_read(alert_id)
    return Response({'status': 'marked as read'})


@api_view(['POST'])
def mark_all_read(request):
    fs.mark_all_alerts_read()
    return Response({'status': 'all marked as read'})


@api_view(['DELETE'])
def delete_all_alerts(request):
    fs.delete_all_alerts()
    return Response({'status': 'all alerts deleted'})


@api_view(['DELETE'])
def delete_read_alerts(request):
    deleted = fs.delete_read_alerts()
    return Response({'status': 'read alerts deleted', 'deleted': deleted})


@api_view(['POST'])
def check_email(request):
    """Used by the forgot-password page to tell an unregistered email apart
    from one Firebase's client SDK silently no-ops for (enumeration protection)."""
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'No email provided'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'registered': fs.email_is_registered(email)})


@api_view(['GET'])
def chat_status(request):
    """Returns whether the Gemini AI backend is configured and reachable."""
    key_set = bool(os.environ.get('GEMINI_API_KEY', '').strip())
    return Response({'ai_enabled': key_set})


@api_view(['GET'])
def get_thresholds(request):
    return Response(fs.get_thresholds())

@api_view(['POST'])
def update_thresholds(request):
    fs.set_thresholds(request.data)
    return Response({'status': 'thresholds updated'})


@api_view(['GET', 'POST'])
def app_settings(request):
    if request.method == 'GET':
        s = fs.get_app_settings()
        return Response({
            'whatsapp_enabled':  s.get('whatsapp_enabled', False),
            'whatsapp_number':   s.get('whatsapp_number', ''),
            'twilio_configured': bool(_wa and _wa.is_configured()),
        })
    data = {
        'whatsapp_enabled': bool(request.data.get('whatsapp_enabled', False)),
        'whatsapp_number':  str(request.data.get('whatsapp_number', '')).strip(),
    }
    fs.set_app_settings(data)
    return Response({'status': 'saved'})


@api_view(['POST'])
def test_whatsapp(request):
    if not _wa or not _wa.is_configured():
        return Response({'error': 'WhatsApp alerts are not available right now'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    settings = fs.get_app_settings()
    number = settings.get('whatsapp_number', '').strip()
    if not number:
        return Response({'error': 'No WhatsApp number saved — enter your number and save first'}, status=status.HTTP_400_BAD_REQUEST)
    ok, detail = _wa.send(
        '🧪 *Test message from Smart Poultry Monitor*\n\nWhatsApp alerts are working correctly! You will receive notifications here when critical conditions are detected.',
        number,
    )
    if ok:
        return Response({'status': 'sent', 'sid': detail})
    return Response({'error': 'Could not send message — please check the number and try again'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def chat(request):
    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'error': 'No message provided'}, status=status.HTTP_400_BAD_REQUEST)
    history = request.data.get('history') or []
    current = fs.get_latest_reading()
    reply = chatbot_reply(message, current, history)
    return Response({'reply': reply})
