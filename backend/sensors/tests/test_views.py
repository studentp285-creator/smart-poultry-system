"""
Unit tests for the sensors app's REST API views.
Firebase, the decision engine, WhatsApp, and the chatbot are mocked so these
tests exercise only the view layer (request/response contract, validation,
status codes) — decision logic itself is covered in test_decision_support.py.

Run with:  python manage.py test sensors
"""

from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient
from rest_framework import status


class SensorReadingsPostTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('sensor-readings')

    def test_missing_required_field_returns_400(self):
        resp = self.client.post(self.url, {'temperature': 25, 'humidity': 50, 'water_level': 80}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('feed_level', resp.data['error'])

    @patch('sensors.views.fs')
    @patch('sensors.views.analyze_reading')
    def test_valid_payload_ignores_gas_level_and_returns_201(self, mock_analyze, mock_fs):
        mock_analyze.return_value = {
            'open_windows': False, 'trigger_buzzer': False,
            'alerts_created': 0, 'reason': '',
        }
        mock_fs.save_reading.return_value = 'abc123'
        mock_fs.get_ventilation.return_value = {'is_open': False}

        payload = {'temperature': 25, 'humidity': 50, 'gas_level': 999, 'water_level': 80, 'feed_level': 70}
        resp = self.client.post(self.url, payload, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['id'], 'abc123')
        # gas_level must be dropped before being saved/analyzed — ESP32 can keep
        # sending it without a firmware change and it's simply ignored.
        saved_reading = mock_fs.save_reading.call_args[0][0]
        self.assertNotIn('gas_level', saved_reading)
        self.assertEqual(set(saved_reading.keys()), {'temperature', 'humidity', 'water_level', 'feed_level'})

    @patch('sensors.views.fs')
    @patch('sensors.views.analyze_reading')
    def test_response_reflects_ventilation_and_buzzer_state(self, mock_analyze, mock_fs):
        mock_analyze.return_value = {
            'open_windows': True, 'trigger_buzzer': True,
            'alerts_created': 1, 'reason': 'Temp critical (38.0°C)',
        }
        mock_fs.save_reading.return_value = 'xyz'
        mock_fs.get_ventilation.return_value = {'is_open': True}

        payload = {'temperature': 38, 'humidity': 50, 'water_level': 80, 'feed_level': 70}
        resp = self.client.post(self.url, payload, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['ventilation_open'])
        self.assertTrue(resp.data['buzzer_triggered'])
        self.assertEqual(resp.data['alerts_created'], 1)


class SensorReadingsGetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('sensor-readings')

    @patch('sensors.views.fs')
    def test_get_returns_history(self, mock_fs):
        mock_fs.get_history.return_value = [{'id': '1', 'temperature': 25}]
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.get_history.assert_called_once_with(50)
        self.assertEqual(resp.data, [{'id': '1', 'temperature': 25}])

    @patch('sensors.views.fs')
    def test_get_respects_limit_query_param(self, mock_fs):
        mock_fs.get_history.return_value = []
        self.client.get(self.url, {'limit': 10})
        mock_fs.get_history.assert_called_once_with(10)


class DeviceKeyAuthTests(TestCase):
    """The ESP32 X-API-Key check only activates when ESP32_API_KEY is set."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('sensor-readings')

    @patch('sensors.views._DEVICE_KEY', 'secret123')
    def test_post_rejected_without_matching_key(self):
        resp = self.client.post(self.url, {'temperature': 25, 'humidity': 50, 'water_level': 80, 'feed_level': 70}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('sensors.views.fs')
    @patch('sensors.views.analyze_reading')
    @patch('sensors.views._DEVICE_KEY', 'secret123')
    def test_post_accepted_with_matching_key(self, mock_analyze, mock_fs):
        mock_analyze.return_value = {'open_windows': False, 'trigger_buzzer': False, 'alerts_created': 0, 'reason': ''}
        mock_fs.save_reading.return_value = 'abc'
        mock_fs.get_ventilation.return_value = {'is_open': False}

        resp = self.client.post(
            self.url,
            {'temperature': 25, 'humidity': 50, 'water_level': 80, 'feed_level': 70},
            format='json',
            HTTP_X_API_KEY='secret123',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    @patch('sensors.views._DEVICE_KEY', '')
    def test_get_never_requires_key(self):
        with patch('sensors.views.fs') as mock_fs:
            mock_fs.get_history.return_value = []
            resp = self.client.get(self.url)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)


class LatestReadingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('latest-reading')

    @patch('sensors.views.fs')
    def test_no_reading_returns_404(self, mock_fs):
        mock_fs.get_latest_reading.return_value = None
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    @patch('sensors.views.fs')
    def test_reading_present_includes_recommendations(self, mock_fs):
        mock_fs.get_latest_reading.return_value = {
            'temperature': 23, 'humidity': 58, 'water_level': 75, 'feed_level': 70,
        }
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('reading', resp.data)
        self.assertIn('recommendations', resp.data)
        self.assertEqual(len(resp.data['recommendations']), 4)  # temp, humidity, water, feed


class AlertsEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('sensors.views.fs')
    def test_alerts_list(self, mock_fs):
        mock_fs.get_alerts.return_value = [{'id': '1', 'severity': 'critical'}]
        mock_fs.get_unread_count.return_value = 1
        resp = self.client.get(reverse('alerts-list'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['unread_count'], 1)
        self.assertEqual(len(resp.data['alerts']), 1)

    @patch('sensors.views.fs')
    def test_mark_alert_read(self, mock_fs):
        resp = self.client.patch(reverse('mark-alert-read', args=['abc123']))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.mark_alert_read.assert_called_once_with('abc123')

    @patch('sensors.views.fs')
    def test_mark_all_read(self, mock_fs):
        resp = self.client.post(reverse('mark-all-read'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.mark_all_alerts_read.assert_called_once()

    @patch('sensors.views.fs')
    def test_delete_all_alerts(self, mock_fs):
        resp = self.client.delete(reverse('delete-all-alerts'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.delete_all_alerts.assert_called_once()

    @patch('sensors.views.fs')
    def test_delete_read_alerts_returns_count(self, mock_fs):
        mock_fs.delete_read_alerts.return_value = 3
        resp = self.client.delete(reverse('delete-read-alerts'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['deleted'], 3)


class CheckEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('check-email')

    def test_no_email_returns_400(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('sensors.views.fs')
    def test_registered_email(self, mock_fs):
        mock_fs.email_is_registered.return_value = True
        resp = self.client.post(self.url, {'email': 'farmer@example.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['registered'])

    @patch('sensors.views.fs')
    def test_unregistered_email(self, mock_fs):
        mock_fs.email_is_registered.return_value = False
        resp = self.client.post(self.url, {'email': 'nobody@example.com'}, format='json')
        self.assertFalse(resp.data['registered'])

    @patch('sensors.views.fs')
    def test_email_is_lowercased_and_trimmed(self, mock_fs):
        mock_fs.email_is_registered.return_value = True
        self.client.post(self.url, {'email': '  Farmer@Example.com  '}, format='json')
        mock_fs.email_is_registered.assert_called_once_with('farmer@example.com')


class ChatStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('chat-status')

    @patch.dict('os.environ', {'GEMINI_API_KEY': 'somekey'})
    def test_enabled_when_key_present(self):
        resp = self.client.get(self.url)
        self.assertTrue(resp.data['ai_enabled'])

    @patch.dict('os.environ', {'GEMINI_API_KEY': ''})
    def test_disabled_when_key_missing(self):
        resp = self.client.get(self.url)
        self.assertFalse(resp.data['ai_enabled'])


class ThresholdsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('sensors.views.fs')
    def test_get_thresholds(self, mock_fs):
        mock_fs.get_thresholds.return_value = {'temperature': {'warn_high': 28.0}}
        resp = self.client.get(reverse('get-thresholds'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, {'temperature': {'warn_high': 28.0}})

    @patch('sensors.views.fs')
    def test_update_thresholds(self, mock_fs):
        new_thresholds = {'temperature': {'warn_high': 30.0}}
        resp = self.client.post(reverse('update-thresholds'), new_thresholds, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.set_thresholds.assert_called_once_with(new_thresholds)


class AppSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('app-settings')

    @patch('sensors.views._wa')
    @patch('sensors.views.fs')
    def test_get_settings(self, mock_fs, mock_wa):
        mock_fs.get_app_settings.return_value = {'whatsapp_enabled': True, 'whatsapp_number': '+260965949914'}
        mock_wa.is_configured.return_value = True
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['whatsapp_enabled'])
        self.assertEqual(resp.data['whatsapp_number'], '+260965949914')
        self.assertTrue(resp.data['twilio_configured'])

    @patch('sensors.views.fs')
    def test_post_settings_sanitizes_input(self, mock_fs):
        resp = self.client.post(self.url, {'whatsapp_enabled': True, 'whatsapp_number': '  +260965949914  '}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.set_app_settings.assert_called_once_with({
            'whatsapp_enabled': True,
            'whatsapp_number': '+260965949914',
        })


class TestWhatsappEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('test-whatsapp')

    @patch('sensors.views._wa', None)
    def test_unavailable_when_service_missing(self):
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch('sensors.views.fs')
    @patch('sensors.views._wa')
    def test_no_number_saved(self, mock_wa, mock_fs):
        mock_wa.is_configured.return_value = True
        mock_fs.get_app_settings.return_value = {'whatsapp_number': ''}
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('sensors.views.fs')
    @patch('sensors.views._wa')
    def test_send_success(self, mock_wa, mock_fs):
        mock_wa.is_configured.return_value = True
        mock_fs.get_app_settings.return_value = {'whatsapp_number': '+260965949914'}
        mock_wa.send.return_value = (True, 'SM123')
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['sid'], 'SM123')

    @patch('sensors.views.fs')
    @patch('sensors.views._wa')
    def test_send_failure(self, mock_wa, mock_fs):
        mock_wa.is_configured.return_value = True
        mock_fs.get_app_settings.return_value = {'whatsapp_number': '+260965949914'}
        mock_wa.send.return_value = (False, 'some Twilio error')
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ChatEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('chat')

    def test_empty_message_returns_400(self):
        resp = self.client.post(self.url, {'message': '   '}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('sensors.views.fs')
    @patch('sensors.views.chatbot_reply')
    def test_valid_message_returns_reply(self, mock_reply, mock_fs):
        mock_fs.get_latest_reading.return_value = {'temperature': 25}
        mock_reply.return_value = 'Everything looks good on your farm!'
        resp = self.client.post(self.url, {'message': 'how is my farm?', 'history': []}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['reply'], 'Everything looks good on your farm!')
        mock_reply.assert_called_once_with('how is my farm?', {'temperature': 25}, [])
