/**
 * Smart Poultry Environmental Monitor — ESP32 Firmware
 *
 * Board   : ESP32 Dev Module (select in Arduino IDE: Tools > Board > ESP32 Arduino > ESP32 Dev Module)
 * Libraries required (install via Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson (>= 6.x) by Benoit Blanchon
 *   - ESP32Servo by Kevin Harrington
 *
 * Wiring summary (no external resistors — breakout modules only, each with onboard
 * pull-up/divider circuitry already built into the module's PCB):
 *   DHT11        VCC → 3.3V, DATA → GPIO 4, GND → GND
 *   Water sensor AOUT → GPIO 35 (ADC1)
 *   HC-SR04      VCC → 3.3V (NOT 5V — keeps ECHO's output pulse within the ESP32's
 *                3.3V GPIO limit so it can go straight to ECHO_PIN with no divider),
 *                TRIG → GPIO 18, ECHO → GPIO 19, GND → GND
 *   Servo motor  PWM  → GPIO 21
 *   Buzzer       +    → GPIO 22 (passive buzzer)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ─── USER CONFIGURATION ──────────────────────────────────────────────────────
const char* WIFI_SSID       = "sekela";
const char* WIFI_PASSWORD   = "12345678";

// Replace with the IP address of the computer running Django (use IPv4, NOT localhost)
const char* SERVER_URL      = "http://192.168.43.228:8000/api/readings/";
const char* VENTILATION_URL = "http://192.168.43.228:8000/api/ventilation/";
const char* HEARTBEAT_URL   = "http://192.168.43.228:8000/api/device/heartbeat/";

// Optional: set this to the value of ESP32_API_KEY in your backend/.env
// Leave empty ("") if you have not enabled API key authentication.
const char* API_KEY         = "";

// ─── PIN DEFINITIONS ─────────────────────────────────────────────────────────
#define DHT_PIN         4
#define WATER_PIN       35
#define TRIG_PIN        18
#define ECHO_PIN        19
#define SERVO_PIN       21
#define BUZZER_PIN      22

// ─── SENSOR CALIBRATION ──────────────────────────────────────────────────────
#define DHT_TYPE             DHT11

// Feed hopper: distance from sensor when container is empty vs. full
#define FEED_EMPTY_CM        30.0
#define FEED_FULL_CM         4.0

// Floating-pin detection: GPIO35 is an input-only ADC1 pin with no internal
// pull resistor, so a disconnected sensor doesn't read 0 — it floats and picks
// up ambient EMI, producing large rapid swings. A handful of back-to-back
// samples on a real (even idle) sensor stay tight; a floating pin doesn't.
#define FLOAT_CHECK_SAMPLES     8
#define FLOAT_CHECK_THRESHOLD   600   // max-min spread (out of 4095) above which a pin is considered floating

// A floating pin can also settle at a plausible-looking value for one whole
// cycle and then drift to a different one the next — a fast burst check won't
// catch that. A water trough / feed hopper physically can't empty or refill
// this much in one 30 s cycle, so treat a jump this large as noise unless it
// repeats on the very next cycle too (which means it's a genuine fast change).
#define MAX_LEVEL_DELTA_PCT     20.0

// ─── TIMING ──────────────────────────────────────────────────────────────────
const unsigned long READ_INTERVAL_MS    = 30000;  // send a reading every 30 s
const unsigned long VENT_POLL_INTERVAL_MS = 5000; // check ventilation commands + send heartbeat this
                                                   // often, independent of the sensor-read cycle above
const unsigned long WIFI_TIMEOUT_MS     = 15000;  // max time to wait for Wi-Fi
const unsigned long HTTP_TIMEOUT_MS     = 10000;  // HTTP request timeout

// ─── OBJECTS ─────────────────────────────────────────────────────────────────
DHT    dht(DHT_PIN, DHT_TYPE);
Servo  ventServo;

unsigned long lastReadMs = 0;
unsigned long lastVentPollMs = 0;

// Plausibility-filter state (see MAX_LEVEL_DELTA_PCT above)
float lastAcceptedWaterLevel = -1.0;
float pendingWaterLevel      = -1.0;
float lastAcceptedFeedLevel  = -1.0;
float pendingFeedLevel       = -1.0;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

void beep(int freq, int durationMs) {
  // Bit-banged square wave instead of ledcWriteTone(): the ESP32 has only a
  // handful of hardware PWM timers, and ESP32Servo also needs one for the
  // vent servo's signal. Sharing the LEDC hardware between the two caused the
  // buzzer to silently steal/retune the servo's timer, breaking vent control.
  unsigned long halfPeriodUs = 500000UL / freq;
  unsigned long endTime = millis() + durationMs;
  while (millis() < endTime) {
    digitalWrite(BUZZER_PIN, HIGH);
    delayMicroseconds(halfPeriodUs);
    digitalWrite(BUZZER_PIN, LOW);
    delayMicroseconds(halfPeriodUs);
  }
}

void alertBeep() {
  // Two short high-pitched beeps — critical event tone
  beep(880, 150); delay(80);
  beep(880, 150);
}

float readDistance() {
  // HC-SR04 ultrasonic distance in centimetres
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // 30 ms timeout
  if (duration == 0) return -1.0;
  return duration * 0.0343 / 2.0;
}

float distanceToFeedPercent(float cm) {
  if (cm < 0) return -1.0;
  float pct = (FEED_EMPTY_CM - cm) / (FEED_EMPTY_CM - FEED_FULL_CM) * 100.0;
  return constrain(pct, 0.0, 100.0);
}

float adcToWaterPercent(int raw) {
  // Maps 0–4095 ADC reading to 0–100 %
  return constrain(raw / 4095.0 * 100.0, 0.0, 100.0);
}

bool isAnalogFloating(int pin) {
  int minVal = 4095, maxVal = 0;
  for (int i = 0; i < FLOAT_CHECK_SAMPLES; i++) {
    int v = analogRead(pin);
    minVal = min(minVal, v);
    maxVal = max(maxVal, v);
    delayMicroseconds(500);
  }
  return (maxVal - minVal) > FLOAT_CHECK_THRESHOLD;
}

// Rejects single-cycle noise spikes while still letting a genuine fast change
// through once it's confirmed on a second consecutive cycle. Returns true and
// updates lastAccepted when newValue should be used; false means skip this cycle.
bool acceptLevelReading(float newValue, float &lastAccepted, float &pending) {
  if (lastAccepted < 0 || fabs(newValue - lastAccepted) <= MAX_LEVEL_DELTA_PCT) {
    lastAccepted = newValue;
    pending = -1.0;
    return true;
  }
  if (pending >= 0 && fabs(newValue - pending) <= MAX_LEVEL_DELTA_PCT) {
    lastAccepted = newValue;   // same jump confirmed twice in a row — treat as real
    pending = -1.0;
    return true;
  }
  pending = newValue;
  return false;
}

void setVentilation(bool open) {
  ventServo.write(open ? 90 : 0);
}

// Applies manual/auto ventilation state from the server immediately, without
// waiting for a full sensor-read cycle (which can be skipped for several
// minutes while a sensor's plausibility filter settles).
void pollVentilation() {
  HTTPClient http;
  http.begin(VENTILATION_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (strlen(API_KEY) > 0) {
    http.addHeader("X-API-Key", API_KEY);
  }
  int code = http.GET();
  if (code == 200) {
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, http.getString())) {
      bool ventOpen = doc["is_open"] | false;
      setVentilation(ventOpen);
      Serial.printf("[vent poll] server says: %s\n", ventOpen ? "OPEN" : "CLOSED");
    }
  } else {
    Serial.printf("[vent poll] HTTP GET failed, code %d\n", code);
  }
  http.end();
}

// Proves this device is powered on and can reach the backend — nothing more.
// Deliberately independent of sensor reads: a failing sensor (e.g. the
// HC-SR04 losing its echo) must never make an otherwise-healthy, connected
// device look "offline" to the backend's device-watch alert.
void sendHeartbeat() {
  HTTPClient http;
  http.begin(HEARTBEAT_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (strlen(API_KEY) > 0) {
    http.addHeader("X-API-Key", API_KEY);
  }
  int code = http.POST("");
  if (code != 200) {
    Serial.printf("[heartbeat] failed, code %d\n", code);
  }
  http.end();
}

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi connected — IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWi-Fi connection FAILED. Will retry on next cycle.");
  }
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Smart Poultry Monitor — booting…");

  // Pin modes
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Servo
  ventServo.attach(SERVO_PIN);
  setVentilation(false);  // start closed

  // DHT
  dht.begin();

  // Wi-Fi
  connectWiFi();

  Serial.println("Setup complete.");
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────

void loop() {
  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi lost — reconnecting…");
    connectWiFi();
    return;
  }

  unsigned long now = millis();

  if (now - lastVentPollMs >= VENT_POLL_INTERVAL_MS) {
    lastVentPollMs = now;
    pollVentilation();
    sendHeartbeat();
  }

  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  // ── Read sensors ──────────────────────────────────────────────────────────
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 read failed — skipping cycle.");
    return;
  }

  if (isAnalogFloating(WATER_PIN)) {
    Serial.println("Water level sensor disconnected or unstable (floating ADC input) — skipping this reading cycle.");
    return;
  }
  int   waterRaw     = analogRead(WATER_PIN);
  float waterLevelRaw = adcToWaterPercent(waterRaw);
  if (!acceptLevelReading(waterLevelRaw, lastAcceptedWaterLevel, pendingWaterLevel)) {
    Serial.printf("Water level reading implausible (%.1f%% vs last accepted %.1f%%) — likely sensor noise, skipping cycle.\n", waterLevelRaw, lastAcceptedWaterLevel);
    return;
  }
  float waterLevel = lastAcceptedWaterLevel;

  float distCm     = readDistance();
  Serial.printf("HC-SR04 raw distance: %.1f cm  (FEED_EMPTY_CM=%.1f  FEED_FULL_CM=%.1f)\n", distCm, FEED_EMPTY_CM, FEED_FULL_CM);
  float feedLevelRaw = distanceToFeedPercent(distCm);
  if (feedLevelRaw < 0) {
    Serial.println("HC-SR04 read failed (no echo) — sensor disconnected or out of range. Skipping this reading cycle.");
    return;
  }
  if (!acceptLevelReading(feedLevelRaw, lastAcceptedFeedLevel, pendingFeedLevel)) {
    Serial.printf("Feed level reading implausible (%.1f%% vs last accepted %.1f%%) — likely sensor noise, skipping cycle.\n", feedLevelRaw, lastAcceptedFeedLevel);
    return;
  }
  float feedLevel = lastAcceptedFeedLevel;

  Serial.printf(
    "Sensors → Temp: %.1f°C  Hum: %.1f%%  Water: %.1f%%  Feed: %.1f%%\n",
    temperature, humidity, waterLevel, feedLevel
  );

  // ── Build JSON payload ────────────────────────────────────────────────────
  StaticJsonDocument<256> doc;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"]    = round(humidity    * 10) / 10.0;
  doc["water_level"] = round(waterLevel  * 10) / 10.0;
  doc["feed_level"]  = round(feedLevel   * 10) / 10.0;

  String payload;
  serializeJson(doc, payload);

  // ── Send HTTP POST ────────────────────────────────────────────────────────
  HTTPClient http;
  http.begin(SERVER_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  if (strlen(API_KEY) > 0) {
    http.addHeader("X-API-Key", API_KEY);
  }

  int httpCode = http.POST(payload);
  Serial.printf("HTTP POST → %d\n", httpCode);

  if (httpCode == 201) {
    String response = http.getString();
    Serial.println("Response: " + response);

    StaticJsonDocument<256> resp;
    DeserializationError err = deserializeJson(resp, response);

    if (!err) {
      bool ventOpen      = resp["ventilation_open"] | false;
      bool buzzerTrigger = resp["buzzer_triggered"]  | false;

      // Act on commands from the server
      setVentilation(ventOpen);
      Serial.printf("Ventilation: %s\n", ventOpen ? "OPEN" : "CLOSED");

      if (buzzerTrigger) {
        alertBeep();
        Serial.println("Buzzer triggered — critical alert.");
      }
    } else {
      Serial.println("JSON parse error: " + String(err.c_str()));
    }
  } else if (httpCode == 401) {
    Serial.println("Authentication failed — check API_KEY matches backend/.env ESP32_API_KEY");
  } else {
    Serial.println("HTTP error: " + String(httpCode) + " — " + http.errorToString(httpCode));
  }

  http.end();
}
