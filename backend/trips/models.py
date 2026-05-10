from django.db import models


class TripPlan(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    current_location = models.CharField(max_length=512)
    pickup_location = models.CharField(max_length=512)
    dropoff_location = models.CharField(max_length=512)
    cycle_hours_used = models.FloatField()
    result_json = models.JSONField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.current_location} → {self.pickup_location} → {self.dropoff_location} ({self.created_at:%Y-%m-%d})"
