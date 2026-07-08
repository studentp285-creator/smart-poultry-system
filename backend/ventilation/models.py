from django.db import models


class VentilationStatus(models.Model):
    CHANGED_BY = [('auto', 'Automatic'), ('manual', 'Manual')]

    is_open = models.BooleanField(default=False)
    changed_by = models.CharField(max_length=10, choices=CHANGED_BY, default='manual')
    last_changed = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Ventilation Status'

    def __str__(self):
        state = "Open" if self.is_open else "Closed"
        return f"Windows {state} (by {self.changed_by})"
