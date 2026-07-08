"""
Smart Poultry Assistant — powered by Google Gemini Flash (free tier).
Falls back to simple replies if the API key is missing or a request fails.
"""

import os
from google import genai
from google.genai import types

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are the Smart Poultry Assistant — an AI assistant built into the \
Smart Poultry Environmental Monitoring and Control System.

IMPORTANT RULES:
- Never mention that this is a "final year project", "university project", "student project", or anything academic.
- Never mention Mukuba University or any university.
- Never mention who built or developed this system.
- If asked who made this or who you are, simply say you are the built-in assistant for this poultry monitoring system.
- Speak as if this is a fully professional, commercial poultry monitoring product.
- Your ONLY job is to answer questions about this poultry system. Do NOT answer anything outside this topic.
- If someone asks something unrelated, politely decline and redirect them to ask about the poultry system.

== About the system ==
- ESP32 microcontroller reads sensors every 30 seconds and POSTs to a Django REST API.
- Django processes readings, triggers ventilation decisions, and stores alerts in Firebase.
- React + Tailwind CSS dashboard shows live readings, charts, alerts, and ventilation control.
- Firebase Realtime Database stores all sensor data, alerts, and ventilation state.

== Sensors and GPIO ==
- DHT11 (GPIO 4): Temperature & Humidity
- MQ2 Gas Sensor (GPIO 34): Gas / Ammonia level (ppm)
- Water level sensor (GPIO 35): Water level (0-100%)
- HC-SR04 ultrasonic (TRIG GPIO 5, ECHO GPIO 18): Feed level (0-100%)
- Servo motor (GPIO 19): Controls ventilation window (0 deg = closed, 90 deg = open)
- Buzzer (GPIO 21): Alarm for critical conditions

== Thresholds ==
Temperature: Warning >28°C or <18°C | Critical >32°C or <10°C
Humidity: Warning >65% or <50% | Critical >75% or <40%
Gas (ammonia): Warning >25 ppm | Critical >50 ppm
Water level: Warning <30% | Critical <15%
Feed level: Warning <30% | Critical <15%

== Ventilation logic ==
- Opens automatically when temperature >=28°C, humidity >=65%, or gas >=25 ppm
- Closes automatically when ALL conditions return to safe levels (only if auto-opened)
- Manual override via dashboard Open/Close buttons; manual state is always respected
- Shows Automatic or Manual label with the reason on the dashboard

== Current sensor readings ==
{sensor_context}

== Response style ==
- Be friendly, clear, and concise
- Use bullet points for technical info
- Use emojis like temperature, water drop, cloud, etc. to make responses readable
- If asked about live readings, refer to the current sensor data above
- Sound professional, like a helpful built-in assistant for a commercial product
"""

# ── Format live sensor data ────────────────────────────────────────────────────

def _fmt_sensor_context(data) -> str:
    if not data:
        return "No live sensor data available. ESP32 may not be connected."

    def fmt(val, unit):
        if val is None:
            return 'N/A'
        return f"{val:.1f}{unit}" if isinstance(val, float) else f"{val}{unit}"

    t = data.get('temperature')
    h = data.get('humidity')
    g = data.get('gas_level')
    w = data.get('water_level')
    f = data.get('feed_level')

    issues = []
    if isinstance(t, (int, float)):
        if t >= 35:   issues.append("Temperature CRITICAL - too hot")
        elif t >= 28: issues.append("Temperature WARNING - elevated")
        elif t <= 10: issues.append("Temperature CRITICAL - too cold")
        elif t <= 15: issues.append("Temperature WARNING - too low")
    if isinstance(h, (int, float)):
        if h >= 80:   issues.append("Humidity CRITICAL - too high")
        elif h >= 70: issues.append("Humidity WARNING - elevated")
        elif h <= 30: issues.append("Humidity CRITICAL - too dry")
        elif h <= 40: issues.append("Humidity WARNING - slightly dry")
    if isinstance(g, (int, float)):
        if g >= 100:  issues.append("Gas CRITICAL - dangerous level")
        elif g >= 50: issues.append("Gas WARNING - elevated")
    if isinstance(w, (int, float)):
        if w <= 20:   issues.append("Water CRITICAL - refill now")
        elif w <= 40: issues.append("Water WARNING - getting low")
    if isinstance(f, (int, float)):
        if f <= 20:   issues.append("Feed CRITICAL - refill now")
        elif f <= 40: issues.append("Feed WARNING - getting low")

    lines = [
        f"Temperature : {fmt(t, 'C')}",
        f"Humidity    : {fmt(h, '%')}",
        f"Gas level   : {fmt(g, ' ppm')}",
        f"Water level : {fmt(w, '%')}",
        f"Feed level  : {fmt(f, '%')}",
    ]
    if issues:
        lines.append("Active alerts: " + " | ".join(issues))
    else:
        lines.append("Status: All readings within safe ranges.")
    return "\n".join(lines)


# ── Simple fallback ────────────────────────────────────────────────────────────

def _fallback(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ['hi', 'hello', 'hey', 'how are you']):
        return "Hello! I'm your Smart Poultry Assistant. Ask me anything about the monitoring system!"
    if any(w in msg for w in ['temperature', 'temp']):
        return "Optimal temperature: 18–28°C. Above 32°C is critical and triggers auto-ventilation and the buzzer."
    if any(w in msg for w in ['humidity']):
        return "Optimal humidity: 50–65%. Above 75% is critical and triggers auto-ventilation."
    if any(w in msg for w in ['gas', 'ammonia']):
        return "Gas should be below 25 ppm. Above 50 ppm is critical and triggers the buzzer."
    if any(w in msg for w in ['water']):
        return "Water below 15% is critical — refill immediately. Warning starts at 30%."
    if any(w in msg for w in ['feed', 'food']):
        return "Feed below 15% is critical — refill immediately. Warning starts at 30%."
    if any(w in msg for w in ['ventil', 'window']):
        return "Windows open automatically when temperature >=28°C, humidity >=65%, or gas >=25 ppm."
    return "I'm your Smart Poultry Assistant. Ask me about sensor readings, ventilation, alerts, or ESP32 setup!"


# ── Main entry point ───────────────────────────────────────────────────────────

def get_response(message: str, current_data=None, history: list = None) -> str:
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()

    if not api_key:
        return _fallback(message)

    sensor_context = _fmt_sensor_context(current_data)
    system = SYSTEM_PROMPT.replace('{sensor_context}', sensor_context)

    # Build multi-turn conversation contents from history
    contents = []
    for entry in (history or []):
        role = 'user' if entry.get('role') == 'user' else 'model'
        contents.append(types.Content(role=role, parts=[types.Part(text=entry.get('text', ''))]))
    # Append the current user message
    contents.append(types.Content(role='user', parts=[types.Part(text=message)]))

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.4,
                max_output_tokens=512,
            ),
        )
        return response.text.strip()
    except Exception as e:
        err = str(e)
        if 'API_KEY' in err.upper() or '400' in err or '403' in err or 'invalid' in err.lower():
            return (
                "API key issue detected. Please check your GEMINI_API_KEY in the backend .env file.\n\n"
                f"Details: {err}"
            )
        return _fallback(message)
