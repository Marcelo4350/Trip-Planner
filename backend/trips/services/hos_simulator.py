"""
Hours-of-Service simulator for property-carrying CMV drivers.

Models the FMCSA rules (49 CFR part 395) used by interstate truckers:
  * 14-hour on-duty driving window (after 10 consecutive hours off duty).
  * 11 hours of driving allowed within the 14-hour window.
  * 30-minute break required after 8 cumulative hours of driving.
  * 70-hour / 8-day on-duty cycle (the assignment stipulates the 70/8 schedule).
  * 34-hour restart resets the 70-hour cycle.
  * 10 consecutive hours off resets the 11 / 14 / 30-min clocks.

Project-specific assumptions (from the assessment prompt):
  * Property-carrying driver on the 70 hr / 8-day schedule.
  * No adverse driving conditions.
  * Fueling stop every 1000 miles (15 min on-duty not driving).
  * 1 hour on-duty not driving for pickup and for drop-off.

The simulator consumes route segments (current -> pickup, pickup -> drop-off)
produced by the routing service, and emits a chronological list of events:

    { status, start, end, duration_hours, miles, start_coord, end_coord,
      start_location, end_location, note }

where `status` is one of: off_duty, sleeper_berth, driving, on_duty_not_driving.

Those events are later grouped into 24-hour daily logs for rendering.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional


# --- Constants -------------------------------------------------------------

MAX_DRIVE_WINDOW_H = 11.0
MAX_ON_DUTY_WINDOW_H = 14.0
MAX_DRIVE_BEFORE_BREAK_H = 8.0
REQUIRED_BREAK_H = 0.5
REQUIRED_OFF_DUTY_H = 10.0
CYCLE_LIMIT_H = 70.0
RESTART_H = 34.0

FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_H = 0.25  # 15 minutes on-duty not driving
PICKUP_DROPOFF_H = 1.0  # 1 hour on-duty not driving

METERS_PER_MILE = 1609.344


# --- Geo helpers -----------------------------------------------------------

def haversine_miles(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 3958.7613  # Earth radius in miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def interpolate_along(coords: list[list[float]], target_miles: float) -> list[float]:
    """Walk along a GeoJSON-style [[lon,lat], ...] polyline and return the
    point that lies `target_miles` from the start."""
    if not coords:
        return [0.0, 0.0]
    if target_miles <= 0:
        return list(coords[0])

    traveled = 0.0
    for i in range(len(coords) - 1):
        a = coords[i]
        b = coords[i + 1]
        seg = haversine_miles(a[0], a[1], b[0], b[1])
        if traveled + seg >= target_miles:
            if seg == 0:
                return list(b)
            t = (target_miles - traveled) / seg
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        traveled += seg
    return list(coords[-1])


# --- Data classes ----------------------------------------------------------

@dataclass
class Segment:
    """A physical route segment the driver must traverse."""

    name: str  # e.g. "Current → Pickup"
    start_label: str
    end_label: str
    start_coord: list[float]  # [lon, lat]
    end_coord: list[float]
    distance_miles: float
    duration_hours: float  # OSRM "free-flow" driving duration
    polyline: list[list[float]]  # [[lon, lat], ...]
    on_duty_on_arrival_h: float = 0.0  # 1 hr for pickup / dropoff
    on_arrival_note: str = ""


@dataclass
class SimState:
    now: datetime
    cycle_used_h: float

    # Current 14-hour window tracking (None when not in a window)
    window_start: Optional[datetime] = None
    drive_in_window_h: float = 0.0
    on_duty_in_window_h: float = 0.0
    drive_since_break_h: float = 0.0

    # Fuel tracking (per trip; pragmatic heuristic)
    miles_since_fuel: float = 0.0

    # Current geographic position
    cur_coord: list[float] = field(default_factory=lambda: [0.0, 0.0])
    cur_label: str = ""


# --- Simulator -------------------------------------------------------------

class HosSimulator:
    def __init__(
        self,
        segments: list[Segment],
        start_time: datetime,
        current_cycle_used_hours: float,
        start_label: str,
        start_coord: list[float],
    ):
        self.segments = segments
        self.events: list[dict] = []
        self.state = SimState(
            now=start_time,
            cycle_used_h=current_cycle_used_hours,
            cur_coord=list(start_coord),
            cur_label=start_label,
        )

    # -- Event helpers -----------------------------------------------------

    def _emit(
        self,
        status: str,
        duration_h: float,
        *,
        miles: float = 0.0,
        start_coord: Optional[list[float]] = None,
        end_coord: Optional[list[float]] = None,
        start_label: Optional[str] = None,
        end_label: Optional[str] = None,
        note: str = "",
    ) -> None:
        if duration_h <= 0:
            return
        start = self.state.now
        end = start + timedelta(hours=duration_h)
        self.events.append(
            {
                "status": status,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "duration_hours": round(duration_h, 4),
                "miles": round(miles, 2),
                "start_coord": start_coord or list(self.state.cur_coord),
                "end_coord": end_coord or list(self.state.cur_coord),
                "start_location": start_label or self.state.cur_label,
                "end_location": end_label or self.state.cur_label,
                "note": note,
            }
        )
        self.state.now = end

    # -- Rest / break insertions ------------------------------------------

    def _take_30_min_break(self) -> None:
        """Insert the mandatory 30-minute break (logged off-duty).
        The break counts inside the 14-hour window but does not add drive or
        on-duty time, and does not count toward the 70-hour cycle.
        """
        self._emit(
            "off_duty",
            REQUIRED_BREAK_H,
            note="30-minute rest break (§395.3(a)(3)(ii))",
        )
        self.state.drive_since_break_h = 0.0
        if self.state.window_start is not None:
            self.state.on_duty_in_window_h += REQUIRED_BREAK_H  # clock keeps ticking

    def _take_10_hour_reset(self) -> None:
        """Insert a 10-hour sleeper berth rest that resets the daily window."""
        self._emit(
            "sleeper_berth",
            REQUIRED_OFF_DUTY_H,
            note="10-hour off-duty rest (resets 11/14-hour limits)",
        )
        self.state.window_start = None
        self.state.drive_in_window_h = 0.0
        self.state.on_duty_in_window_h = 0.0
        self.state.drive_since_break_h = 0.0

    def _take_34_hour_restart(self) -> None:
        self._emit(
            "off_duty",
            RESTART_H,
            note="34-hour restart (resets 70-hour cycle)",
        )
        self.state.window_start = None
        self.state.drive_in_window_h = 0.0
        self.state.on_duty_in_window_h = 0.0
        self.state.drive_since_break_h = 0.0
        self.state.cycle_used_h = 0.0

    # -- On-duty (not driving) -------------------------------------------

    def _do_on_duty_not_driving(self, hours: float, note: str) -> None:
        """Pickup/dropoff/fueling time. Costs window + cycle hours.

        Per §395.3(a)(3)(ii), the required 30-minute break may be taken either
        on duty, off duty, or in the sleeper berth. Any single consecutive
        period of non-driving time of at least 30 minutes therefore satisfies
        the break requirement (e.g. a 1-hour pickup counts as the driver's
        30-min break).
        """
        remaining = hours
        while remaining > 1e-6:
            self._start_window_if_needed()
            available_window = MAX_ON_DUTY_WINDOW_H - self.state.on_duty_in_window_h
            available_cycle = max(0.0, CYCLE_LIMIT_H - self.state.cycle_used_h)

            chunk = min(remaining, available_window, available_cycle)
            if chunk <= 1e-6:
                if available_cycle <= 1e-6:
                    self._take_34_hour_restart()
                else:
                    self._take_10_hour_reset()
                continue

            self._emit("on_duty_not_driving", chunk, note=note)
            self.state.on_duty_in_window_h += chunk
            self.state.cycle_used_h += chunk
            if chunk >= REQUIRED_BREAK_H - 1e-6:
                # A consecutive >= 30-minute non-driving period satisfies the
                # mandatory break (§395.3(a)(3)(ii)).
                self.state.drive_since_break_h = 0.0
            remaining -= chunk

    # -- Driving ----------------------------------------------------------

    def _start_window_if_needed(self) -> None:
        if self.state.window_start is None:
            self.state.window_start = self.state.now

    def _drive(
        self,
        distance_miles: float,
        avg_speed_mph: float,
        polyline: list[list[float]],
        pline_start_offset_miles: float,
        pline_total_miles: float,
        end_coord: list[float],
        end_label: str,
    ) -> None:
        """Drive the given segment while respecting HOS + fueling rules.

        polyline: full segment polyline starting from self.state.cur_coord.
        pline_start_offset_miles: how many miles into the polyline we begin
        (used when we resume driving mid-segment after a break).
        """
        remaining = distance_miles
        pos = pline_start_offset_miles  # miles along original polyline

        while remaining > 1e-3:
            self._start_window_if_needed()

            # Hard limits -> corrective rest
            if self.state.cycle_used_h >= CYCLE_LIMIT_H - 1e-6:
                self._take_34_hour_restart()
                continue
            if self.state.drive_in_window_h >= MAX_DRIVE_WINDOW_H - 1e-6:
                self._take_10_hour_reset()
                continue
            if self.state.on_duty_in_window_h >= MAX_ON_DUTY_WINDOW_H - 1e-6:
                self._take_10_hour_reset()
                continue
            if self.state.drive_since_break_h >= MAX_DRIVE_BEFORE_BREAK_H - 1e-6:
                self._take_30_min_break()
                continue

            drive_budget_h = min(
                MAX_DRIVE_WINDOW_H - self.state.drive_in_window_h,
                MAX_ON_DUTY_WINDOW_H - self.state.on_duty_in_window_h,
                MAX_DRIVE_BEFORE_BREAK_H - self.state.drive_since_break_h,
                CYCLE_LIMIT_H - self.state.cycle_used_h,
            )
            if drive_budget_h <= 1e-6:
                continue  # Something is at limit; loop will rest above.

            miles_budget = drive_budget_h * avg_speed_mph

            # Fuel stop check
            miles_until_fuel = FUEL_INTERVAL_MILES - self.state.miles_since_fuel
            will_fuel = False
            miles_this_leg = min(remaining, miles_budget, max(0.0, miles_until_fuel))
            if miles_until_fuel <= miles_budget and miles_until_fuel <= remaining:
                will_fuel = True

            if miles_this_leg <= 1e-3:
                # Already at a fuel stop boundary.
                self._do_on_duty_not_driving(FUEL_STOP_H, "Fuel stop")
                self.state.miles_since_fuel = 0.0
                continue

            leg_hours = miles_this_leg / avg_speed_mph
            start_coord = list(self.state.cur_coord)
            new_pos = pos + miles_this_leg
            if new_pos >= pline_total_miles - 1e-3:
                new_coord = list(end_coord)
                new_label = end_label
            else:
                new_coord = interpolate_along(polyline, new_pos)
                new_label = "En route"

            self._emit(
                "driving",
                leg_hours,
                miles=miles_this_leg,
                start_coord=start_coord,
                end_coord=new_coord,
                start_label=self.state.cur_label,
                end_label=new_label,
                note=f"Driving {miles_this_leg:.1f} mi",
            )
            self.state.drive_in_window_h += leg_hours
            self.state.on_duty_in_window_h += leg_hours
            self.state.drive_since_break_h += leg_hours
            self.state.cycle_used_h += leg_hours
            self.state.miles_since_fuel += miles_this_leg
            self.state.cur_coord = new_coord
            self.state.cur_label = new_label
            remaining -= miles_this_leg
            pos = new_pos

            if will_fuel:
                self._do_on_duty_not_driving(FUEL_STOP_H, "Fuel stop (every 1,000 mi)")
                self.state.miles_since_fuel = 0.0

    # -- Public ----------------------------------------------------------

    def run(self) -> list[dict]:
        for seg in self.segments:
            avg_speed = (
                seg.distance_miles / seg.duration_hours if seg.duration_hours > 0 else 55.0
            )
            if avg_speed < 20 or avg_speed > 75:  # sanity clamp
                avg_speed = max(25.0, min(65.0, avg_speed))

            self._drive(
                distance_miles=seg.distance_miles,
                avg_speed_mph=avg_speed,
                polyline=seg.polyline,
                pline_start_offset_miles=0.0,
                pline_total_miles=seg.distance_miles,
                end_coord=seg.end_coord,
                end_label=seg.end_label,
            )

            if seg.on_duty_on_arrival_h > 0:
                self._do_on_duty_not_driving(
                    seg.on_duty_on_arrival_h, seg.on_arrival_note or "Pickup/Dropoff"
                )

        # End trip: go off-duty so the last day's grid closes cleanly.
        self._emit("off_duty", 0.0)  # no-op but keeps API consistent
        return self.events


# --- Daily log aggregation -------------------------------------------------

def _parse(dt: str) -> datetime:
    return datetime.fromisoformat(dt)


def split_events_into_days(events: list[dict], start_time: datetime) -> list[dict]:
    """Break events on 24-hour (midnight, driver's home-terminal local time)
    boundaries, group them into per-day logs, and pad each day with off-duty
    time so the grid totals sum to exactly 24 hours (matching the FMCSA
    "Driver's Daily Log" format, where each calendar day must be fully
    accounted for)."""
    if not events:
        return []

    tz = start_time.tzinfo or timezone.utc

    def midnight_after(dt: datetime) -> datetime:
        local = dt.astimezone(tz)
        return (local + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    def midnight_of(dt: datetime) -> datetime:
        local = dt.astimezone(tz)
        return local.replace(hour=0, minute=0, second=0, microsecond=0)

    # Split events across midnight
    split: list[dict] = []
    for ev in events:
        s = _parse(ev["start"]).astimezone(tz)
        e = _parse(ev["end"]).astimezone(tz)
        if e <= s:
            continue
        cur_s = s
        while cur_s < e:
            m = midnight_after(cur_s)
            cur_e = min(m, e)
            hrs = (cur_e - cur_s).total_seconds() / 3600.0
            total_hrs = (e - s).total_seconds() / 3600.0
            miles_share = ev.get("miles", 0) * (hrs / total_hrs) if total_hrs else 0.0
            split.append(
                {
                    **ev,
                    "start": cur_s.isoformat(),
                    "end": cur_e.isoformat(),
                    "duration_hours": round(hrs, 4),
                    "miles": round(miles_share, 2),
                }
            )
            cur_s = cur_e

    days: dict[str, list[dict]] = {}
    for ev in split:
        d = _parse(ev["start"]).astimezone(tz).date().isoformat()
        days.setdefault(d, []).append(ev)

    # Pad each day with off-duty so totals = 24h
    def _off_duty(start: datetime, end: datetime, start_label: str, start_coord: list[float]) -> dict:
        return {
            "status": "off_duty",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "duration_hours": round((end - start).total_seconds() / 3600.0, 4),
            "miles": 0.0,
            "start_coord": list(start_coord),
            "end_coord": list(start_coord),
            "start_location": start_label,
            "end_location": start_label,
            "note": "Off duty",
        }

    result = []
    for i, d in enumerate(sorted(days.keys()), start=1):
        evs = sorted(days[d], key=lambda x: x["start"])
        day_midnight = midnight_of(_parse(evs[0]["start"]))
        next_midnight = day_midnight + timedelta(days=1)

        first_start = _parse(evs[0]["start"]).astimezone(tz)
        if first_start > day_midnight:
            evs.insert(
                0,
                _off_duty(
                    day_midnight,
                    first_start,
                    evs[0].get("start_location", ""),
                    evs[0].get("start_coord", [0.0, 0.0]),
                ),
            )

        last_end = _parse(evs[-1]["end"]).astimezone(tz)
        if last_end < next_midnight:
            evs.append(
                _off_duty(
                    last_end,
                    next_midnight,
                    evs[-1].get("end_location", ""),
                    evs[-1].get("end_coord", [0.0, 0.0]),
                )
            )

        totals = {"off_duty": 0.0, "sleeper_berth": 0.0, "driving": 0.0, "on_duty_not_driving": 0.0}
        miles = 0.0
        for ev in evs:
            totals[ev["status"]] = totals.get(ev["status"], 0.0) + ev["duration_hours"]
            if ev["status"] == "driving":
                miles += ev.get("miles", 0.0)
        result.append(
            {
                "day_number": i,
                "date": d,
                "events": evs,
                "totals_hours": {k: round(v, 2) for k, v in totals.items()},
                "total_miles": round(miles, 1),
            }
        )
    return result
