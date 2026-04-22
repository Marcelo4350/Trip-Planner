from django.db import models


class Trip(models.Model):
    """Persisted trip plan for audit / sharing."""

    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used_hours = models.FloatField(default=0)
    start_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    # Stored computed plan (JSON blob) so the trip can be reloaded later.
    plan = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Trip {self.id}: {self.pickup_location} -> {self.dropoff_location}"
