"""
Unit tests for the chatbot fallback logic (no Gemini API key required).
Run with:  python manage.py test sensors
"""

from django.test import TestCase
from unittest.mock import patch
from ..chatbot import _fmt_sensor_context, _fallback, get_response


class FormatSensorContextTests(TestCase):
    def test_no_data(self):
        self.assertIn('No live sensor data', _fmt_sensor_context(None))

    def test_all_good_no_issues_listed(self):
        ctx = _fmt_sensor_context({'temperature': 23, 'humidity': 58, 'water_level': 75, 'feed_level': 70})
        self.assertIn('All readings within safe ranges', ctx)
        self.assertNotIn('Active alerts', ctx)

    def test_critical_temperature_flagged(self):
        ctx = _fmt_sensor_context({'temperature': 38, 'humidity': 58, 'water_level': 75, 'feed_level': 70})
        self.assertIn('Active alerts', ctx)
        self.assertIn('Temperature CRITICAL', ctx)

    def test_low_water_and_feed_flagged(self):
        ctx = _fmt_sensor_context({'temperature': 23, 'humidity': 58, 'water_level': 10, 'feed_level': 30})
        self.assertIn('Water CRITICAL', ctx)
        self.assertIn('Feed WARNING', ctx)

    def test_missing_values_render_as_na(self):
        ctx = _fmt_sensor_context({'temperature': None, 'humidity': 58, 'water_level': 75, 'feed_level': 70})
        self.assertIn('N/A', ctx)


class FallbackReplyTests(TestCase):
    def test_greeting(self):
        self.assertIn('Smart Poultry Assistant', _fallback('hello there'))

    def test_temperature_keyword(self):
        self.assertIn('18–28°C', _fallback('what is the ideal temperature?'))

    def test_humidity_keyword(self):
        self.assertIn('50–65%', _fallback('tell me about humidity'))

    def test_water_keyword(self):
        self.assertIn('Water below 15%', _fallback('water level status'))

    def test_feed_keyword(self):
        self.assertIn('Feed below 15%', _fallback('how is the food'))

    def test_ventilation_keyword_no_longer_mentions_gas(self):
        reply = _fallback('when do the windows open')
        self.assertIn('28°C', reply)
        self.assertNotIn('gas', reply.lower())
        self.assertNotIn('ppm', reply.lower())

    def test_unknown_message_returns_generic_help(self):
        self.assertIn('Ask me about', _fallback('xyzzy nonsense'))


class GetResponseWithoutApiKeyTests(TestCase):
    @patch.dict('os.environ', {'GEMINI_API_KEY': ''})
    def test_falls_back_when_no_api_key(self):
        reply = get_response('hello', current_data=None, history=[])
        self.assertEqual(reply, _fallback('hello'))
