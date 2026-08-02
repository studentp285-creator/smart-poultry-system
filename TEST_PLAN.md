# Test Plan — Smart Poultry Environmental Monitoring and Control System

**Prepared for:** BSc Computer Science Final Year Project, Mukuba University
**System under test:** Smart Poultry Monitor (Django REST backend, React dashboard, ESP32 firmware, Firebase Realtime Database, Twilio WhatsApp integration, Gemini AI chatbot)

---

## 1. Purpose

This document defines the scope, strategy, and results of the automated unit testing performed on the backend of the Smart Poultry Environmental Monitoring and Control System. Its goal is to verify that the system's core logic — sensor state classification, alert generation, ventilation/buzzer control decisions, the REST API contract, WhatsApp notification delivery, and the AI assistant's fallback behaviour — behaves correctly and predictably under both normal and edge-case conditions, independent of live hardware, network access, or third-party service availability.

## 2. Scope

### 2.1 In scope

| Component | Reason |
|---|---|
| Decision support engine (`decision_support.py`) | Core business logic — threshold classification, hysteresis, alert bundling, ventilation/buzzer triggers. Highest-risk module: a bug here directly affects animal welfare. |
| REST API views (`sensors/views.py`, `ventilation/views.py`) | Contract between the ESP32/frontend and the backend — validation, status codes, response shape. |
| WhatsApp integration (`whatsapp_service.py`) | External dependency (Twilio) — needs isolation testing so the suite doesn't depend on real credentials or send real messages. |
| Chatbot fallback logic (`chatbot.py`) | Must degrade gracefully and correctly when no Gemini API key is configured. |

### 2.2 Out of scope (and why)

| Component | Reason excluded |
|---|---|
| Frontend (React components) | No test framework is installed in the project (`package.json` has no Jest/Vitest). The frontend is largely a thin presentation layer over Firebase real-time listeners; the logic worth testing (e.g. recommendation text generation) is duplicated from the already-tested backend. Manual/exploratory testing was used instead (see §7). |
| ESP32 firmware | Arduino C++ code cannot run inside the Django test runner; verified instead through manual hardware testing (Serial Monitor output, physical servo/buzzer observation) documented separately. |
| Firebase Realtime Database itself | Treated as a trusted third-party service. All `firebase_service.py` calls are mocked at the view/engine layer rather than hitting a real database, so these are unit tests, not integration tests against live Firebase. |
| Twilio's actual delivery network | Mocked at the `twilio.rest.Client` boundary. Real end-to-end delivery was verified manually once during development (see §7), not as part of the automated suite. |
| Gemini AI's live responses | Non-deterministic and network-dependent; only the deterministic fallback path (used when no API key is set) is unit tested. |

## 3. Test Strategy

**Approach:** White-box unit testing using Django's built-in test runner (`unittest` + `django.test.TestCase`) and Django REST Framework's `APIClient`.

**Isolation principle:** Every test mocks its external dependencies so the suite runs deterministically, offline, and without needing `serviceAccountKey.json`, a live Firebase project, or Twilio/Gemini credentials:
- `firebase_service` (`fs`) is patched with `unittest.mock.patch` wherever a view or the decision engine would otherwise read/write Firebase.
- `twilio.rest.Client` is patched so no real WhatsApp message is ever sent by the test suite.
- Gemini's `google.genai` client is never invoked — chatbot tests only exercise the code path taken when `GEMINI_API_KEY` is empty.

**Test types included:**
- **Pure unit tests** — single-function tests with no dependencies (e.g. `_raw_state`, `_fallback`).
- **Integration-style unit tests** — `analyze_reading()` tested end-to-end with only Firebase mocked, exercising the real interaction between classification, hysteresis, and alert bundling.
- **API contract tests** — every endpoint tested via `APIClient` for status codes, validation errors, and response shape.

## 4. Test Environment

