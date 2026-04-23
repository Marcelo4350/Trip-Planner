"""API views for the ELD trip planner."""
from __future__ import annotations

from datetime import datetime, timezone

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Trip
from .serializers import (
    GeocodeRequestSerializer,
    TripPlanRequestSerializer,
    TripSerializer,
)
from .services.geocoding import GeocodingError, geocode
from .services.hos_simulator import (
    HosSimulator,
    METERS_PER_MILE,
    PICKUP_DROPOFF_H,
    Segment,
    split_events_into_days,
)
from .services.routing import RoutingError, route


class GeocodeView(APIView):
    """Thin wrapper around Nominatim so the frontend doesn't have to talk
    to a 3rd-party from the browser (avoids CORS + rate-limit surprises)."""

    def post(self, request):
        s = GeocodeRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            result = geocode(s.validated_data["query"])
        except GeocodingError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class PlanTripView(APIView):
    """Main endpoint: geocode, route, run HOS simulator, return a full plan."""

    def post(self, request):
        s = TripPlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        try:
            current = geocode(data["current_location"])
            pickup = geocode(data["pickup_location"])
            dropoff = geocode(data["dropoff_location"])
        except GeocodingError as e:
            return Response(
                {"error": f"Geocoding failed: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_coord = [current["lon"], current["lat"]]
        pickup_coord = [pickup["lon"], pickup["lat"]]
        dropoff_coord = [dropoff["lon"], dropoff["lat"]]

        try:
            leg_a = route([current_coord, pickup_coord])
            leg_b = route([pickup_coord, dropoff_coord])
        except RoutingError as e:
            return Response(
                {"error": f"Routing failed: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seg_a = Segment(
            name="Current → Pickup",
            start_label=current["display_name"],
            end_label=pickup["display_name"],
            start_coord=current_coord,
            end_coord=pickup_coord,
            distance_miles=leg_a["distance_meters"] / METERS_PER_MILE,
            duration_hours=leg_a["duration_seconds"] / 3600.0,
            polyline=leg_a["geometry"]["coordinates"],
            on_duty_on_arrival_h=PICKUP_DROPOFF_H,
            on_arrival_note="Pickup (1 hr on-duty not driving)",
        )
        seg_b = Segment(
            name="Pickup → Drop-off",
            start_label=pickup["display_name"],
            end_label=dropoff["display_name"],
            start_coord=pickup_coord,
            end_coord=dropoff_coord,
            distance_miles=leg_b["distance_meters"] / METERS_PER_MILE,
            duration_hours=leg_b["duration_seconds"] / 3600.0,
            polyline=leg_b["geometry"]["coordinates"],
            on_duty_on_arrival_h=PICKUP_DROPOFF_H,
            on_arrival_note="Drop-off (1 hr on-duty not driving)",
        )

        start_time = data.get("start_time") or datetime.now(timezone.utc)
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        sim = HosSimulator(
            segments=[seg_a, seg_b],
            start_time=start_time,
            current_cycle_used_hours=float(data["current_cycle_used_hours"]),
            start_label=current["display_name"],
            start_coord=current_coord,
        )
        events = sim.run()
        days = split_events_into_days(events, start_time)

        total_distance_miles = seg_a.distance_miles + seg_b.distance_miles
        total_driving_hours = sum(
            ev["duration_hours"] for ev in events if ev["status"] == "driving"
        )
        total_on_duty_hours = sum(
            ev["duration_hours"]
            for ev in events
            if ev["status"] in ("driving", "on_duty_not_driving")
        )
        trip_end = datetime.fromisoformat(events[-1]["end"]) if events else start_time

        # Build a numbered "stops" list so the map and the log remarks stay in
        # sync (Stop #1, #2, ... in chronological order).
        stops = []
        for ev in events:
            if ev["status"] == "driving":
                continue
            if ev["duration_hours"] <= 0:
                continue
            note = (ev.get("note") or "").lower()
            if "pickup" in note:
                kind = "pickup"
            elif "drop" in note:
                kind = "dropoff"
            elif "fuel" in note:
                kind = "fuel"
            elif "34-hour" in note or "34 hour" in note or "restart" in note:
                kind = "restart_34h"
            elif "10-hour" in note or "sleeper" in ev["status"]:
                kind = "rest_10h"
            elif "30-minute" in note or "30 min" in note:
                kind = "break_30m"
            else:
                kind = "off_duty"
            stops.append(
                {
                    "number": len(stops) + 1,
                    "kind": kind,
                    "status": ev["status"],
                    "start": ev["start"],
                    "end": ev["end"],
                    "duration_hours": ev["duration_hours"],
                    "coord": ev.get("start_coord"),
                    "location": ev.get("start_location"),
                    "note": ev.get("note", ""),
                }
            )

        plan = {
            "inputs": {
                "current_location": data["current_location"],
                "pickup_location": data["pickup_location"],
                "dropoff_location": data["dropoff_location"],
                "current_cycle_used_hours": float(data["current_cycle_used_hours"]),
                "start_time": start_time.isoformat(),
                "driver_name": data.get("driver_name", ""),
                "co_driver_name": data.get("co_driver_name", ""),
                "carrier_name": data.get("carrier_name", ""),
                "carrier_address": data.get("carrier_address", ""),
                "truck_number": data.get("truck_number", ""),
                "shipping_doc_number": data.get("shipping_doc_number", ""),
            },
            "locations": {
                "current": {**current, "coord": current_coord},
                "pickup": {**pickup, "coord": pickup_coord},
                "dropoff": {**dropoff, "coord": dropoff_coord},
            },
            "route": {
                "legs": [
                    {
                        "name": seg_a.name,
                        "distance_miles": round(seg_a.distance_miles, 1),
                        "duration_hours": round(seg_a.duration_hours, 2),
                        "geometry": leg_a["geometry"],
                    },
                    {
                        "name": seg_b.name,
                        "distance_miles": round(seg_b.distance_miles, 1),
                        "duration_hours": round(seg_b.duration_hours, 2),
                        "geometry": leg_b["geometry"],
                    },
                ],
                "total_distance_miles": round(total_distance_miles, 1),
                "total_driving_hours": round(total_driving_hours, 2),
            },
            "summary": {
                "total_distance_miles": round(total_distance_miles, 1),
                "total_driving_hours": round(total_driving_hours, 2),
                "total_on_duty_hours": round(total_on_duty_hours, 2),
                "trip_start": start_time.isoformat(),
                "trip_end": trip_end.isoformat(),
                "elapsed_hours": round(
                    (trip_end - start_time).total_seconds() / 3600.0, 2
                ),
                "num_days": len(days),
                "final_cycle_used_hours": round(sim.state.cycle_used_h, 2),
            },
            "events": events,
            "stops": stops,
            "days": days,
        }

        # Persist for reference (optional)
        trip = Trip.objects.create(
            current_location=data["current_location"],
            pickup_location=data["pickup_location"],
            dropoff_location=data["dropoff_location"],
            current_cycle_used_hours=float(data["current_cycle_used_hours"]),
            start_time=start_time,
            plan=plan,
        )
        plan["trip_id"] = trip.id

        return Response(plan)


class TripListCreateView(generics.ListCreateAPIView):
    queryset = Trip.objects.order_by("-created_at")
    serializer_class = TripSerializer


class TripDetailView(generics.RetrieveAPIView):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
