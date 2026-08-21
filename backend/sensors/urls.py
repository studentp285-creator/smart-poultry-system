from django.urls import path
from . import views

urlpatterns = [
    path('readings/',                  views.sensor_readings,   name='sensor-readings'),
    path('readings/latest/',           views.latest_reading,    name='latest-reading'),
    path('device/heartbeat/',          views.device_heartbeat,  name='device-heartbeat'),
    path('ventilation/',               views.ventilation_status,  name='ventilation-status'),
    path('ventilation/control/',       views.ventilation_control, name='ventilation-control'),
    path('alerts/',                    views.alerts_list,       name='alerts-list'),
    path('alerts/<str:alert_id>/read/', views.mark_alert_read,  name='mark-alert-read'),
    path('alerts/mark-all-read/',      views.mark_all_read,      name='mark-all-read'),
    path('alerts/delete-all/',         views.delete_all_alerts,  name='delete-all-alerts'),
    path('alerts/delete-read/',        views.delete_read_alerts, name='delete-read-alerts'),
    path('auth/check-email/',          views.check_email,        name='check-email'),
    path('chat/status/',               views.chat_status,        name='chat-status'),
    path('chat/',                        views.chat,               name='chat'),
    path('settings/',                    views.app_settings,       name='app-settings'),
    path('settings/test-whatsapp/',      views.test_whatsapp,      name='test-whatsapp'),
    path('thresholds/',                  views.get_thresholds,      name='get-thresholds'),
    path('thresholds/update/',           views.update_thresholds,   name='update-thresholds'),
]
