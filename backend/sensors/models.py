from django.db import models


class SensorReading(models.Model):
    temperature = models.FloatField()
    humidity = models.FloatField()
    gas_level = models.FloatField()
    water_level = models.FloatField()
    feed_level = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Reading @ {self.timestamp}"


class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]
    TYPE_CHOICES = [
        ('temperature', 'Temperature'),
        ('humidity', 'Humidity'),
        ('gas', 'Gas Level'),
        ('water', 'Water Level'),
        ('feed', 'Feed Level'),
    ]

    alert_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.alert_type} - {self.timestamp}"
