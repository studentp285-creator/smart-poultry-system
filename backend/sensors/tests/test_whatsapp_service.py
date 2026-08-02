"""
Unit tests for whatsapp_service.py (Twilio WhatsApp integration).
Twilio's Client is mocked — no real API calls or credentials are needed to run these.
Run with:  python manage.py test sensors
"""

from django.test import TestCase
from unittest.mock import patch, MagicMock
import whatsapp_service as wa


class IsConfiguredTests(TestCase):
    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', 'token123')
    def test_configured_when_both_present(self):
        self.assertTrue(wa.is_configured())

    @patch('whatsapp_service._SID', '')
    @patch('whatsapp_service._TOKEN', 'token123')
    def test_not_configured_when_sid_missing(self):
        self.assertFalse(wa.is_configured())

    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', '')
    def test_not_configured_when_token_missing(self):
        self.assertFalse(wa.is_configured())


class SendValidationTests(TestCase):
    @patch('whatsapp_service._SID', '')
    @patch('whatsapp_service._TOKEN', '')
    def test_send_fails_when_not_configured(self):
        ok, detail = wa.send('hello', '+260965949914')
        self.assertFalse(ok)
        self.assertIn('not configured', detail)

    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', 'token123')
    def test_send_fails_with_empty_number(self):
        ok, detail = wa.send('hello', '')
        self.assertFalse(ok)
        self.assertIn('No WhatsApp number', detail)


class SendSuccessTests(TestCase):
    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', 'token123')
    @patch('twilio.rest.Client')
    def test_send_success_adds_whatsapp_prefix(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = MagicMock(sid='SMabc123')
        mock_client_cls.return_value = mock_client

        ok, detail = wa.send('hello farmer', '+260965949914')

        self.assertTrue(ok)
        self.assertEqual(detail, 'SMabc123')
        _, kwargs = mock_client.messages.create.call_args
        self.assertEqual(kwargs['to'], 'whatsapp:+260965949914')

    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', 'token123')
    @patch('twilio.rest.Client')
    def test_send_does_not_double_prefix_already_formatted_number(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.messages.create.return_value = MagicMock(sid='SM1')
        mock_client_cls.return_value = mock_client

        wa.send('hi', 'whatsapp:+260965949914')

        _, kwargs = mock_client.messages.create.call_args
        self.assertEqual(kwargs['to'], 'whatsapp:+260965949914')


class SendFailureTests(TestCase):
    @patch('whatsapp_service._SID', 'AC123')
    @patch('whatsapp_service._TOKEN', 'token123')
    @patch('twilio.rest.Client')
    def test_send_returns_error_detail_on_exception(self, mock_client_cls):
        mock_client_cls.side_effect = Exception('sandbox not joined')
        ok, detail = wa.send('hi', '+260965949914')
        self.assertFalse(ok)
        self.assertIn('sandbox not joined', detail)
