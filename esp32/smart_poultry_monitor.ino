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
 * Wiring summary:
 *   DHT22        DATA → GPIO 4  (with 10 kΩ pull-up to 3.3 V)
 *   MQ-135       AOUT → GPIO 34 (ADC1 — no pull-up needed)
 *   Water sensor AOUT → GPIO 35 (ADC1 — wire as voltage divider with 10 kΩ)
 *   HC-SR04      TRIG → GPIO 18, ECHO → GPIO 19
 *   Servo motor  PWM  → GPIO 21
 *   Buzzer       +    → GPIO 22 (passive buzzer)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ─── USER CONFIGURATION ──────────────────────────────────────────────────────
const char* WIFI_SSID       = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD   = "YOUR_WIFI_PASSWORD";

// Replace with the IP address of the computer running Django (use IPv4, NOT localhost)
const char* SERVER_URL      = "http://192.168.1.XXX:8000/api/readings/";

// Optional: set this to the value of ESP32_API_KEY in your backend/.env
// Leave empty ("") if you have not enabled API key authentication.
const char* API_KEY         = "";

// ─── PIN DEFINITIONS ─────────────────────────────────────────────────────────
#define DHT_PIN         4
#define GAS_PIN         34
#define WATER_PIN       35
#define TRIG_PIN        18
#define ECHO_PIN        19
#define SERVO_PIN       21
#define BUZZER_PIN      22

// ─── SENSOR CALIBRATION ──────────────────────────────────────────────────────
#define DHT_TYPE             DHT22

// Feed hopper: distance from sensor when container is empty vs. full
#define FEED_EMPTY_CM        28.0
#define FEED_FULL_CM         3.0

// MQ-135 ADC → ppm mapping (straight-line approximation, tune with calibration)
// Adjust CLEAN_AIR_VOLTAGE to the ADC reading you observe in fresh air.
#define MQ135_CLEAN_ADC      400
#define MQ135_PPM_SCALE      0.25   // ppm per ADC unit above clean-air baseline

// ─── TIMING ──────────────────────────────────────────────────────────────────
const unsigned long READ_INTERVAL_MS    = 30000;  // send a reading every 30 s
const unsigned long WIFI_TIMEOUT_MS     = 15000;  // max time to wait for Wi-Fi
const unsigned long HTTP_TIMEOUT_MS     = 10000;  // HTTP request timeout

// ─── OBJECTS ─────────────────────────────────────────────────────────────────
DHT    dht(DHT_PIN, DHT_TYPE);
Servo  ventServo;

unsigned long lastReadMs = 0;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

void beep(int freq, int durationMs) {
  ledcWriteTone(0, freq);
  delay(durationMs);
  ledcWriteTone(0, 0);
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

float adcToGasPpm(int raw) {
  int above = max(0, raw - MQ135_CLEAN_ADC);
  return above * MQ135_PPM_SCALE;
}

void setVentilation(bool open) {
  ventServo.write(open ? 90 : 0);
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

  // PWM channel 0 for buzzer
  ledcSetup(0, 2000, 8);
  ledcAttachPin(BUZZER_PIN, 0);

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
  if (now - lastReadMs < READ_INTERVAL_MS) return;
  lastReadMs = now;

  // ── Read sensors ──────────────────────────────────────────────────────────
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT22 read failed — skipping cycle.");
    return;
  }

  int   gasRaw     = analogRead(GAS_PIN);
  float gasLevel   = adcToGasPpm(gasRaw);

  int   waterRaw   = analogRead(WATER_PIN);
  float waterLevel = adcToWaterPercent(waterRaw);

  float distCm     = readDistance();
  float feedLevel  = distanceToFeedPercent(distCm);
  if (feedLevel < 0) {
    Serial.println("HC-SR04 read failed — using 50% placeholder.");
    feedLevel = 50.0;
  }

  Serial.printf(
    "Sensors → Temp: %.1f°C  Hum: %.1f%%  Gas: %.1f ppm  Water: %.1f%%  Feed: %.1f%%\n",
    temperature, humidity, gasLevel, waterLevel, feedLevel
  );

  // ── Build JSON payload ────────────────────────────────────────────────────
  StaticJsonDocument<256> doc;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"]    = round(humidity    * 10) / 10.0;
  doc["gas_level"]   = round(gasLevel    * 10) / 10.0;
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
