from django.urls import path
from . import views

urlpatterns = [
    path('ventilation/', views.ventilation_status, name='ventilation-status'),
    path('ventilation/control/', views.ventilation_control, name='ventilation-control'),
]
