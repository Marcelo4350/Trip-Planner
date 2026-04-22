from rest_framework import serializers
from .models import Trip


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False)
    driver_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    co_driver_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    carrier_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    carrier_address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    truck_number = serializers.CharField(max_length=60, required=False, allow_blank=True)
    shipping_doc_number = serializers.CharField(max_length=60, required=False, allow_blank=True)


class GeocodeRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=255)


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ("created_at", "plan")
