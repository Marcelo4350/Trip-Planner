from django.contrib import admin
from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "pickup_location",
        "dropoff_location",
        "current_cycle_used_hours",
        "start_time",
        "created_at",
    )
    search_fields = ("pickup_location", "dropoff_location", "current_location")
    readonly_fields = ("plan", "created_at")
