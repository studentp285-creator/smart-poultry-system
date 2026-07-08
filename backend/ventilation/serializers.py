from rest_framework import serializers
from .models import VentilationStatus


class VentilationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentilationStatus
        fields = '__all__'
