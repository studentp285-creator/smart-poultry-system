import random
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

import firebase_service as fs
from .decision_support import analyze_reading, get_recommendations
from .chatbot import get_response as chatbot_reply


def _now_iso(offset_hours=0):
    dt = datetime.now(timezone.utc) - timedelta(hours=offset_hours)
    return dt.isoformat()


@api_view(['GET', 'POST'])
def sensor_readings(request):
    if request.method == 'GET':
        limit = int(request.query_params.get('limit', 50))
        readings = fs.get_history(limit)
        return Response(readings)

    # POST — called by ESP32 with real sensor data
    required = ['temperature', 'humidity', 'gas_level', 'water_level', 'feed_level']
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


def _update_ventilation(result: dict):
    """Auto-open on threshold breach; auto-close when conditions recover."""
    if result['open_windows']:
        fs.set_ventilation(True, 'auto', result['reason'])
    else:
        # Only auto-close if the system last opened it automatically
        current = fs.get_ventilation()
        if current.get('changed_by') == 'auto' and current.get('is_open'):
            fs.set_ventilation(False, 'auto', 'Conditions returned to safe levels')


@api_view(['POST'])
def simulate_reading(request):
    reading = {
        'temperature': round(random.uniform(18, 40), 1),
        'humidity':    round(random.uniform(30, 90), 1),
        'gas_level':   round(random.uniform(10, 130), 1),
        'water_level': round(random.uniform(5, 100), 1),
        'feed_level':  round(random.uniform(5, 100), 1),
    }
    key = fs.save_reading(reading)
    result = analyze_reading(reading)

    _update_ventilation(result)

    vent = fs.get_ventilation()

    return Response({
        'id':               key,
        'reading':          reading,
        'alerts_created':   result['alerts_created'],
        'ventilation_open': vent.get('is_open', False),
        'buzzer_triggered': result['trigger_buzzer'],
        'reason':           result['reason'],
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def seed_data(request):
    readings = []
    for i in range(48):
        readings.append({
            'temperature': round(random.uniform(20, 38), 1),
            'humidity':    round(random.uniform(35, 85), 1),
            'gas_level':   round(random.uniform(15, 120), 1),
            'water_level': round(max(10, 100 - i * 1.5 + random.uniform(-5, 5)), 1),
            'feed_level':  round(max(10, 100 - i * 1.2 + random.uniform(-5, 5)), 1),
            'timestamp':   _now_iso(offset_hours=48 - i),
        })
    fs.save_seed_readings(readings)
    return Response({'seeded': len(readings)})


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


@api_view(['POST'])
def chat(request):
    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'error': 'No message provided'}, status=status.HTTP_400_BAD_REQUEST)
    history = request.data.get('history') or []
    current = fs.get_latest_reading()
    reply = chatbot_reply(message, current, history)
    return Response({'reply': reply})
