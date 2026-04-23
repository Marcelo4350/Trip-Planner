import { useEffect } from "react";
import type { JSX } from "react";
import Box from "@mui/material/Box";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { DivIcon, LatLngBoundsLiteral, LatLngExpression, Map as LeafletMap } from "leaflet";
import type {
  EndpointLabel,
  LonLat,
  Plan,
  RouteLeg,
  Stop,
  StopKind,
} from "../types";

interface MapViewProps {
  plan: Plan | null;
}

// `[lat, lon]` tuple — note the order is swapped compared to GeoJSON/API.
type LatLonPoint = [number, number];

interface EndpointMarker {
  label: EndpointLabel;
  coord: LonLat;
  color: string;
  name: string;
}

interface EndpointMarkerWithStop extends EndpointMarker {
  stop: Stop | null;
}

interface FitBoundsProps {
  bounds: LatLonPoint[];
}

function FitBounds({ bounds }: FitBoundsProps): null {
  const map: LeafletMap = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds as LatLngBoundsLiteral, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

// Build a tiny numbered pin DivIcon used for rest / fuel / pickup / dropoff
// stops so the numbers on the map line up with the numbered list in the UI.
function numberedIcon(n: number, color: string): DivIcon {
  return L.divIcon({
    className: "num-pin",
    html: `<div class="num-pin-inner" style="background:${color}">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function stopColor(kind: StopKind): string {
  switch (kind) {
    case "pickup":
      return "#a07414";
    case "dropoff":
      return "#b3261e";
    case "fuel":
      return "#c97a13";
    case "rest_10h":
      return "#2a6cc4";
    case "restart_34h":
      return "#6b4aa7";
    case "break_30m":
      return "#6b7280";
    default:
      return "#6b7280";
  }
}

const STOP_LABELS: Record<StopKind, string> = {
  pickup: "Pickup",
  dropoff: "Drop-off",
  fuel: "Fuel (15 min)",
  rest_10h: "10-hr rest",
  restart_34h: "34-hr restart",
  break_30m: "30-min break",
  off_duty: "Off duty",
};

function stopLabel(kind: StopKind): string {
  return STOP_LABELS[kind] || "Stop";
}

function sameCoord(
  a: LonLat | null | undefined,
  b: LonLat | null | undefined,
): boolean {
  if (!a || !b || a.length < 2 || b.length < 2) return false;
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

function fmtTime(iso: string): string {
  try {
    const d: Date = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MapView({ plan }: MapViewProps): JSX.Element {
  const defaultCenter: LatLngExpression = [39.5, -98.35];
  const bounds: LatLonPoint[] = [];

  let leg1: LatLonPoint[] = [];
  let leg2: LatLonPoint[] = [];

  if (plan) {
    const legs: RouteLeg[] = plan.route?.legs || [];
    leg1 =
      legs[0]?.geometry?.coordinates?.map(
        ([lon, lat]: LonLat): LatLonPoint => [lat, lon],
      ) || [];
    leg2 =
      legs[1]?.geometry?.coordinates?.map(
        ([lon, lat]: LonLat): LatLonPoint => [lat, lon],
      ) || [];
    leg1.forEach((p: LatLonPoint) => bounds.push(p));
    leg2.forEach((p: LatLonPoint) => bounds.push(p));
  }

  const endpointMarkers: EndpointMarker[] = plan
    ? [
        {
          label: "Current",
          coord: plan.locations.current.coord,
          color: "#2f7a46",
          name: plan.locations.current.display_name,
        },
        {
          label: "Pickup",
          coord: plan.locations.pickup.coord,
          color: "#a07414",
          name: plan.locations.pickup.display_name,
        },
        {
          label: "Drop-off",
          coord: plan.locations.dropoff.coord,
          color: "#b3261e",
          name: plan.locations.dropoff.display_name,
        },
      ]
    : [];

  const stops: Stop[] = plan?.stops || [];
  const endpointMarkersWithStop: EndpointMarkerWithStop[] = endpointMarkers.map(
    (m: EndpointMarker): EndpointMarkerWithStop => ({
      ...m,
      stop: stops.find((s: Stop) => sameCoord(s.coord, m.coord)) || null,
    }),
  );

  function endpointForCoord(
    coord: LonLat | null | undefined,
  ): EndpointMarkerWithStop | null {
    return (
      endpointMarkersWithStop.find((m: EndpointMarkerWithStop) =>
        sameCoord(m.coord, coord),
      ) || null
    );
  }

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {leg1.length > 1 && (
          <Polyline
            positions={leg1}
            pathOptions={{ color: "#2a6cc4", weight: 4, opacity: 0.9 }}
          />
        )}
        {leg2.length > 1 && (
          <Polyline
            positions={leg2}
            pathOptions={{
              color: "#2a6cc4",
              weight: 4,
              opacity: 0.9,
              dashArray: "6, 6",
            }}
          />
        )}

        {endpointMarkersWithStop.map((m: EndpointMarkerWithStop) => (
          <CircleMarker
            key={m.label}
            center={[m.coord[1], m.coord[0]]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: m.color,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip
              className="endpoint-tooltip"
              direction="top"
              offset={[0, -14]}
            >
              <strong>{m.label}</strong>
              <Box sx={{ display: "block", width: "100%", maxWidth: "100%", mt: "2px", fontSize: 11, color: "text.secondary", whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {m.name}
              </Box>
              {m.stop && (
                <Box sx={{ mt: "3px", fontSize: 11, color: "#3b3f45" }}>
                  #{m.stop.number} {stopLabel(m.stop.kind)} ·{" "}
                  {Number(m.stop.duration_hours).toFixed(2)}h
                </Box>
              )}
            </Tooltip>
          </CircleMarker>
        ))}

        {stops.map((s: Stop) => {
          if (!s.coord || !s.coord[0]) return null;
          const endpoint: EndpointMarkerWithStop | null = endpointForCoord(
            s.coord,
          );
          return (
            <Marker
              key={s.number}
              position={[s.coord[1], s.coord[0]]}
              icon={numberedIcon(s.number, stopColor(s.kind))}
            >
              {endpoint ? (
                <Tooltip
                  className="endpoint-tooltip"
                  direction="top"
                  offset={[0, -14]}
                >
                  <strong>{endpoint.label}</strong>
                  <Box sx={{ display: "block", width: "100%", maxWidth: "100%", mt: "2px", fontSize: 11, color: "text.secondary", whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    {endpoint.name}
                  </Box>
                  <Box sx={{ mt: "3px", fontSize: 11, color: "#3b3f45" }}>
                    #{s.number} {stopLabel(s.kind)} ·{" "}
                    {Number(s.duration_hours).toFixed(2)}h
                  </Box>
                </Tooltip>
              ) : (
                <Tooltip direction="top" offset={[0, -10]}>
                  <div style={{ fontSize: 12 }}>
                    <strong>
                      #{s.number} {stopLabel(s.kind)}
                    </strong>{" "}
                    · {s.duration_hours.toFixed(2)}h
                    <br />
                    <span style={{ color: "#555" }}>{s.note}</span>
                    <br />
                    <span style={{ color: "#555" }}>{fmtTime(s.start)}</span>
                  </div>
                </Tooltip>
              )}
            </Marker>
          );
        })}

        {bounds.length > 1 && <FitBounds bounds={bounds} />}
      </MapContainer>
    </Box>
  );
}