| Item | Value |
|---|---|
| Framework | Django 4.x test runner (`python manage.py test`) |
| Language/runtime | Python 3.13/3.14 |
| Mocking | `unittest.mock` (`patch`, `MagicMock`, `patch.dict`) |
| API test client | `rest_framework.test.APIClient` |
| Database | Django's default test DB (SQLite, in-memory) — note the app's real data lives in Firebase, not this DB; it exists only because Django requires one to boot |
| External services | All mocked — no real Firebase, Twilio, or Gemini calls made during automated test runs |

## 5. Test Suite Structure

```
backend/
├── sensors/tests/
│   ├── test_decision_support.py   (48 tests)
│   ├── test_views.py              (33 tests)
│   ├── test_chatbot.py            (13 tests)
│   └── test_whatsapp_service.py   (8 tests)
└── ventilation/
    └── tests.py                   (5 tests)

Total: 107 tests
```

Run the full suite: `cd backend && python manage.py test`
Run one app only: `python manage.py test sensors` / `python manage.py test ventilation`

## 6. Test Case Summary

### 6.1 Decision Support Engine — `test_decision_support.py` (48 tests)

| Test class | Cases | What it verifies |
|---|---|---|
| `RawStateTemperatureTests` | 7 | Temperature correctly classified good/warning/critical, including exact threshold boundaries |
| `RawStateHumidityTests` | 5 | Humidity classification across all bands |
| `RawStateWaterFeedTests` | 6 | Water/feed level classification (inverted logic — low value is bad) |
| `HysteresisTemperatureTests` | 6 | A sensor recovering from warning/critical only downgrades once it clears the threshold by the hysteresis margin — prevents alert flapping on noisy readings |
| `HysteresisWaterTests` | 5 | Same hysteresis behaviour for water level |
| `ShouldAlertTests` | 9 | Alerts fire on state transitions; critical states only re-alert every 30 minutes, not every reading cycle (flood prevention) |
| `BuildBundleTests` | 5 | Multiple simultaneous sensor issues are bundled into one alert message instead of several |
| `AnalyzeReadingIntegrationTests` | 5 | Full `analyze_reading()` pipeline: all-good produces no alerts; critical temperature opens windows + buzzer; all-critical bundles into exactly one alert; mixed states cap at 2 alerts; recovery produces an info-level alert |

### 6.2 API Views — `test_views.py` (33 tests)

| Test class | Cases | What it verifies |
|---|---|---|
| `SensorReadingsPostTests` | 3 | Missing required field → 400; `gas_level` in payload is accepted but silently dropped (proof the ESP32 never needs a firmware change); response reflects ventilation/buzzer state from the decision engine |
| `SensorReadingsGetTests` | 2 | History retrieval and `?limit=` query param handling |
| `DeviceKeyAuthTests` | 3 | POST rejected without matching `X-API-Key` when `ESP32_API_KEY` is set; accepted with the correct key; GET never requires a key |
| `LatestReadingTests` | 2 | 404 when no reading exists yet; recommendations included when one does |
| `SimulateReadingTests` | 1 | Simulated readings never include `gas_level` |
| `SeedDataTests` | 1 | Exactly 48 seed readings generated, none containing `gas_level` |
| `AlertsEndpointTests` | 5 | List, mark-one-read, mark-all-read, delete-all, delete-read-only |
| `CheckEmailTests` | 4 | Missing email → 400; registered/unregistered email correctly reported; input is trimmed and lowercased before the Firebase Admin lookup |
| `ChatStatusTests` | 2 | Reports AI enabled/disabled based on `GEMINI_API_KEY` presence |
| `ThresholdsTests` | 2 | Threshold retrieval and update |
| `AppSettingsTests` | 2 | WhatsApp settings retrieval (incl. `twilio_configured` flag) and save with input sanitisation (trimmed number, coerced boolean) |
| `TestWhatsappEndpointTests` | 4 | 503 when service unavailable; 400 when no number saved; success and failure paths return correct status/body |
| `ChatEndpointTests` | 2 | Empty message rejected; valid message routed to the chatbot with current reading + history |

