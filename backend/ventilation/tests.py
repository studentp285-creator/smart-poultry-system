"""
Unit tests for the ventilation app's REST API views.
Firebase is mocked so these tests exercise only the view layer.

Run with:  python manage.py test ventilation
"""

from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework import status


class VentilationStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('ventilation-status')

    @patch('ventilation.views.fs')
    def test_returns_current_state(self, mock_fs):
        mock_fs.get_ventilation.return_value = {
            'is_open': True, 'changed_by': 'auto', 'reason': 'Temp critical', 'last_changed': '2026-01-01T00:00:00+00:00',
        }
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['is_open'])
        self.assertEqual(resp.data['changed_by'], 'auto')


class VentilationControlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('ventilation-control')

    def test_missing_action_returns_400(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_action_returns_400(self):
        resp = self.client.post(self.url, {'action': 'explode'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('ventilation.views.fs')
    def test_open_action_sets_manual_open(self, mock_fs):
        mock_fs.get_ventilation.return_value = {'is_open': True, 'changed_by': 'manual'}
        resp = self.client.post(self.url, {'action': 'open'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.set_ventilation.assert_called_once_with(True, 'manual', 'Manually opened by operator')

    @patch('ventilation.views.fs')
    def test_close_action_sets_manual_close(self, mock_fs):
        mock_fs.get_ventilation.return_value = {'is_open': False, 'changed_by': 'manual'}
        resp = self.client.post(self.url, {'action': 'close'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        mock_fs.set_ventilation.assert_called_once_with(False, 'manual', 'Manually closed by operator')
