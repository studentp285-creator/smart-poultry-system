"""
Unit tests for the decision support engine.
Run with:  python manage.py test sensors
"""

from django.test import TestCase
from unittest.mock import patch, MagicMock
from ..decision_support import (
    _raw_state, _sensor_state, _should_alert, _build_bundle, _detail,
    HYSTERESIS,
)

# Default thresholds matching firebase_service.DEFAULT_THRESHOLDS
THRESHOLDS = {
    'temperature': {'warn_high': 28.0, 'crit_high': 32.0, 'warn_low': 18.0, 'crit_low': 10.0},
    'humidity':    {'warn_high': 65.0, 'crit_high': 75.0, 'warn_low': 50.0, 'crit_low': 40.0},
    'water_level': {'warn_low': 30.0, 'crit_low': 15.0},
    'feed_level':  {'warn_low': 30.0, 'crit_low': 15.0},
}


# ── _raw_state ────────────────────────────────────────────────────────────────

class RawStateTemperatureTests(TestCase):
    def test_good_midrange(self):
        self.assertEqual(_raw_state('temperature', 23.0, THRESHOLDS), 'good')

    def test_warning_high(self):
        self.assertEqual(_raw_state('temperature', 29.0, THRESHOLDS), 'warning')

    def test_warning_low(self):
        self.assertEqual(_raw_state('temperature', 17.0, THRESHOLDS), 'warning')

    def test_critical_high(self):
        self.assertEqual(_raw_state('temperature', 33.0, THRESHOLDS), 'critical')

    def test_critical_low(self):
        self.assertEqual(_raw_state('temperature', 9.0, THRESHOLDS), 'critical')

    def test_exact_warn_high_boundary(self):
        self.assertEqual(_raw_state('temperature', 28.0, THRESHOLDS), 'warning')

    def test_exact_crit_high_boundary(self):
        self.assertEqual(_raw_state('temperature', 32.0, THRESHOLDS), 'critical')


class RawStateHumidityTests(TestCase):
    def test_good(self):
        self.assertEqual(_raw_state('humidity', 58.0, THRESHOLDS), 'good')

    def test_warning_high(self):
        self.assertEqual(_raw_state('humidity', 70.0, THRESHOLDS), 'warning')

    def test_critical_high(self):
        self.assertEqual(_raw_state('humidity', 80.0, THRESHOLDS), 'critical')

    def test_warning_low(self):
        self.assertEqual(_raw_state('humidity', 45.0, THRESHOLDS), 'warning')

    def test_critical_low(self):
        self.assertEqual(_raw_state('humidity', 35.0, THRESHOLDS), 'critical')


class RawStateWaterFeedTests(TestCase):
    def test_water_good(self):
        self.assertEqual(_raw_state('water_level', 80.0, THRESHOLDS), 'good')

    def test_water_warning(self):
        self.assertEqual(_raw_state('water_level', 20.0, THRESHOLDS), 'warning')

    def test_water_critical(self):
        self.assertEqual(_raw_state('water_level', 10.0, THRESHOLDS), 'critical')

    def test_feed_good(self):
        self.assertEqual(_raw_state('feed_level', 70.0, THRESHOLDS), 'good')

    def test_feed_warning(self):
        self.assertEqual(_raw_state('feed_level', 25.0, THRESHOLDS), 'warning')

    def test_feed_critical(self):
        self.assertEqual(_raw_state('feed_level', 5.0, THRESHOLDS), 'critical')


# ── _sensor_state (hysteresis) ────────────────────────────────────────────────

class HysteresisTemperatureTests(TestCase):
    """
    Temperature warn_high = 28°C, hysteresis = 1.5°C.
    Recovery to good requires value < 26.5°C.
    """

    def test_escalation_is_immediate(self):
        # Good → warning: no hysteresis needed
        self.assertEqual(_sensor_state('temperature', 28.5, THRESHOLDS, 'good'), 'warning')

    def test_warning_to_good_below_hysteresis(self):
        # 27°C is below warn_high but NOT below (28 - 1.5 = 26.5) → still warning
        self.assertEqual(_sensor_state('temperature', 27.0, THRESHOLDS, 'warning'), 'warning')

    def test_warning_to_good_above_hysteresis(self):
        # 26.0°C < 26.5 → finally good
        self.assertEqual(_sensor_state('temperature', 26.0, THRESHOLDS, 'warning'), 'good')

    def test_critical_to_warning_requires_hysteresis(self):
        # Just below crit_high (32) but not past hysteresis (32-1.5=30.5) → still critical
        self.assertEqual(_sensor_state('temperature', 31.0, THRESHOLDS, 'critical'), 'critical')

    def test_critical_clears_to_warning(self):
        # 30.0 < 30.5 and > 26.5 but < 28 → warning
        self.assertEqual(_sensor_state('temperature', 30.0, THRESHOLDS, 'critical'), 'warning')

    def test_critical_clears_direct_to_good(self):
        # 25°C clears both critical and warning hysteresis bands → good
        self.assertEqual(_sensor_state('temperature', 25.0, THRESHOLDS, 'critical'), 'good')