### 6.3 Chatbot — `test_chatbot.py` (13 tests)

| Test class | Cases | What it verifies |
|---|---|---|
| `FormatSensorContextTests` | 5 | Live-reading summary text: no-data case, all-good case, critical temperature flagged, low water/feed flagged, missing values rendered as `N/A` |
| `FallbackReplyTests` | 7 | Keyword-based canned replies for greetings, temperature, humidity, water, feed, ventilation (confirms gas is no longer mentioned), and unknown input |
| `GetResponseWithoutApiKeyTests` | 1 | `get_response()` correctly falls back to the offline reply path when `GEMINI_API_KEY` is unset |

### 6.4 WhatsApp Service — `test_whatsapp_service.py` (8 tests)

| Test class | Cases | What it verifies |
|---|---|---|
| `IsConfiguredTests` | 3 | Correctly reports configured/unconfigured based on presence of SID and auth token |
| `SendValidationTests` | 2 | Send fails gracefully (no exception) when unconfigured or when no number is supplied |
| `SendSuccessTests` | 2 | Successful send returns the Twilio message SID; `whatsapp:` prefix added once, never duplicated |
| `SendFailureTests` | 1 | Twilio exceptions are caught and returned as a readable error string, not raised |

### 6.5 Ventilation API — `ventilation/tests.py` (5 tests)

| Test class | Cases | What it verifies |
|---|---|---|
| `VentilationStatusTests` | 1 | Current ventilation state returned correctly |
| `VentilationControlTests` | 4 | Missing/invalid action → 400; open/close actions call Firebase with the correct manual-override state and reason string |

## 7. Manual / Exploratory Testing (supplementary, not automated)

The following were verified manually during development, outside the automated suite, and are documented here for completeness of the overall test effort:

| Scenario | Method | Result |
|---|---|---|
| End-to-end alert → WhatsApp delivery | Triggered a real critical reading via the API, tracked the Twilio message SID through to `delivered` status via the Twilio API | Confirmed delivered |
| Sandbox join / number formatting edge cases | Manually reproduced Twilio error 63015 (sandbox not joined) and a malformed phone number, root-caused, and fixed | Confirmed working after fix |
| Frontend real-time updates | Manual browser testing — Dashboard/History/Alerts pages against live Firebase `onValue()` listeners | Confirmed working |
| Password reset flow | Manually tested with both a registered and an unregistered email against the live Firebase Auth + `check-email` endpoint | Confirmed correct behaviour for both cases |
| ESP32 firmware | Serial Monitor output inspected for Wi-Fi connection, sensor read failures, and HTTP response handling | Pending final hardware bring-up |

## 8. Pass/Fail Criteria

A test run is considered **passing** when all automated tests complete with zero failures and zero errors, as reported by Django's test runner (`OK` status). Any failure blocks further feature work until root-caused and fixed, per the workflow followed throughout this project (e.g. the gas-sensor-removal change was validated against the full suite before being considered complete).

## 9. Results Summary

```
Ran 107 tests in ~2.3s
OK — 0 failures, 0 errors
```

| Suite | Tests | Status |
|---|---|---|
| Decision support engine | 48 | ✅ Pass |
| API views | 33 | ✅ Pass |
| Chatbot | 13 | ✅ Pass |
| WhatsApp service | 8 | ✅ Pass |
| Ventilation API | 5 | ✅ Pass |
| **Total** | **107** | **✅ All passing** |

## 10. Known Limitations

- Frontend has no automated test coverage (documented rationale in §2.2).
- The decision engine and API view tests use mocked Firebase, so they verify *logic correctness* and *contract correctness* independently, but do not by themselves prove the real Firebase integration is wired correctly end-to-end — that was validated separately through manual testing (§7).
- ESP32 firmware has no automated tests (not feasible in this toolchain) and relies on manual hardware verification.
