from django.urls import path
from . import views

urlpatterns = [
    path('readings/',                  views.sensor_readings,   name='sensor-readings'),
    path('readings/latest/',           views.latest_reading,    name='latest-reading'),
    path('readings/simulate/',         views.simulate_reading,  name='simulate-reading'),
    path('readings/seed/',             views.seed_data,         name='seed-data'),
    path('alerts/',                    views.alerts_list,       name='alerts-list'),
    path('alerts/<str:alert_id>/read/', views.mark_alert_read,  name='mark-alert-read'),
    path('alerts/mark-all-read/',      views.mark_all_read,     name='mark-all-read'),
    path('alerts/delete-all/',         views.delete_all_alerts, name='delete-all-alerts'),
    path('chat/',                       views.chat,              name='chat'),
]
