from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('sensors.urls')),
    path('api/', include('ventilation.urls')),
]
