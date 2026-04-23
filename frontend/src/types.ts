// Shared domain types for the ELD Trip Planner frontend.
// These mirror the JSON payload returned by the Django `plan-trip` endpoint
// in `backend/trips/views.py` (see `PlanTripView.post`).

export type DutyStatus =
  | "driving"
  | "on_duty_not_driving"
  | "sleeper_berth"
  | "off_duty";

export type StopKind =
  | "pickup"
  | "dropoff"
  | "fuel"
  | "rest_10h"
  | "restart_34h"
  | "break_30m"
  | "off_duty";

export type EndpointLabel = "Current" | "Pickup" | "Drop-off";

// Coordinates returned by the backend are [lon, lat] tuples (GeoJSON order).
export type LonLat = [number, number];

export interface TripFormValues {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number | string;
  start_time: string;
  driver_name: string;
  co_driver_name: string;
  carrier_name: string;
  carrier_address: string;
  truck_number: string;
  shipping_doc_number: string;
}

// Shape actually POSTed to the API (numbers coerced, optional fields cleaned).
export interface TripPlanRequest {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number;
  start_time?: string;
  driver_name?: string;
  co_driver_name?: string;
  carrier_name?: string;
  carrier_address?: string;
  truck_number?: string;
  shipping_doc_number?: string;
}

export interface PlanInputs {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number;
  start_time: string;
  driver_name: string;
  co_driver_name: string;
  carrier_name: string;
  carrier_address: string;
  truck_number: string;
  shipping_doc_number: string;
}

export interface GeocodedLocation {
  display_name: string;
  lat: number;
  lon: number;
  coord: LonLat;
}

export interface PlanLocations {
  current: GeocodedLocation;
  pickup: GeocodedLocation;
  dropoff: GeocodedLocation;
}

export interface RouteGeometry {
  type: "LineString";
  coordinates: LonLat[];
}

export interface RouteLeg {
  name: string;
  distance_miles: number;
  duration_hours: number;
  geometry: RouteGeometry;
}

export interface PlanRoute {
  legs: RouteLeg[];
  total_distance_miles: number;
  total_driving_hours: number;
}

export interface PlanSummary {
  total_distance_miles: number;
  total_driving_hours: number;
  total_on_duty_hours: number;
  trip_start: string;
  trip_end: string;
  elapsed_hours: number;
  num_days: number;
  final_cycle_used_hours: number;
}

export interface TripEvent {
  status: DutyStatus;
  start: string;
  end: string;
  duration_hours: number;
  miles?: number;
  note?: string;
  start_location?: string;
  end_location?: string;
  start_coord?: LonLat;
  end_coord?: LonLat;
}

export interface Stop {
  number: number;
  kind: StopKind;
  status: DutyStatus;
  start: string;
  end: string;
  duration_hours: number;
  coord: LonLat | null;
  location: string;
  note: string;
}

export interface DayLog {
  day_number: number;
  date: string;
  events: TripEvent[];
  total_miles: number;
}

export interface Plan {
  inputs: PlanInputs;
  locations: PlanLocations;
  route: PlanRoute;
  summary: PlanSummary;
  events: TripEvent[];
  stops: Stop[];
  days: DayLog[];
  trip_id?: number;
}

export interface ApiError {
  error?: string;
  detail?: string;
}