class HysteresisWaterTests(TestCase):
    """
    water warn_low = 30%, crit_low = 15%, hysteresis = 2%.
    """

    def test_escalation_immediate(self):
        self.assertEqual(_sensor_state('water_level', 14.0, THRESHOLDS, 'warning'), 'critical')

    def test_critical_does_not_clear_too_early(self):
        self.assertEqual(_sensor_state('water_level', 16.0, THRESHOLDS, 'critical'), 'critical')

    def test_critical_clears_to_warning(self):
        self.assertEqual(_sensor_state('water_level', 18.0, THRESHOLDS, 'critical'), 'warning')

    def test_warning_does_not_clear_too_early(self):
        self.assertEqual(_sensor_state('water_level', 31.0, THRESHOLDS, 'warning'), 'warning')

    def test_warning_clears(self):
        self.assertEqual(_sensor_state('water_level', 33.0, THRESHOLDS, 'warning'), 'good')


# ── _should_alert ─────────────────────────────────────────────────────────────

class ShouldAlertTests(TestCase):
    def test_good_from_good_no_alert(self):
        self.assertFalse(_should_alert('temperature', 'good', {'state': 'good'}))

    def test_good_from_warning_alerts(self):
        self.assertTrue(_should_alert('temperature', 'good', {'state': 'warning'}))

    def test_good_from_critical_alerts(self):
        self.assertTrue(_should_alert('temperature', 'good', {'state': 'critical'}))

    def test_warning_from_good_alerts(self):
        self.assertTrue(_should_alert('temperature', 'warning', {'state': 'good'}))

    def test_warning_same_no_alert(self):
        self.assertFalse(_should_alert('temperature', 'warning', {'state': 'warning'}))

    def test_critical_from_warning_alerts(self):
        self.assertTrue(_should_alert('temperature', 'critical', {'state': 'warning'}))

    def test_critical_same_no_alert_within_30_min(self):
        from datetime import datetime, timezone, timedelta
        recent = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        self.assertFalse(_should_alert('temperature', 'critical', {'state': 'critical', 'last_alert_ts': recent}))

    def test_critical_same_alerts_after_30_min(self):
        from datetime import datetime, timezone, timedelta
        old = (datetime.now(timezone.utc) - timedelta(minutes=35)).isoformat()
        self.assertTrue(_should_alert('temperature', 'critical', {'state': 'critical', 'last_alert_ts': old}))

    def test_critical_no_previous_ts_alerts(self):
        self.assertTrue(_should_alert('temperature', 'critical', {'state': 'critical'}))


# ── _build_bundle ─────────────────────────────────────────────────────────────

class BuildBundleTests(TestCase):
    def test_single_critical_item(self):
        items = [('temperature', 'dangerously hot, open windows now', 'Temperature')]
        sensor_field, msg = _build_bundle(items, 'critical')
        self.assertEqual(sensor_field, 'temperature')
        self.assertIn('CRITICAL', msg)
        self.assertIn('Temperature', msg)
        self.assertIn('Immediate action required', msg)

    def test_multiple_critical_items(self):
        items = [
            ('temperature', '38.0°C — dangerously hot', 'Temperature'),
            ('water_level', '5.0% — critically low',    'Water Level'),
        ]
        sensor_field, msg = _build_bundle(items, 'critical')
        self.assertEqual(sensor_field, 'multiple')
        self.assertIn('2 sensors', msg)
        self.assertIn('• Temperature', msg)
        self.assertIn('• Water Level', msg)

    def test_single_warning_item(self):
        items = [('humidity', '68.0% — too humid', 'Humidity')]
        sensor_field, msg = _build_bundle(items, 'warning')
        self.assertEqual(sensor_field, 'humidity')
        self.assertIn('WARNING', msg)

    def test_single_recovery_item(self):
        items = [('water_level', '65.0% — back to normal', 'Water Level')]
        sensor_field, msg = _build_bundle(items, 'good')
        self.assertIn('Recovered', msg)

    def test_multiple_recovery_items(self):
        items = [
            ('temperature', '22.0°C — back to normal', 'Temperature'),
            ('humidity',    '58.0% — back to normal',  'Humidity'),
        ]
        sensor_field, msg = _build_bundle(items, 'good')
        self.assertEqual(sensor_field, 'multiple')
        self.assertIn('2 sensors', msg)


