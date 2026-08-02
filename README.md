# Smart Poultry Environmental Monitoring and Control System

A full-stack IoT system for real-time monitoring and automated control of poultry house environments.  
Built as a final year project — BSc Computer Science, Mukuba University, Zambia.

---

## System Architecture

```
ESP32 (sensors + actuators)
    │  Wi-Fi HTTP POST every 30 s
    ▼
Django REST API  (port 8000)
    │  reads, writes, decision logic
    ▼
Firebase Realtime Database  (cloud)
    │  onValue() push
    ▼
React + Vite dashboard  (port 5173)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11 or 3.13 |
| Node.js | 18 + |
| npm | 9 + |
| Firebase account | Free Spark plan is enough |
| Google Cloud (optional) | Gemini AI API key for the chat feature |

---

## Environment Setup

### 1. Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → create a project.
2. Enable **Realtime Database** (start in test mode, then add rules for production).
3. Go to **Project Settings → Service Accounts → Generate new private key** — download `serviceAccountKey.json` and place it in `backend/`.
4. Copy `.firebaserc` values into the frontend `.env` (see below).

### 2. Backend — `backend/.env`

Create `backend/.env` (never commit this file):

```env
FIREBASE_DB_URL=https://your-project-default-rtdb.firebaseio.com/

# Optional — enables AI chat responses
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — enables API key auth on ESP32 POST endpoint
ESP32_API_KEY=change_me_to_a_random_secret
```

### 3. Frontend — `frontend/.env`

Create `frontend/.env` (never commit this file):

```env
VITE_FIREBASE_API_KEY=your_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Running the Application

### One-command launch (Windows PowerShell)

```powershell
.\start_all.ps1
```

This starts both the Django backend (port 8000) and Vite dev server (port 5173) in separate terminal tabs.

### Manual start

**Backend:**
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## ESP32 Hardware Setup

See `esp32/smart_poultry_monitor.ino` for the complete Arduino sketch.

### Wiring

| Component | ESP32 Pin |
|-----------|-----------|
| DHT22 (data) | GPIO 4 |
| MQ-135 AOUT | GPIO 34 (ADC1) |
| Water sensor AOUT | GPIO 35 (ADC1) |
| HC-SR04 TRIG | GPIO 18 |
| HC-SR04 ECHO | GPIO 19 |
| Servo PWM | GPIO 21 |
| Buzzer (+) | GPIO 22 |

### Arduino libraries required

Install via **Tools → Manage Libraries**:
- DHT sensor library (Adafruit)
- Adafruit Unified Sensor
- ArduinoJson (>= 6.x)
- ESP32Servo

### Configuration (in `smart_poultry_monitor.ino`)

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://<PC-LAN-IP>:8000/api/readings/";
const char* API_KEY       = "";  // must match ESP32_API_KEY in backend/.env
```

**Important**: use the LAN IP of the PC running Django (e.g. `192.168.1.42`), not `localhost`.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/readings/` | X-API-Key | Submit sensor reading from ESP32 |
| GET  | `/api/readings/` | — | List readings (latest 50) |
| GET  | `/api/readings/latest/` | — | Latest reading + recommendations |
| GET  | `/api/alerts/` | — | List alerts + unread count |
| PATCH | `/api/alerts/<id>/read/` | — | Mark alert as read |
| POST | `/api/alerts/mark-all-read/` | — | Mark all alerts as read |
| DELETE | `/api/alerts/delete-read/` | — | Delete read alerts |
| DELETE | `/api/alerts/delete-all/` | — | Delete all alerts |
| GET  | `/api/ventilation/` | — | Current ventilation state |
| POST | `/api/ventilation/control/` | — | Open / close ventilation manually |
| GET  | `/api/thresholds/` | — | Current alert thresholds |
| POST | `/api/thresholds/update/` | — | Update thresholds |
| POST | `/api/chat/` | — | Send message to AI assistant |
| GET  | `/api/chat/status/` | — | Check if Gemini AI is configured |

---

## Running Tests

```powershell
cd backend
python manage.py test
```

107 unit tests, all with Firebase/Twilio/Gemini mocked (no network calls, no real credentials required):

| Suite | File | Covers |
|---|---|---|
| Decision engine | `sensors/tests/test_decision_support.py` | Threshold classification, hysteresis, alert dedup/bundling, `analyze_reading()` integration |
| API views | `sensors/tests/test_views.py` | All `sensors` app endpoints — validation, status codes, response contracts |
| Chatbot | `sensors/tests/test_chatbot.py` | Sensor-context formatting, keyword fallback replies, no-API-key path |
| WhatsApp service | `sensors/tests/test_whatsapp_service.py` | Twilio config detection, number formatting, success/failure handling |
| Ventilation API | `ventilation/tests.py` | Status endpoint, manual open/close control |

Run a single suite with `python manage.py test sensors` or `python manage.py test ventilation`.

---

## Project Structure

```
sekela project/
├── backend/
│   ├── sensors/
│   │   ├── decision_support.py   # threshold logic, hysteresis, alert bundling
│   │   ├── chatbot.py            # Gemini AI integration
│   │   ├── views.py              # REST API endpoints
│   │   ├── urls.py               # URL routing
│   │   └── tests.py              # unit + integration tests
│   ├── firebase_service.py       # all Firebase read/write operations
│   ├── firebase_config.py        # Firebase Admin SDK initialisation
│   └── .env                      # secrets — NOT committed
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx     # live sensor cards + KPI stats + trends
│       │   ├── History.jsx       # charts + CSV export + print report
│       │   ├── Alerts.jsx        # alert inbox with filter + delete actions
│       │   ├── Chat.jsx          # AI assistant chat interface
│       │   ├── Overview.jsx      # system architecture + GPIO + tech stack
│       │   └── Settings.jsx      # threshold editor
│       ├── components/
│       │   └── ...
│       └── .env                  # Firebase keys — NOT committed
├── esp32/
│   └── smart_poultry_monitor.ino # ESP32 firmware (Arduino)
└── start_all.ps1                 # single-command launcher
```

---

## Security Notes

- `backend/.env`, `backend/serviceAccountKey.json`, and `frontend/.env` are in `.gitignore` and must never be committed.
- The ESP32 POST endpoint is protected by an `X-API-Key` header (set `ESP32_API_KEY` in `backend/.env` to enable).
- Firebase security rules should be locked down before deploying to production.

---

## License

MIT — free to use for academic and personal projects.