# ── analyze_reading integration (mocked Firebase) ────────────────────────────

class AnalyzeReadingIntegrationTests(TestCase):
    """
    Tests that analyze_reading() produces correct ventilation/buzzer decisions
    and creates at most 3 alerts per reading cycle.
    """

    def _make_mock(self, prev_states=None, thresholds=None):
        mock_fs = MagicMock()
        mock_fs.get_thresholds.return_value = thresholds or THRESHOLDS
        mock_fs.get_sensor_states.return_value = prev_states or {}
        mock_fs.get_ventilation.return_value = {'is_open': False, 'changed_by': 'auto'}
        return mock_fs

    @patch('sensors.decision_support.fs')
    def test_all_good_no_alerts(self, mock_fs):
        mock_fs.get_thresholds.return_value = THRESHOLDS
        mock_fs.get_sensor_states.return_value = {}
        reading = {'temperature': 23, 'humidity': 58, 'water_level': 75, 'feed_level': 70}
        from ..decision_support import analyze_reading
        result = analyze_reading(reading)
        self.assertFalse(result['open_windows'])
        self.assertFalse(result['trigger_buzzer'])
        self.assertEqual(result['alerts_created'], 0)
        mock_fs.create_alert.assert_not_called()

    @patch('sensors.decision_support.fs')
    def test_high_temp_opens_windows(self, mock_fs):
        mock_fs.get_thresholds.return_value = THRESHOLDS
        mock_fs.get_sensor_states.return_value = {}
        reading = {'temperature': 33, 'humidity': 58, 'water_level': 75, 'feed_level': 70}
        from ..decision_support import analyze_reading
        result = analyze_reading(reading)
        self.assertTrue(result['open_windows'])
        self.assertTrue(result['trigger_buzzer'])

    @patch('sensors.decision_support.fs')
    def test_all_critical_creates_one_alert(self, mock_fs):
        mock_fs.get_thresholds.return_value = THRESHOLDS
        mock_fs.get_sensor_states.return_value = {}
        reading = {'temperature': 38, 'humidity': 85, 'water_level': 5, 'feed_level': 4}
        from ..decision_support import analyze_reading
        result = analyze_reading(reading)
        # All 4 sensors critical → bundled into 1 alert
        self.assertEqual(result['alerts_created'], 1)
        mock_fs.create_alert.assert_called_once()
        _, severity, msg = mock_fs.create_alert.call_args[0]
        self.assertEqual(severity, 'critical')
        self.assertIn('4 sensors', msg)

    @patch('sensors.decision_support.fs')
    def test_mixed_states_max_two_alerts(self, mock_fs):
        mock_fs.get_thresholds.return_value = THRESHOLDS
        mock_fs.get_sensor_states.return_value = {}
        # temperature critical, humidity warning, rest good
        reading = {'temperature': 35, 'humidity': 70, 'water_level': 75, 'feed_level': 70}
        from ..decision_support import analyze_reading
        result = analyze_reading(reading)
        self.assertLessEqual(result['alerts_created'], 2)

    @patch('sensors.decision_support.fs')
    def test_recovery_creates_info_alert(self, mock_fs):
        mock_fs.get_thresholds.return_value = THRESHOLDS
        # Previously temperature was warning
        mock_fs.get_sensor_states.return_value = {
            'temperature': {'state': 'warning', 'last_alert_ts': None}
        }
        # Now well within good range (past hysteresis)
        reading = {'temperature': 22, 'humidity': 58, 'water_level': 75, 'feed_level': 70}
        from ..decision_support import analyze_reading
        result = analyze_reading(reading)
        if result['alerts_created'] > 0:
            args = mock_fs.create_alert.call_args[0]
            self.assertEqual(args[1], 'info')
